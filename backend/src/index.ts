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

// Environment & Network configuration — single source of truth
const NETWORK_MODE: 'mainnet' | 'testnet' =
  (process.env.NETWORK_MODE || process.env.NEXT_PUBLIC_NETWORK || 'mainnet') === 'testnet'
    ? 'testnet'
    : 'mainnet';
const IS_MAINNET = NETWORK_MODE === 'mainnet';
const IRIS_API_URL = IS_MAINNET
  ? 'https://iris-api.circle.com'
  : 'https://iris-api-sandbox.circle.com';
const CHAIN_ID = IS_MAINNET ? 5042 : 5042002;
const RPC_URL = process.env.RPC_URL || (IS_MAINNET ? 'https://rpc.mainnet.arc.io' : 'https://rpc.testnet.arc.network');
const EXPLORER_URL = IS_MAINNET ? 'https://explorer.arc.io' : 'https://testnet.arcscan.app';
const REGISTRY_ADDRESS_BACKEND = IS_MAINNET
  ? (process.env.NEXT_PUBLIC_USERNAME_REGISTRY || '0x0D09b1348455540a6394c9d1Bf2F7C2b0cC40E6D')
  : (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS || '0x7182B6A65522dbb7ae88507F296Bdd65cdc1FFdB');

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
  const { sourceDomainId, transactionHash } = req.body;
  if (sourceDomainId === undefined || !transactionHash) {
    return res.status(400).json({ error: 'sourceDomainId and transactionHash are required' });
  }
  try {
    const url = `${IRIS_API_URL}/v2/messages/${sourceDomainId}?transactionHash=${transactionHash}`;
    const circleResponse = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!circleResponse.ok) {
      return res.json({ status: 'pending', attestation: null, message: null });
    }
    const data: any = await circleResponse.json();
    const msg = data.messages && data.messages[0];
    if (!msg) return res.json({ status: 'pending', attestation: null, message: null });
    return res.json({
      status: msg.status === 'complete' ? 'complete' : 'pending',
      attestation: msg.status === 'complete' ? msg.attestation : null,
      message: msg.message || null,
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

// ==========================================
// X OAUTH 2.0 ROUTES
// ==========================================
app.get('/api/social/x/auth', (req, res) => {
  const { address } = req.query;
  if (!address) return res.status(400).json({ error: 'Address required' });
  
  const clientId = process.env.X_CLIENT_ID || 'default_client_id';
  const redirectUri = process.env.X_REDIRECT_URI || 'http://localhost:3001/api/social/x/callback';
  const state = Buffer.from(JSON.stringify({ address })).toString('base64');
  const authUrl = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=tweet.read%20users.read&state=${state}&code_challenge=challenge&code_challenge_method=plain`;
  res.json({ url: authUrl });
});

app.get('/api/social/x/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) return res.status(400).send('Missing code or state');
    
    const { address } = JSON.parse(Buffer.from(state as string, 'base64').toString('utf-8'));
    
    const clientId = process.env.X_CLIENT_ID;
    const clientSecret = process.env.X_CLIENT_SECRET;
    const redirectUri = process.env.X_REDIRECT_URI || 'http://localhost:3001/api/social/x/callback';
    
    let providerUserId = '';
    let xUsername = '';
    let displayName = '';
    let avatar = '';

    if (clientSecret) {
      const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
        },
        body: new URLSearchParams({
          code: code as string,
          grant_type: 'authorization_code',
          client_id: clientId as string,
          redirect_uri: redirectUri,
          code_verifier: 'challenge'
        })
      });
      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) throw new Error('Failed to get access token');

      const userRes = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
      });
      const userData = await userRes.json();
      providerUserId = userData.data.id;
      xUsername = userData.data.username;
      displayName = userData.data.name;
      avatar = userData.data.profile_image_url;
    } else {
      xUsername = 'testuser' + Math.floor(Math.random() * 1000);
      providerUserId = 'mock_' + xUsername;
      displayName = 'Test User';
      avatar = 'https://unavatar.io/twitter/jack';
    }

    const user = await prisma.user.upsert({
      where: { address: address.toLowerCase() },
      update: {},
      create: { address: address.toLowerCase() }
    });

    await prisma.socialAccount.upsert({
      where: { provider_providerUserId: { provider: 'x', providerUserId } },
      update: { userId: user.id, username: xUsername.toLowerCase(), displayName, avatar },
      create: { userId: user.id, provider: 'x', providerUserId, username: xUsername.toLowerCase(), displayName, avatar }
    });

    res.redirect('http://localhost:3000/profile?x_connected=true');
  } catch (error) {
    console.error('X OAuth callback error:', error);
    res.redirect('http://localhost:3000/profile?x_error=true');
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

// Resolve EasyZPay username or connected X handle to address
app.get('/api/resolve/:username', async (req, res) => {
  try {
    let { username } = req.params;
    let isXLookup = false;

    if (username.startsWith('@')) {
      username = username.substring(1);
    }
    if (username.toLowerCase().startsWith('x:') || username.toLowerCase().startsWith('x/')) {
      isXLookup = true;
      username = username.substring(2);
      if (username.startsWith('@')) username = username.substring(1);
    }

    const cleanUsername = username.toLowerCase().trim();

    // 1. Direct X username lookup if explicitly requested
    if (isXLookup) {
      const socialAccount = await prisma.socialAccount.findFirst({
        where: { provider: 'x', username: cleanUsername },
        include: { user: true }
      });
      if (socialAccount && socialAccount.user?.address) {
        return res.json({
          found: true,
          registered: true,
          type: 'x',
          address: socialAccount.user.address,
          walletAddress: socialAccount.user.address,
          xUsername: socialAccount.username,
          displayName: socialAccount.displayName || `@${socialAccount.username}`,
          avatar: socialAccount.avatar
        });
      }
      return res.status(404).json({
        found: false,
        registered: false,
        type: 'x',
        xUsername: cleanUsername,
        error: `X user @${cleanUsername} is not connected to EasyZPay`
      });
    }

    // 2. Try EasyZPay database lookup first
    const user = await prisma.user.findUnique({
      where: { username: cleanUsername },
      include: { socialAccounts: true }
    });
    
    if (user && user.address) {
      const xAcc = user.socialAccounts.find(a => a.provider === 'x');
      return res.json({
        found: true,
        registered: true,
        type: 'easyzpay',
        address: user.address,
        walletAddress: user.address,
        username: user.username,
        xUsername: xAcc?.username || null,
        displayName: xAcc?.displayName || (user.username ? `@${user.username}` : user.address),
        avatar: xAcc?.avatar || null
      });
    }

    // 3. Fallback to querying the blockchain directly
    console.log(`[Resolve] Username @${cleanUsername} not in DB, querying on-chain registry...`);
    try {
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

      if (resolvedAddress && resolvedAddress !== '0x0000000000000000000000000000000000000000' && isAddress(resolvedAddress)) {
        console.log(`[Resolve] Successfully resolved @${cleanUsername} to ${resolvedAddress} on-chain!`);
        await prisma.user.upsert({
          where: { address: (resolvedAddress as string).toLowerCase() },
          update: { username: cleanUsername },
          create: { address: (resolvedAddress as string).toLowerCase(), username: cleanUsername }
        });
        return res.json({
          found: true,
          registered: true,
          type: 'easyzpay',
          address: resolvedAddress,
          walletAddress: resolvedAddress,
          username: cleanUsername,
          displayName: `@${cleanUsername}`
        });
      }
    } catch (onChainErr) {
      console.warn('[Resolve] On-chain readContract failed:', onChainErr);
    }

    // 4. Fallback: check if matches any connected X handle
    const fallbackSocial = await prisma.socialAccount.findFirst({
      where: { provider: 'x', username: cleanUsername },
      include: { user: true }
    });
    if (fallbackSocial && fallbackSocial.user?.address) {
      return res.json({
        found: true,
        registered: true,
        type: 'x',
        address: fallbackSocial.user.address,
        walletAddress: fallbackSocial.user.address,
        xUsername: fallbackSocial.username,
        displayName: fallbackSocial.displayName || `@${fallbackSocial.username}`,
        avatar: fallbackSocial.avatar
      });
    }
    
    return res.status(404).json({ found: false, registered: false, error: 'Username not found' });
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
    
    const enriched = transactions.map((tx: any) => ({
      ...tx,
      explorerUrl: tx.explorerUrl || `https://testnet.arcscan.app/tx/${tx.txHash}`,
      type: tx.type || 'SEND',
      token: tx.token || 'USDC',
      chainId: tx.chainId || 5042002,
    }));
    
    res.json(enriched);
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
// BLOCKCHAIN EVENT INDEXER (PRODUCTION ARC MAINNET / TESTNET)
// ─────────────────────────────────────────────────────────────────────────────

const IS_MAINNET = (process.env.NETWORK_MODE || process.env.NEXT_PUBLIC_NETWORK || 'mainnet') === 'mainnet';
const CHAIN_ID = IS_MAINNET ? 5042 : 5042002;
const RPC_URL = process.env.RPC_URL || process.env.NEXT_PUBLIC_ARC_RPC_URL || (IS_MAINNET ? 'https://rpc.mainnet.arc.io' : 'https://rpc.testnet.arc.network');
const EXPLORER_URL = IS_MAINNET ? 'https://explorer.arc.io' : 'https://testnet.arcscan.app';
const START_BLOCK = process.env.START_BLOCK ? BigInt(process.env.START_BLOCK) : (IS_MAINNET ? 1n : 44800000n);

const REGISTRY_ADDRESS = (process.env.NEXT_PUBLIC_USERNAME_REGISTRY || process.env.REGISTRY_ADDRESS || '0x1000000000000000000000000000000000000001') as `0x${string}`;
const ROUTER_ADDRESS = (process.env.NEXT_PUBLIC_PAYMENT_ROUTER || process.env.ROUTER_ADDRESS || '0x2000000000000000000000000000000000000002') as `0x${string}`;
const BULK_ROUTER_ADDRESS = (process.env.BULK_ROUTER_ADDRESS || '0xB1a346132F5eC1Ad7CC8A84DE33A2763d13110B4') as `0x${string}`;
const BOUNTY_ESCROW_ADDRESS = (process.env.NEXT_PUBLIC_BOUNTY_ESCROW || process.env.BOUNTY_ESCROW_ADDRESS || '0x3000000000000000000000000000000000000003') as `0x${string}`;

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
          { name: 'owner', type: 'address', indexed: true },
          { name: 'username', type: 'string', indexed: false }
        ]
      },
      fromBlock,
      toBlock
    });

    for (const log of logs) {
      const { transactionHash } = log;
      if (!transactionHash) continue;
      
      const userAddress = log.args.owner?.toLowerCase();
      const rawUsername = log.args.username;
      const username = rawUsername?.toLowerCase().trim().replace('@', '');
      
      if (username && userAddress) {
        console.log(`[Indexer] Registry Sync: @${username} registered to ${userAddress} in tx ${transactionHash}`);
        await prisma.user.upsert({
          where: { address: userAddress },
          update: { username },
          create: { address: userAddress, username }
        });
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
            token: 'USDC',
            chainId: CHAIN_ID,
            type: 'SEND',
            status: 'COMPLETED',
            blockNumber: Number(blockNumber),
            explorerUrl: `${EXPLORER_URL}/tx/${transactionHash}`,
            timestamp,
            confirmedAt: timestamp
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

async function indexBounties(fromBlock: bigint, toBlock: bigint) {
  try {
    // 1. BountyFunded event
    const fundedLogs = await viemClient.getLogs({
      address: BOUNTY_ESCROW_ADDRESS,
      event: {
        type: 'event',
        name: 'BountyFunded',
        inputs: [
          { name: 'bountyId', type: 'bytes32', indexed: true },
          { name: 'creator', type: 'address', indexed: true },
          { name: 'amount', type: 'uint256', indexed: false },
          { name: 'deadline', type: 'uint256', indexed: false }
        ]
      },
      fromBlock,
      toBlock
    });

    for (const log of fundedLogs) {
      const { transactionHash, blockNumber } = log;
      const bHash = log.args.bountyId?.toLowerCase();
      const creator = log.args.creator?.toLowerCase();
      const amount = log.args.amount ? log.args.amount.toString() : '0';

      if (!bHash || !creator) continue;
      console.log(`[Indexer] Bounty Escrow Funded: hash=${bHash}, amount=${amount} in tx ${transactionHash}`);

      const timestamp = await getBlockTimestamp(blockNumber!);

      // Update matching bounty record if present
      await prisma.bounty.updateMany({
        where: {
          OR: [
            { bountyHash: bHash },
            { creatorAddress: creator, escrowStatus: 'UNFUNDED' }
          ]
        },
        data: {
          bountyHash: bHash,
          escrowStatus: 'FUNDED',
          status: 'OPEN',
          fundTxHash: transactionHash
        }
      });
    }

    // 2. RewardReleased event
    const releasedLogs = await viemClient.getLogs({
      address: BOUNTY_ESCROW_ADDRESS,
      event: {
        type: 'event',
        name: 'RewardReleased',
        inputs: [
          { name: 'bountyId', type: 'bytes32', indexed: true },
          { name: 'winner', type: 'address', indexed: true },
          { name: 'amount', type: 'uint256', indexed: false }
        ]
      },
      fromBlock,
      toBlock
    });

    for (const log of releasedLogs) {
      const { transactionHash, blockNumber } = log;
      const bHash = log.args.bountyId?.toLowerCase();
      const winner = log.args.winner?.toLowerCase();
      const amount = log.args.amount ? log.args.amount.toString() : '0';

      if (!bHash || !winner) continue;
      console.log(`[Indexer] Bounty Prize Released: hash=${bHash}, winner=${winner} in tx ${transactionHash}`);

      const timestamp = await getBlockTimestamp(blockNumber!);

      await prisma.bounty.updateMany({
        where: { bountyHash: bHash },
        data: {
          escrowStatus: 'PAID',
          status: 'COMPLETED',
          winnerAddress: winner,
          rewardTxHash: transactionHash
        }
      });

      // Record in unified transaction history
      const exists = await prisma.transaction.findFirst({
        where: { txHash: transactionHash, toAddress: winner }
      });
      if (!exists) {
        await prisma.transaction.create({
          data: {
            txHash: transactionHash,
            fromAddress: BOUNTY_ESCROW_ADDRESS.toLowerCase(),
            toAddress: winner,
            amount,
            memo: 'Bounty Reward Paid',
            token: 'USDC',
            chainId: CHAIN_ID,
            type: 'BOUNTY',
            status: 'COMPLETED',
            blockNumber: Number(blockNumber),
            explorerUrl: `${EXPLORER_URL}/tx/${transactionHash}`,
            timestamp,
            confirmedAt: timestamp
          }
        });
      }
    }
  } catch (err) {
    console.error(`[Indexer] Error fetching bounty escrow logs:`, err);
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
          await indexBounties(currentFrom, currentTo);
          
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

const keeperChain = defineChain({
  id: CHAIN_ID,
  name: IS_MAINNET ? 'Arc Mainnet' : 'Arc Testnet',
  network: IS_MAINNET ? 'arc_mainnet' : 'arc_testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

const KEEPER_PK = process.env.KEEPER_PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000000';
const SCHEDULER_ADDRESS = process.env.SCHEDULER_ADDRESS as `0x${string}`;

const keeperAccount = privateKeyToAccount(KEEPER_PK as `0x${string}`);
const keeperWalletClient = createWalletClient({
  account: keeperAccount,
  chain: keeperChain,
  transport: http(RPC_URL),
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

// ==========================================
// PARTY ROUTES
// ==========================================
app.post('/api/party', async (req, res) => {
  try {
    const { name, creatorAddress, splitType, totalAmount, participants } = req.body;
    if (!name || !creatorAddress || !totalAmount || !participants?.length) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const party = await prisma.party.create({
      data: {
        name, creatorAddress: creatorAddress.toLowerCase(), splitType: splitType || 'equal',
        totalAmount, status: 'ACTIVE',
        participants: { create: participants.map((p: any) => ({ identifier: p.identifier, resolvedAddress: p.resolvedAddress || null, amount: p.amount, status: 'PENDING' })) }
      },
      include: { participants: true }
    });
    res.json(party);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/party/:id', async (req, res) => {
  try {
    const party = await prisma.party.findUnique({ where: { id: req.params.id }, include: { participants: true } });
    if (!party) return res.status(404).json({ error: 'Not found' });
    res.json(party);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/party/user/:address', async (req, res) => {
  try {
    const parties = await prisma.party.findMany({ where: { creatorAddress: req.params.address.toLowerCase() }, include: { participants: true }, orderBy: { createdAt: 'desc' } });
    res.json(parties);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/party/:id/pay', async (req, res) => {
  try {
    const { participantId, txHash } = req.body;
    const updated = await prisma.partyParticipant.update({ where: { id: participantId }, data: { status: 'PAID', txHash } });
    const allParts = await prisma.partyParticipant.findMany({ where: { partyId: req.params.id } });
    if (allParts.every((p: any) => p.status === 'PAID')) {
      await prisma.party.update({ where: { id: req.params.id }, data: { status: 'COMPLETED' } });
    }
    res.json(updated);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// BOUNTY ROUTES (ON-CHAIN ESCROW MARKETPLACE)
// ==========================================
app.post('/api/bounties', async (req, res) => {
  try {
    const { 
      title, 
      description, 
      creatorAddress, 
      prizeAmount, 
      tasks, 
      deadline, 
      requirements, 
      category, 
      difficulty,
      bountyHash 
    } = req.body;

    if (!title || !creatorAddress || !prizeAmount) {
      return res.status(400).json({ error: 'Missing required fields: title, creatorAddress, prizeAmount' });
    }

    const bounty = await prisma.bounty.create({ 
      data: { 
        title, 
        description: description || '', 
        creatorAddress: creatorAddress.toLowerCase(), 
        prizeAmount: prizeAmount.toString(),
        tasks: typeof tasks === 'string' ? tasks : JSON.stringify(tasks || []),
        deadline: deadline ? new Date(deadline) : null,
        requirements: typeof requirements === 'string' ? requirements : JSON.stringify(requirements || []),
        category: category || 'General',
        difficulty: difficulty || 'Medium',
        bountyHash: bountyHash || null,
        status: 'OPEN',
        escrowStatus: 'UNFUNDED'
      } 
    });
    res.json(bounty);
  } catch (e: any) { 
    console.error('[Create Bounty] Error:', e);
    res.status(500).json({ error: e.message }); 
  }
});

app.get('/api/bounties', async (req, res) => {
  try {
    const bounties = await prisma.bounty.findMany({ 
      include: { submissions: true }, 
      orderBy: { createdAt: 'desc' } 
    });
    res.json(bounties);
  } catch (e: any) { 
    res.status(500).json({ error: e.message }); 
  }
});

app.get('/api/bounties/:id', async (req, res) => {
  try {
    const bounty = await prisma.bounty.findUnique({ 
      where: { id: req.params.id }, 
      include: { submissions: true } 
    });
    if (!bounty) return res.status(404).json({ error: 'Bounty not found' });
    res.json(bounty);
  } catch (e: any) { 
    res.status(500).json({ error: e.message }); 
  }
});

app.post('/api/bounties/:id/fund', async (req, res) => {
  try {
    const { txHash, bountyHash } = req.body;
    const bounty = await prisma.bounty.update({ 
      where: { id: req.params.id }, 
      data: { 
        fundTxHash: txHash,
        bountyHash: bountyHash || undefined,
        escrowStatus: 'FUNDED',
        status: 'OPEN'
      } 
    });
    res.json(bounty);
  } catch (e: any) { 
    res.status(500).json({ error: e.message }); 
  }
});

app.post('/api/bounties/:id/submit', async (req, res) => {
  try {
    const { submitterAddress, content, links } = req.body;
    if (!submitterAddress || !content) {
      return res.status(400).json({ error: 'Missing required submitterAddress or content' });
    }
    const sub = await prisma.bountySubmission.create({ 
      data: { 
        bountyId: req.params.id, 
        submitterAddress: submitterAddress.toLowerCase(), 
        content,
        links: links ? (typeof links === 'string' ? links : JSON.stringify(links)) : null,
        status: 'PENDING'
      } 
    });
    res.json(sub);
  } catch (e: any) { 
    res.status(500).json({ error: e.message }); 
  }
});

app.post('/api/bounties/:id/select-winner', async (req, res) => {
  try {
    const { submissionId, rewardAmount, rewardTxHash, winnerAddress } = req.body;
    await prisma.bountySubmission.update({ 
      where: { id: submissionId }, 
      data: { status: 'WINNER', rewardAmount, rewardTxHash } 
    });
    const bounty = await prisma.bounty.update({ 
      where: { id: req.params.id }, 
      data: { 
        status: 'COMPLETED',
        escrowStatus: 'PAID',
        winnerAddress: winnerAddress?.toLowerCase() || null,
        rewardTxHash 
      } 
    });
    res.json({ success: true, bounty });
  } catch (e: any) { 
    res.status(500).json({ error: e.message }); 
  }
});

app.post('/api/bounties/:id/cancel', async (req, res) => {
  try {
    const { refundTxHash } = req.body;
    const bounty = await prisma.bounty.update({
      where: { id: req.params.id },
      data: {
        status: 'CANCELLED',
        escrowStatus: 'REFUNDED',
        refundTxHash: refundTxHash || null
      }
    });
    res.json({ success: true, bounty });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  startIndexer();
  startSchedulerCron();
});
