import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import dotenv from 'dotenv';
import { createPublicClient, http, decodeFunctionData, isAddress, createWalletClient, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import cron from 'node-cron';

dotenv.config();

const app = express();

const dbUrl = process.env.DATABASE_URL && process.env.DATABASE_URL !== 'undefined'
  ? process.env.DATABASE_URL
  : 'file:./dev.db';

console.log(`[Database] Initializing connection to: ${dbUrl}`);

const adapter = new PrismaLibSql({
  url: dbUrl,
});
const prisma = new PrismaClient({ adapter });
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Basic health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', network: 'Arc Testnet' });
});

// ==========================================
// CCTP & Recovery Engine Routes
// ==========================================

app.post('/api/cctp/attestation', async (req, res) => {
  const { messageHash } = req.body;
  try {
    // Mock attestation check (in reality, query Circle Iris API)
    const status = Math.random() > 0.5 ? 'complete' : 'pending';
    res.json({ status, attestation: status === 'complete' ? '0xmockattestation...' : null });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch attestation' });
  }
});

app.post('/api/recovery/scan', async (req, res) => {
  const { address } = req.body;
  try {
    // Mock scanning for stuck transactions
    const stuckTx = await prisma.recoveryRequest.findMany({
      where: { userAddress: address.toLowerCase(), status: 'PENDING' }
    });
    res.json({ stuckTransactions: stuckTx });
  } catch (error) {
    res.status(500).json({ error: 'Failed to scan' });
  }
});

app.post('/api/recovery/claim', async (req, res) => {
  const { recoveryId } = req.body;
  try {
    const reqDb = await prisma.recoveryRequest.update({
      where: { id: recoveryId },
      data: { status: 'RECOVERED' }
    });
    res.json({ success: true, request: reqDb });
  } catch (error) {
    res.status(500).json({ error: 'Failed to claim' });
  }
});

// Get user profile by address
app.get('/api/users/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const user = await prisma.user.findUnique({
      where: { address: address.toLowerCase() }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Resolve username to address
app.get('/api/resolve/:username', async (req, res) => {
  try {
    // Basic formatting: remove @ if present
    let { username } = req.params;
    if (username.startsWith('@')) {
      username = username.substring(1);
    }
    const cleanUsername = username.toLowerCase().trim();
    
    // 1. Try database lookup first
    const user = await prisma.user.findUnique({
      where: { username: cleanUsername }
    });
    
    if (user) {
      return res.json({ address: user.address });
    }

    // 2. Fallback to querying the blockchain directly
    console.log(`[Resolve] Username @${cleanUsername} not in DB, querying blockchain...`);
    const resolvedAddress = await viemClient.readContract({
      address: REGISTRY_ADDRESS,
      abi: [
        {
          name: 'resolveUsername',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: '_username', type: 'string' }],
          outputs: [{ name: '', type: 'address' }],
        }
      ] as const,
      functionName: 'resolveUsername',
      args: [cleanUsername],
    });

    // If resolved address is not the zero address, it's a valid username
    if (resolvedAddress && resolvedAddress !== '0x0000000000000000000000000000000000000000') {
      console.log(`[Resolve] Successfully resolved @${cleanUsername} to ${resolvedAddress} on-chain!`);
      // Optionally upsert into DB so it's cached
      await prisma.user.upsert({
        where: { address: resolvedAddress.toLowerCase() },
        update: { username: cleanUsername },
        create: { address: resolvedAddress.toLowerCase(), username: cleanUsername }
      });
      return res.json({ address: resolvedAddress });
    }
    
    return res.status(404).json({ error: 'Username not found' });
  } catch (error) {
    console.error('Resolve error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get transactions for an address
app.get('/api/transactions/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const addrLower = address.toLowerCase();
    
    const transactions = await prisma.transaction.findMany({
      where: {
        OR: [
          { fromAddress: addrLower },
          { toAddress: addrLower }
        ]
      },
      orderBy: { timestamp: 'desc' },
      take: 50
    });
    
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a payment request
app.post('/api/requests', async (req, res) => {
  try {
    const { fromAddress, toAddress, amount, memo } = req.body;
    
    if (!fromAddress || !amount) {
      return res.status(400).json({ error: 'fromAddress and amount are required' });
    }
    
    const request = await prisma.paymentRequest.create({
      data: {
        fromAddress: fromAddress.toLowerCase(),
        toAddress: toAddress ? toAddress.toLowerCase() : null,
        amount: amount.toString(),
        memo
      }
    });
    
    res.json(request);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a single payment request by ID
app.get('/api/request/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const request = await prisma.paymentRequest.findUnique({
      where: { id }
    });
    
    if (!request) {
      return res.status(404).json({ error: 'Payment request not found' });
    }
    res.json(request);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get payment requests for an address
app.get('/api/requests/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const addrLower = address.toLowerCase();
    
    const requests = await prisma.paymentRequest.findMany({
      where: {
        OR: [
          { fromAddress: addrLower }, // Requests created by me
          { toAddress: addrLower }    // Requests directed to me
        ]
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// Payout Templates Routes
// ==========================================

// Get all templates for an address
app.get('/api/payouts/templates/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const templates = await prisma.payoutTemplate.findMany({
      where: { ownerAddress: address.toLowerCase() },
      orderBy: { createdAt: 'desc' }
    });
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new template
app.post('/api/payouts/templates', async (req, res) => {
  try {
    const { name, description, recipients, totalAmount, ownerAddress } = req.body;
    if (!name || !ownerAddress || !recipients) {
      return res.status(400).json({ error: 'name, ownerAddress, and recipients are required' });
    }
    const template = await prisma.payoutTemplate.create({
      data: {
        name,
        description,
        recipients: typeof recipients === 'string' ? recipients : JSON.stringify(recipients),
        totalAmount: totalAmount.toString(),
        ownerAddress: ownerAddress.toLowerCase()
      }
    });
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update an existing template
app.put('/api/payouts/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, recipients, totalAmount } = req.body;
    const updated = await prisma.payoutTemplate.update({
      where: { id },
      data: {
        name,
        description,
        recipients: typeof recipients === 'string' ? recipients : JSON.stringify(recipients),
        totalAmount: totalAmount ? totalAmount.toString() : undefined
      }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a template
app.delete('/api/payouts/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.payoutTemplate.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// Scheduled Payouts Routes
// ==========================================

// Get all schedules for an address
app.get('/api/payouts/schedule/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const schedules = await prisma.scheduledPayout.findMany({
      where: { ownerAddress: address.toLowerCase() },
      orderBy: { createdAt: 'desc' }
    });
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a scheduled payout
app.post('/api/payouts/schedule', async (req, res) => {
  try {
    const { id, name, description, frequency, recipients, totalAmount, nextRun, ownerAddress } = req.body;
    
    // Server-side validation
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Payout name is required.' });
    }
    if (!frequency) {
      return res.status(400).json({ error: 'Frequency is required.' });
    }
    if (!nextRun) {
      return res.status(400).json({ error: 'Scheduled date is required.' });
    }
    if (!totalAmount || isNaN(parseFloat(totalAmount)) || parseFloat(totalAmount) <= 0) {
      return res.status(400).json({ error: 'Total USDC amount must be greater than 0.' });
    }
    if (!ownerAddress || !isAddress(ownerAddress)) {
      return res.status(400).json({ error: 'A valid connected owner address is required.' });
    }
    if (!recipients) {
      return res.status(400).json({ error: 'Recipients list is required.' });
    }
    if (!id) {
      return res.status(400).json({ error: 'Schedule ID is required.' });
    }

    let parsedRecipients: any[] = [];
    try {
      parsedRecipients = typeof recipients === 'string' ? JSON.parse(recipients) : recipients;
    } catch (e) {
      return res.status(400).json({ error: 'Recipients list is not formatted as a valid JSON array.' });
    }

    if (!Array.isArray(parsedRecipients) || parsedRecipients.length === 0) {
      return res.status(400).json({ error: 'At least one recipient is required.' });
    }

    for (let i = 0; i < parsedRecipients.length; i++) {
      const r = parsedRecipients[i];
      const rowNum = i + 1;
      const addr = r.address ? r.address.trim() : '';
      if (!addr) {
        return res.status(400).json({ error: `Row ${rowNum}: Wallet address or username is required.` });
      }
      if (!isAddress(addr) && !addr.startsWith('@')) {
        return res.status(400).json({ error: `Row ${rowNum}: "${addr}" is not a valid EVM address or username.` });
      }
      const amt = parseFloat(r.amount);
      if (isNaN(amt) || amt <= 0) {
        return res.status(400).json({ error: `Row ${rowNum}: Amount "${r.amount}" must be a positive number.` });
      }
    }

    console.log(`[Scheduled Payout] Creating schedule "${name}" for owner ${ownerAddress}`);

    const schedule = await prisma.scheduledPayout.create({
      data: {
        id,
        name: name.trim(),
        description: description ? description.trim() : null,
        frequency,
        recipients: typeof recipients === 'string' ? recipients : JSON.stringify(recipients),
        totalAmount: totalAmount.toString(),
        nextRun: new Date(nextRun),
        status: 'Scheduled', // Save scheduled payouts in the database with status of "Scheduled"
        ownerAddress: ownerAddress.toLowerCase()
      }
    });

    return res.status(200).json({ success: true, schedule });
  } catch (error: any) {
    console.error('Create schedule server-side error details:', error); // Log detailed server error
    return res.status(500).json({ error: 'Internal server error. Failed to create scheduled payout.' }); // User-friendly error message
  }
});

// Delete a scheduled payout
app.delete('/api/payouts/schedule/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.scheduledPayout.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark a schedule as executed (runs next execution calculation)
app.post('/api/payouts/schedule/:id/run', async (req, res) => {
  try {
    const { id } = req.params;
    const schedule = await prisma.scheduledPayout.findUnique({ where: { id } });
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    
    let nextRun = new Date(schedule.nextRun);
    let status = 'ACTIVE';
    
    if (schedule.frequency === 'WEEKLY') {
      nextRun.setDate(nextRun.getDate() + 7);
    } else if (schedule.frequency === 'MONTHLY') {
      nextRun.setMonth(nextRun.getMonth() + 1);
    } else {
      status = 'COMPLETED'; // One-time scheduled payments are complete
    }
    
    const updated = await prisma.scheduledPayout.update({
      where: { id },
      data: { nextRun, status }
    });
    
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCKCHAIN EVENT INDEXER (OPTION A)
// ─────────────────────────────────────────────────────────────────────────────

// Contracts deployed on May 19, 2026 — skip empty blocks before that
const START_BLOCK = 44800000n;
const RPC_URL = process.env.RPC_URL || 'https://rpc.testnet.arc.network';
const REGISTRY_ADDRESS = (process.env.REGISTRY_ADDRESS || '0x08EAda9790495804329E0234464fd86CA4b35ff2') as `0x${string}`;
const ROUTER_ADDRESS = (process.env.ROUTER_ADDRESS || '0x71157874BBD90389A429714815454C64FE061F1c') as `0x${string}`;
const BULK_ROUTER_ADDRESS = (process.env.BULK_ROUTER_ADDRESS || '0xB1a346132F5eC1Ad7CC8A84DE33A2763d13110B4') as `0x${string}`;
const REGISTRY_ABI = [
  {
    name: 'registerUsername',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_username', type: 'string' }],
    outputs: [],
  },
] as const;

const viemClient = createPublicClient({
  transport: http(RPC_URL),
});

async function getSyncState(key: string, defaultValue: bigint): Promise<bigint> {
  try {
    const state = await prisma.syncState.findUnique({ where: { key } });
    return state ? BigInt(state.value) : defaultValue;
  } catch {
    return defaultValue;
  }
}

async function setSyncState(key: string, value: bigint): Promise<void> {
  try {
    await prisma.syncState.upsert({
      where: { key },
      update: { value: value.toString() },
      create: { key, value: value.toString() },
    });
  } catch (err) {
    console.error('Error saving sync state:', err);
  }
}

const blockTimestampCache = new Map<bigint, Date>();

async function getBlockTimestamp(blockNumber: bigint): Promise<Date> {
  if (blockTimestampCache.has(blockNumber)) {
    return blockTimestampCache.get(blockNumber)!;
  }
  try {
    const block = await viemClient.getBlock({ blockNumber });
    const date = new Date(Number(block.timestamp) * 1000);
    blockTimestampCache.set(blockNumber, date);
    return date;
  } catch (err) {
    return new Date();
  }
}

async function indexUsernames(fromBlock: bigint, toBlock: bigint) {
  try {
    const logs = await viemClient.getLogs({
      address: REGISTRY_ADDRESS,
      event: {
        type: 'event',
        name: 'UsernameRegistered',
        inputs: [
          { name: 'username', type: 'string', indexed: true },
          { name: 'userAddress', type: 'address', indexed: true }
        ]
      },
      fromBlock,
      toBlock
    });

    for (const log of logs) {
      const { transactionHash, blockNumber } = log;
      if (!transactionHash) continue;
      
      try {
        const tx = await viemClient.getTransaction({ hash: transactionHash });
        const decoded = decodeFunctionData({
          abi: REGISTRY_ABI,
          data: tx.input
        });
        
        const rawUsername = decoded.args?.[0] as string;
        const username = rawUsername?.toLowerCase().trim().replace('@', '');
        const userAddress = log.args.userAddress?.toLowerCase();
        
        if (username && userAddress) {
          console.log(`[Indexer] Registry Sync: @${username} registered to ${userAddress} in tx ${transactionHash}`);
          await prisma.user.upsert({
            where: { address: userAddress },
            update: { username },
            create: { address: userAddress, username }
          });
        }
      } catch (decodeErr) {
        console.error(`[Indexer] Could not decode registry tx input:`, decodeErr);
      }
    }
  } catch (err) {
    console.error(`[Indexer] Error fetching registry logs:`, err);
  }
}

async function indexPayments(fromBlock: bigint, toBlock: bigint) {
  try {
    const logs = await viemClient.getLogs({
      address: [ROUTER_ADDRESS, BULK_ROUTER_ADDRESS],
      event: {
        type: 'event',
        name: 'PaymentSent',
        inputs: [
          { name: 'from', type: 'address', indexed: true },
          { name: 'to', type: 'address', indexed: true },
          { name: 'amount', type: 'uint256', indexed: false },
          { name: 'memo', type: 'string', indexed: false }
        ]
      },
      fromBlock,
      toBlock
    });

    for (const log of logs) {
      const { transactionHash, blockNumber } = log;
      if (!transactionHash) continue;

      const fromAddress = log.args.from?.toLowerCase();
      const toAddress = log.args.to?.toLowerCase();
      const amount = log.args.amount ? log.args.amount.toString() : '0';
      const memo = log.args.memo || '';

      if (!fromAddress || !toAddress) continue;

      console.log(`[Indexer] Router Sync: Payment found in tx ${transactionHash} (amount: ${amount}, memo: "${memo}")`);

      const timestamp = await getBlockTimestamp(blockNumber!);

      const exists = await prisma.transaction.findFirst({
        where: {
          txHash: transactionHash,
          toAddress,
          amount,
          memo,
        }
      });

      if (!exists) {
        await prisma.transaction.create({
          data: {
            txHash: transactionHash,
            fromAddress,
            toAddress,
            amount,
            memo,
            status: 'COMPLETED',
            blockNumber: Number(blockNumber),
            timestamp
          }
        });
      }

      if (memo) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(memo.trim())) {
          const reqId = memo.trim();
          try {
            const paymentRequest = await prisma.paymentRequest.findUnique({
              where: { id: reqId }
            });
            
            if (paymentRequest && paymentRequest.status === 'PENDING') {
              console.log(`[Indexer] Router Sync: Matching PENDING payment request found for ID ${reqId}. Updating status to PAID.`);
              await prisma.paymentRequest.update({
                where: { id: reqId },
                data: { status: 'PAID' }
              });
            }
          } catch (reqErr) {
            console.error(`[Indexer] Error checking/updating payment request status:`, reqErr);
          }
        }
      }
    }
  } catch (err) {
    console.error(`[Indexer] Error fetching router logs:`, err);
  }
}

async function startIndexer() {
  console.log(`[Indexer] Initializing event indexer from block ${START_BLOCK}...`);
  
  // Clean up cache periodically (every 10 minutes)
  setInterval(() => blockTimestampCache.clear(), 10 * 60 * 1000);

  const poll = async () => {
    try {
      const latestBlock = await viemClient.getBlockNumber();
      const lastProcessed = await getSyncState('lastIndexedBlock', START_BLOCK);

      if (latestBlock > lastProcessed) {
        const fromBlock = lastProcessed + 1n;
        const toBlock = latestBlock;
        const remaining = toBlock - lastProcessed;
        
        // Use large chunks for historical catch-up, smaller for near-tip polling
        const CHUNK_SIZE = remaining > 10000n ? 5000n : 500n;
        
        let chunksProcessed = 0;
        for (let currentFrom = fromBlock; currentFrom <= toBlock; currentFrom += CHUNK_SIZE) {
          const currentTo = (currentFrom + CHUNK_SIZE - 1n > toBlock) ? toBlock : currentFrom + CHUNK_SIZE - 1n;
          
          await indexUsernames(currentFrom, currentTo);
          await indexPayments(currentFrom, currentTo);
          
          await setSyncState('lastIndexedBlock', currentTo);
          chunksProcessed++;

          // Log progress every 5 chunks during catch-up
          if (chunksProcessed % 5 === 0 || currentTo === toBlock) {
            const pct = Number((currentTo - fromBlock) * 100n / (toBlock - fromBlock + 1n));
            console.log(`[Indexer] Progress: block ${currentTo.toLocaleString()} / ${toBlock.toLocaleString()} (${pct}%) — ${(toBlock - currentTo).toLocaleString()} blocks remaining`);
          }
        }
        console.log(`[Indexer] ✓ Synced to tip at block ${toBlock.toLocaleString()}`);
      }
    } catch (err) {
      console.error('[Indexer] Polling cycle error:', err);
    }
    
    setTimeout(poll, 6000); // Poll every 6 seconds
  };

  poll();
}

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  startIndexer();
  startSchedulerCron();
});

// ==========================================
// SCHEDULER CRON JOB
// ==========================================

const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  network: 'arc_testnet',
  nativeCurrency: { name: 'Arc', symbol: 'ARC', decimals: 18 },
  rpcUrls: { default: { http: [process.env.RPC_URL || 'https://rpc.testnet.arc.network'] } },
});

const KEEPER_PK = process.env.KEEPER_PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000000';
const SCHEDULER_ADDRESS = process.env.SCHEDULER_ADDRESS as `0x${string}`;

const keeperAccount = privateKeyToAccount(KEEPER_PK as `0x${string}`);
const keeperWalletClient = createWalletClient({
  account: keeperAccount,
  chain: arcTestnet,
  transport: http(process.env.RPC_URL || 'https://rpc.testnet.arc.network'),
});

const schedulerABI = [
  {
    "inputs": [{"internalType": "string", "name": "id", "type": "string"}],
    "name": "executeSchedule",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

function startSchedulerCron() {
  if (!process.env.KEEPER_PRIVATE_KEY) {
    console.warn('[Scheduler] WARNING: KEEPER_PRIVATE_KEY is missing. Cron job disabled.');
    return;
  }
  
  console.log('[Scheduler] Initializing cron job (runs every minute)...');
  
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const dueSchedules = await prisma.scheduledPayout.findMany({
        where: {
          status: 'Scheduled', // or ACTIVE, depending on what the frontend uses
          nextRun: { lte: now }
        }
      });
      
      if (dueSchedules.length > 0) {
        console.log(`[Scheduler] Found ${dueSchedules.length} due scheduled payouts.`);
      }
      
      for (const schedule of dueSchedules) {
        try {
          console.log(`[Scheduler] Executing schedule ${schedule.id} (${schedule.name})...`);
          
          const txHash = await keeperWalletClient.writeContract({
            address: SCHEDULER_ADDRESS,
            abi: schedulerABI,
            functionName: 'executeSchedule',
            args: [schedule.id],
          });
          
          console.log(`[Scheduler] Transaction sent: ${txHash}`);
          
          // Wait for confirmation if desired. For now, optimistic update.
          if (schedule.frequency === 'MONTHLY') {
            const next = new Date(schedule.nextRun);
            next.setMonth(next.getMonth() + 1);
            await prisma.scheduledPayout.update({ where: { id: schedule.id }, data: { nextRun: next } });
          } else if (schedule.frequency === 'WEEKLY') {
            const next = new Date(schedule.nextRun);
            next.setDate(next.getDate() + 7);
            await prisma.scheduledPayout.update({ where: { id: schedule.id }, data: { nextRun: next } });
          } else {
            await prisma.scheduledPayout.update({ where: { id: schedule.id }, data: { status: 'COMPLETED' } });
          }
          console.log(`[Scheduler] Database updated for ${schedule.id}.`);
        } catch (err) {
          console.error(`[Scheduler] Failed to execute schedule ${schedule.id}:`, err);
        }
      }
    } catch (err) {
      console.error('[Scheduler] Cron cycle error:', err);
    }
  });
}
