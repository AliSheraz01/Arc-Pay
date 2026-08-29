import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import dotenv from 'dotenv';
import { createPublicClient, http, decodeFunctionData, isAddress, createWalletClient, defineChain, parseUnits } from 'viem';
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

// Environment & Network configuration
const NETWORK_MODE = process.env.NETWORK_MODE || 'testnet';
const IRIS_API_URL = NETWORK_MODE === 'mainnet' 
  ? 'https://iris-api.circle.com'
  : 'https://iris-api-sandbox.circle.com';

// Basic health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    networkMode: NETWORK_MODE,
    cctpIrisApi: IRIS_API_URL,
    timestamp: new Date().toISOString()
  });
});

// ==========================================
// 1. OFFICIAL CIRCLE CCTP V2 & ATTESTATIONS
// ==========================================

// Official Circle Iris Attestation Proxy (Never mocks, queries Circle Iris API)
app.post('/api/cctp/attestation', async (req, res) => {
  const { messageHash } = req.body;
  if (!messageHash) {
    return res.status(400).json({ error: 'messageHash is required' });
  }

  try {
    const cleanHash = messageHash.startsWith('0x') ? messageHash : `0x${messageHash}`;
    const circleResponse = await fetch(`${IRIS_API_URL}/attestations/${cleanHash}`, {
      headers: { 'Accept': 'application/json' }
    });

    if (circleResponse.status === 404) {
      return res.json({ status: 'pending', attestation: null });
    }

    if (!circleResponse.ok) {
      return res.json({ status: 'pending', attestation: null });
    }

    const data: any = await circleResponse.json();
    return res.json({
      status: data.status || 'pending',
      attestation: data.attestation || null
    });
  } catch (error: any) {
    console.error('[CCTP Attestation] Fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch attestation from Circle Iris API' });
  }
});

// ==========================================
// 2. CROSS PAY TRANSACTION STATE MACHINE
// ==========================================

// Create/initiate a Cross Pay transaction
app.post('/api/crosspay/create', async (req, res) => {
  try {
    const {
      userId,
      sourceChain,
      destinationChain,
      amount,
      token = 'USDC',
      senderAddress,
      recipientAddress,
      recipientUsername,
      idempotencyKey,
    } = req.body;

    if (!senderAddress || !recipientAddress || !amount || !sourceChain || !destinationChain) {
      return res.status(400).json({ error: 'Missing required parameters for Cross Pay transfer.' });
    }

    if (parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0.' });
    }

    // Idempotency check: prevent duplicate transactions
    if (idempotencyKey) {
      const existing = await prisma.crossPay.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        return res.json({ success: true, crossPay: existing, isExisting: true });
      }
    }

    // Upsert User record if senderAddress is provided
    let userRecord = await prisma.user.findUnique({
      where: { address: senderAddress.toLowerCase() },
    });
    if (!userRecord) {
      userRecord = await prisma.user.create({
        data: { address: senderAddress.toLowerCase() },
      });
    }

    const crossPay = await prisma.crossPay.create({
      data: {
        userId: userRecord.id,
        sourceChain: Number(sourceChain),
        destinationChain: Number(destinationChain),
        amount: amount.toString(),
        token,
        senderAddress: senderAddress.toLowerCase(),
        recipientAddress: recipientAddress.toLowerCase(),
        recipientUsername: recipientUsername || null,
        status: 'CREATED',
        idempotencyKey: idempotencyKey || undefined,
      },
    });

    res.json({ success: true, crossPay });
  } catch (error: any) {
    console.error('[CrossPay Create] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to create Cross Pay transfer' });
  }
});

// Update Cross Pay transaction state
app.post('/api/crosspay/update', async (req, res) => {
  try {
    const {
      id,
      status,
      sourceTxHash,
      destinationTxHash,
      cctpMessageId,
      attestationStatus,
      attestationBytes,
      errorReason,
    } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Transaction ID is required.' });
    }

    const existing = await prisma.crossPay.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Cross Pay transaction not found.' });
    }

    const updated = await prisma.crossPay.update({
      where: { id },
      data: {
        status: status || existing.status,
        sourceTxHash: sourceTxHash !== undefined ? sourceTxHash : existing.sourceTxHash,
        destinationTxHash: destinationTxHash !== undefined ? destinationTxHash : existing.destinationTxHash,
        cctpMessageId: cctpMessageId !== undefined ? cctpMessageId : existing.cctpMessageId,
        attestationStatus: attestationStatus !== undefined ? attestationStatus : existing.attestationStatus,
        attestationBytes: attestationBytes !== undefined ? attestationBytes : existing.attestationBytes,
        errorReason: errorReason !== undefined ? errorReason : existing.errorReason,
      },
    });

    res.json({ success: true, crossPay: updated });
  } catch (error: any) {
    console.error('[CrossPay Update] Error:', error);
    res.status(500).json({ error: 'Failed to update Cross Pay transfer' });
  }
});

// Get Cross Pay transaction by ID
app.get('/api/crosspay/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const crossPay = await prisma.crossPay.findUnique({
      where: { id },
    });
    if (!crossPay) {
      return res.status(404).json({ error: 'Cross Pay transaction not found' });
    }
    res.json(crossPay);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Cross Pay transaction' });
  }
});

// Get all Cross Pay transactions for an address
app.get('/api/crosspay/user/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const addrLower = address.toLowerCase();

    const crossPays = await prisma.crossPay.findMany({
      where: {
        OR: [
          { senderAddress: addrLower },
          { recipientAddress: addrLower },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json(crossPays);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user Cross Pay transactions' });
  }
});

// Get active in-flight Cross Pay transfer to resume on page reload
app.get('/api/crosspay/active/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const addrLower = address.toLowerCase();

    const activeTx = await prisma.crossPay.findFirst({
      where: {
        senderAddress: addrLower,
        status: {
          in: [
            'CREATED',
            'VALIDATING',
            'SOURCE_TRANSACTION_PENDING',
            'SOURCE_CONFIRMED',
            'ATTESTATION_PENDING',
            'ATTESTATION_RECEIVED',
            'DESTINATION_TRANSACTION_PENDING',
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ activeTx: activeTx || null });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check active transfers' });
  }
});

// ==========================================
// 3. X SOCIAL IDENTITY & USERNAME PAYMENTS
// ==========================================

// Connect X account (OAuth 2.0 or verified testnet connection)
app.post('/api/social/x/connect', async (req, res) => {
  try {
    const { address, username, displayName, avatar, providerUserId } = req.body;

    if (!address || !username) {
      return res.status(400).json({ error: 'Address and X username are required.' });
    }

    const addrLower = address.toLowerCase();
    const cleanUsername = username.replace('@', '').trim().toLowerCase();
    const xUserId = providerUserId ? providerUserId.toString() : `x_uid_${cleanUsername}`;

    // 1. Ensure user exists
    let user = await prisma.user.findUnique({
      where: { address: addrLower },
    });
    if (!user) {
      user = await prisma.user.create({
        data: { address: addrLower },
      });
    }

    // 2. Link or update SocialAccount using immutable providerUserId
    const socialAccount = await prisma.socialAccount.upsert({
      where: {
        provider_providerUserId: {
          provider: 'x',
          providerUserId: xUserId,
        },
      },
      update: {
        username: cleanUsername,
        displayName: displayName || username,
        avatar: avatar || null,
        userId: user.id,
      },
      create: {
        userId: user.id,
        provider: 'x',
        providerUserId: xUserId,
        username: cleanUsername,
        displayName: displayName || username,
        avatar: avatar || null,
      },
    });

    res.json({ success: true, socialAccount });
  } catch (error: any) {
    console.error('[X Connect] Error:', error);
    res.status(500).json({ error: 'Failed to connect X account' });
  }
});

// Get connected X account status for an address
app.get('/api/social/x/status/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const user = await prisma.user.findUnique({
      where: { address: address.toLowerCase() },
      include: { socialAccounts: { where: { provider: 'x' } } },
    });

    if (!user || user.socialAccounts.length === 0) {
      return res.json({ connected: false, account: null });
    }

    const xAcc = user.socialAccounts[0];
    res.json({
      connected: true,
      account: {
        username: xAcc.username,
        displayName: xAcc.displayName,
        avatar: xAcc.avatar,
        providerUserId: xAcc.providerUserId,
        connectedAt: xAcc.connectedAt,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch X account status' });
  }
});

// Disconnect X account
app.post('/api/social/x/disconnect', async (req, res) => {
  try {
    const { address } = req.body;
    if (!address) {
      return res.status(400).json({ error: 'Address is required.' });
    }

    const user = await prisma.user.findUnique({
      where: { address: address.toLowerCase() },
      include: { socialAccounts: { where: { provider: 'x' } } },
    });

    if (user && user.socialAccounts.length > 0) {
      await prisma.socialAccount.deleteMany({
        where: { userId: user.id, provider: 'x' },
      });
    }

    res.json({ success: true, message: 'X account disconnected.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to disconnect X account' });
  }
});

// Resolve X username to EasyZPay User & wallet address
app.get('/api/resolve/x/:username', async (req, res) => {
  try {
    let { username } = req.params;
    if (username.startsWith('@')) {
      username = username.substring(1);
    }
    const cleanUsername = username.toLowerCase().trim();

    const socialAccount = await prisma.socialAccount.findFirst({
      where: {
        provider: 'x',
        username: cleanUsername,
      },
      include: {
        user: true,
      },
    });

    if (!socialAccount || !socialAccount.user) {
      return res.status(404).json({
        connected: false,
        error: `This X user (@${cleanUsername}) hasn't connected EasyZPay yet.`,
        inviteUrl: `https://easyzpay.xyz/invite?ref=${cleanUsername}`,
      });
    }

    res.json({
      connected: true,
      address: socialAccount.user.address,
      username: socialAccount.username,
      displayName: socialAccount.displayName || `@${socialAccount.username}`,
      avatar: socialAccount.avatar,
      providerUserId: socialAccount.providerUserId,
      easyzpayUsername: socialAccount.user.username || null,
    });
  } catch (error) {
    console.error('[Resolve X] Error:', error);
    res.status(500).json({ error: 'Internal server error resolving X username' });
  }
});

// ==========================================
// 4. PAYOUTS BATCH ENGINE ROUTES
// ==========================================

// Validate a batch of recipients before execution
app.post('/api/payouts/batch/validate', async (req, res) => {
  try {
    const { recipients, sourceChain = 5042002 } = req.body;

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'Recipients array is required.' });
    }

    const validatedItems: any[] = [];
    const errors: string[] = [];
    const seenAddresses = new Map<string, number[]>(); // address -> indices

    let totalAmountBig = 0;

    for (let i = 0; i < recipients.length; i++) {
      const r = recipients[i];
      const rowNum = i + 1;
      const rawRecipient = (r.recipient || r.address || '').trim();
      const amountStr = (r.amount || '').toString().trim();
      const memo = r.memo || r.name || '';

      if (!rawRecipient) {
        errors.push(`Row ${rowNum}: Recipient is missing.`);
        continue;
      }

      const amtNum = parseFloat(amountStr);
      if (isNaN(amtNum) || amtNum <= 0) {
        errors.push(`Row ${rowNum}: Amount "${amountStr}" must be a positive number.`);
        continue;
      }

      totalAmountBig += amtNum;

      let resolvedAddr: string | null = null;
      let recipientType = 'wallet';
      let displayName = rawRecipient;

      // Case 1: 0x EVM Address
      if (isAddress(rawRecipient)) {
        resolvedAddr = rawRecipient.toLowerCase();
        recipientType = 'wallet';
      }
      // Case 2: X username (e.g. x/@ali or @x:ali)
      else if (rawRecipient.startsWith('x/') || r.recipientType === 'x') {
        const xHandle = rawRecipient.replace(/^x\//, '').replace('@', '').toLowerCase();
        const xAcc = await prisma.socialAccount.findFirst({
          where: { provider: 'x', username: xHandle },
          include: { user: true },
        });
        if (xAcc && xAcc.user) {
          resolvedAddr = xAcc.user.address.toLowerCase();
          recipientType = 'x';
          displayName = xAcc.displayName || `@${xAcc.username}`;
        } else {
          errors.push(`Row ${rowNum}: X user "@${xHandle}" has not connected EasyZPay.`);
          continue;
        }
      }
      // Case 3: EasyZPay username
      else {
        const cleanName = rawRecipient.replace('@', '').toLowerCase();
        const user = await prisma.user.findUnique({
          where: { username: cleanName },
        });
        if (user) {
          resolvedAddr = user.address.toLowerCase();
          recipientType = 'username';
          displayName = `@${cleanName}`;
        } else {
          // Check if it matches an X account directly
          const xAcc = await prisma.socialAccount.findFirst({
            where: { provider: 'x', username: cleanName },
            include: { user: true },
          });
          if (xAcc && xAcc.user) {
            resolvedAddr = xAcc.user.address.toLowerCase();
            recipientType = 'x';
            displayName = xAcc.displayName || `@${xAcc.username}`;
          } else {
            errors.push(`Row ${rowNum}: Recipient "@${cleanName}" not found on EasyZPay.`);
            continue;
          }
        }
      }

      if (resolvedAddr) {
        if (!seenAddresses.has(resolvedAddr)) {
          seenAddresses.set(resolvedAddr, []);
        }
        seenAddresses.get(resolvedAddr)!.push(rowNum);

        validatedItems.push({
          row: rowNum,
          recipientType,
          recipientIdentifier: rawRecipient,
          displayName,
          resolvedAddress: resolvedAddr,
          amount: amtNum.toFixed(2),
          memo,
        });
      }
    }

    // Find duplicates
    const duplicates: any[] = [];
    seenAddresses.forEach((rows, addr) => {
      if (rows.length > 1) {
        duplicates.push({
          address: addr,
          rows,
          count: rows.length,
        });
      }
    });

    res.json({
      valid: errors.length === 0,
      errors,
      duplicates,
      totalAmount: totalAmountBig.toFixed(2),
      itemCount: validatedItems.length,
      items: validatedItems,
    });
  } catch (error: any) {
    console.error('[Payout Validate] Error:', error);
    res.status(500).json({ error: 'Failed to validate payout batch' });
  }
});

// Create a Payout Batch
app.post('/api/payouts/batch/create', async (req, res) => {
  try {
    const {
      senderAddress,
      items,
      totalAmount,
      token = 'USDC',
      sourceChain = 5042002,
      idempotencyKey,
    } = req.body;

    if (!senderAddress || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'senderAddress and items are required.' });
    }

    if (idempotencyKey) {
      const existing = await prisma.payoutBatch.findUnique({
        where: { idempotencyKey },
        include: { items: true },
      });
      if (existing) {
        return res.json({ success: true, batch: existing, isExisting: true });
      }
    }

    // Ensure User exists
    let user = await prisma.user.findUnique({
      where: { address: senderAddress.toLowerCase() },
    });
    if (!user) {
      user = await prisma.user.create({
        data: { address: senderAddress.toLowerCase() },
      });
    }

    const batch = await prisma.payoutBatch.create({
      data: {
        userId: user.id,
        senderAddress: senderAddress.toLowerCase(),
        totalAmount: totalAmount.toString(),
        token,
        sourceChain: Number(sourceChain),
        status: 'READY',
        totalRecipients: items.length,
        completedCount: 0,
        failedCount: 0,
        idempotencyKey: idempotencyKey || undefined,
        items: {
          create: items.map((it: any) => ({
            recipientType: it.recipientType || 'wallet',
            recipientIdentifier: it.recipientIdentifier || it.recipient || it.address,
            recipientAddress: it.recipientAddress || it.resolvedAddress || it.address,
            amount: it.amount.toString(),
            destinationChain: it.destinationChain ? Number(it.destinationChain) : Number(sourceChain),
            memo: it.memo || '',
            status: 'PENDING',
          })),
        },
      },
      include: {
        items: true,
      },
    });

    res.json({ success: true, batch });
  } catch (error: any) {
    console.error('[Payout Batch Create] Error:', error);
    res.status(500).json({ error: 'Failed to create payout batch' });
  }
});

// Get all payout batches for an address
app.get('/api/payouts/batches/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const batches = await prisma.payoutBatch.findMany({
      where: { senderAddress: address.toLowerCase() },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(batches);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch payout batches' });
  }
});

// Get a single payout batch by ID
app.get('/api/payouts/batch/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const batch = await prisma.payoutBatch.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!batch) {
      return res.status(404).json({ error: 'Payout batch not found' });
    }
    res.json(batch);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch payout batch' });
  }
});

// Update an individual payout item
app.post('/api/payouts/batch/:id/update-item', async (req, res) => {
  try {
    const { id: batchId } = req.params;
    const { itemId, status, sourceTxHash, destinationTxHash, errorReason } = req.body;

    if (!itemId) {
      return res.status(400).json({ error: 'itemId is required' });
    }

    const item = await prisma.payoutItem.update({
      where: { id: itemId },
      data: {
        status: status || undefined,
        sourceTxHash: sourceTxHash || undefined,
        destinationTxHash: destinationTxHash || undefined,
        errorReason: errorReason || undefined,
      },
    });

    // Recompute batch counts and overall status
    const allItems = await prisma.payoutItem.findMany({ where: { batchId } });
    const completed = allItems.filter(i => i.status === 'COMPLETED').length;
    const failed = allItems.filter(i => i.status === 'FAILED').length;
    const total = allItems.length;

    let batchStatus = 'PROCESSING';
    if (completed === total) {
      batchStatus = 'COMPLETED';
    } else if (failed === total) {
      batchStatus = 'FAILED';
    } else if (completed > 0 && failed > 0) {
      batchStatus = 'PARTIALLY_COMPLETED';
    } else if (failed > 0 && completed === 0) {
      batchStatus = 'PARTIALLY_FAILED';
    }

    const batch = await prisma.payoutBatch.update({
      where: { id: batchId },
      data: {
        completedCount: completed,
        failedCount: failed,
        status: batchStatus,
      },
      include: { items: true },
    });

    res.json({ success: true, item, batch });
  } catch (error) {
    console.error('[Payout Update Item] Error:', error);
    res.status(500).json({ error: 'Failed to update payout item' });
  }
});

// Retry failed payout items in a batch
app.post('/api/payouts/batch/:id/retry-failed', async (req, res) => {
  try {
    const { id: batchId } = req.params;
    const batch = await prisma.payoutBatch.findUnique({
      where: { id: batchId },
      include: { items: true },
    });

    if (!batch) {
      return res.status(404).json({ error: 'Payout batch not found' });
    }

    const failedItems = batch.items.filter(i => i.status === 'FAILED');
    if (failedItems.length === 0) {
      return res.status(400).json({ error: 'No failed items found to retry in this batch.' });
    }

    // Reset failed items to PENDING with incremented retry count
    for (const item of failedItems) {
      await prisma.payoutItem.update({
        where: { id: item.id },
        data: {
          status: 'PENDING',
          retryCount: item.retryCount + 1,
          errorReason: null,
        },
      });
    }

    const updatedBatch = await prisma.payoutBatch.update({
      where: { id: batchId },
      data: {
        status: 'PROCESSING',
      },
      include: { items: true },
    });

    res.json({ success: true, retriedCount: failedItems.length, batch: updatedBatch });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retry failed payout items' });
  }
});

// ==========================================
// 5. PRODUCTION ANALYTICS
// ==========================================

app.get('/api/analytics', async (req, res) => {
  try {
    // Cross Pay stats
    const crossPayCount = await prisma.crossPay.count();
    const completedBridges = await prisma.crossPay.count({ where: { status: 'COMPLETED' } });
    const failedBridges = await prisma.crossPay.count({ where: { status: { in: ['VALIDATION_FAILED', 'SOURCE_FAILED', 'ATTESTATION_FAILED', 'DESTINATION_FAILED'] } } });

    const allCrossPays = await prisma.crossPay.findMany({ select: { amount: true, status: true } });
    const crossPayVolume = allCrossPays
      .filter(c => c.status === 'COMPLETED')
      .reduce((sum, c) => sum + parseFloat(c.amount || '0'), 0);

    // Payout batches stats
    const payoutBatchesCount = await prisma.payoutBatch.count();
    const allPayoutBatches = await prisma.payoutBatch.findMany({ select: { totalAmount: true, status: true } });
    const payoutVolume = allPayoutBatches
      .filter(b => b.status === 'COMPLETED' || b.status === 'PARTIALLY_COMPLETED')
      .reduce((sum, b) => sum + parseFloat(b.totalAmount || '0'), 0);

    const successfulPayoutItems = await prisma.payoutItem.count({ where: { status: 'COMPLETED' } });
    const failedPayoutItems = await prisma.payoutItem.count({ where: { status: 'FAILED' } });

    // X Social connections
    const xConnectedUsers = await prisma.socialAccount.count({ where: { provider: 'x' } });
    const xPaymentsCount = await prisma.payoutItem.count({ where: { recipientType: 'x', status: 'COMPLETED' } });

    res.json({
      crossPay: {
        volume: crossPayVolume.toFixed(2),
        transactions: crossPayCount,
        successfulBridges: completedBridges,
        failedBridges,
        averageCompletionTime: '2-4 mins (CCTP)',
      },
      payouts: {
        batches: payoutBatchesCount,
        volume: payoutVolume.toFixed(2),
        successfulPayouts: successfulPayoutItems,
        failedPayouts: failedPayoutItems,
      },
      social: {
        xConnectedUsers,
        xUsernamePayments: xPaymentsCount,
      },
    });
  } catch (error) {
    console.error('[Analytics] Error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// ==========================================
// 6. USER, RESOLVE & PAYMENT REQUEST ROUTES
// ==========================================

// Get user profile by address
app.get('/api/users/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const user = await prisma.user.findUnique({
      where: { address: address.toLowerCase() },
      include: { socialAccounts: true }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Resolve EasyZPay username to address
app.get('/api/resolve/:username', async (req, res) => {
  try {
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

    if (resolvedAddress && resolvedAddress !== '0x0000000000000000000000000000000000000000') {
      console.log(`[Resolve] Successfully resolved @${cleanUsername} to ${resolvedAddress} on-chain!`);
      await prisma.user.upsert({
        where: { address: (resolvedAddress as string).toLowerCase() },
        update: { username: cleanUsername },
        create: { address: (resolvedAddress as string).toLowerCase(), username: cleanUsername }
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
          { fromAddress: addrLower },
          { toAddress: addrLower }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(requests);
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
          status: 'Scheduled',
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

// Start Server
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  startIndexer();
  startSchedulerCron();
});
