import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import dotenv from 'dotenv';
import { WhatsAppAIAgent } from './aiAgent';
import { generatePairingToken, encryptPrivateKey } from './crypto';

dotenv.config();

// Use local SQLite database for instant, deterministic testing
const dbUrl = 'file:./dev.db';
const adapter = new PrismaLibSql({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

async function runTests() {
  console.log('====================================================');
  console.log('🧪 Testing Easyzpay Chat-to-Pay Phase 2 & Phase 3');
  console.log('====================================================');

  const agent = new WhatsAppAIAgent(prisma);
  const testPhone = '+15559876543';

  // 1. Create a Session with $50.00 USDC limit, valid for 7 days
  console.log('\n[Test 1] Generating Time-Sensitive Pairing Session...');
  const pairingToken = generatePairingToken();
  const sessionPrivateKey = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const encryptedKey = encryptPrivateKey(sessionPrivateKey);

  const session = await prisma.whatsAppSession.create({
    data: {
      pairingToken,
      pairingTokenExpiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      smartAccountAddress: '0x1C1F89F6Cc9b65eddE36D9F7fbd0222D53A158d6',
      ownerAddress: '0xB8e9C9659677511Be855A8582c028F3ae6d108D4',
      sessionPublicKey: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      sessionPrivateKeyEncrypted: encryptedKey,
      spendingLimit: '50.0',
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'PENDING_PAIRING',
    },
  });

  console.log(`✓ Session Created. Pairing Token: ${pairingToken}`);

  // 2. Pair phone with pairing token
  console.log('\n[Test 2] Binding WhatsApp Phone ID with Pairing Token...');
  const pairReply = await agent.handleIncomingMessage(testPhone, `PAIR ${pairingToken}`);
  console.log(`Bot Response:\n${pairReply}`);

  if (!pairReply.includes('Chat-to-Pay Connected')) {
    throw new Error('Pairing failed');
  }
  console.log('✓ Phone successfully paired!');

  // 3. Test Unsupported Name Service Rejection (.eth, .sol, .lens, etc.)
  console.log('\n[Test 3] Testing Strict Rejection of Unsupported Name Services (e.g. vitalik.eth)...');
  const ethReply = await agent.handleIncomingMessage(testPhone, 'Pay 5 USDC to vitalik.eth');
  console.log(`Bot Response:\n${ethReply}`);

  if (!ethReply.includes('Unsupported Name Service')) {
    throw new Error('Failed to reject .eth name service');
  }
  console.log('✓ Third-party name service correctly rejected!');

  // 4. Test Payment to Raw 0x Wallet Address & Two-Step Confirmation
  console.log('\n[Test 4] Testing Payment Intent with Raw 0x Wallet Address & Step 1 Confirmation...');
  const rawAddress = '0x1C1F89F6Cc9b65eddE36D9F7fbd0222D53A158d6';
  const payReply = await agent.handleIncomingMessage(testPhone, `Pay 5 USDC to ${rawAddress}`);
  console.log(`Bot Response:\n${payReply}`);

  if (!payReply.includes('Payment Confirmation') || !payReply.includes('Reply *YES*')) {
    throw new Error('Two-step confirmation prompt missing');
  }
  console.log('✓ Step 1 confirmation prompt generated!');

  // 5. Test Two-Step Confirmation Step 2: User confirms with "YES"
  console.log('\n[Test 5] Testing User Confirmation (Reply "YES") & Relayer Execution...');
  const confirmReply = await agent.handleIncomingMessage(testPhone, 'YES');
  console.log(`Bot Response:\n${confirmReply}`);

  if (!confirmReply.includes('Payment Successful') || !confirmReply.includes('explorer.arc.io')) {
    throw new Error('Payment confirmation failed or explorer link missing');
  }
  console.log('✓ Payment executed and verified on Arc Explorer link!');

  // 6. Test Spending Limit Enforcement
  console.log('\n[Test 6] Testing Spending Limit Enforcement (Attempting $60 when limit is $50)...');
  const exceedReply = await agent.handleIncomingMessage(testPhone, `Send 60 USDC to ${rawAddress}`);
  console.log(`Bot Response:\n${exceedReply}`);

  if (!exceedReply.includes('Spending Limit Exceeded')) {
    throw new Error('Spending limit check failed to trigger');
  }
  console.log('✓ Spending limit cap correctly enforced!');

  // 7. Test Two-Step Cancellation with "NO"
  console.log('\n[Test 7] Testing Two-Step Cancellation (Reply "NO")...');
  await agent.handleIncomingMessage(testPhone, `Pay 2.5 USDC to ${rawAddress}`);
  const cancelReply = await agent.handleIncomingMessage(testPhone, 'NO');
  console.log(`Bot Response:\n${cancelReply}`);

  if (!cancelReply.includes('Payment Cancelled')) {
    throw new Error('Payment cancellation failed');
  }
  console.log('✓ Payment cancellation verified!');

  console.log('\n====================================================');
  console.log('🎉 ALL CHAT-TO-PAY INTEGRATION TESTS PASSED!');
  console.log('====================================================\n');

  // Clean up test records
  await prisma.chatPaymentIntent.deleteMany({ where: { phoneId: testPhone } });
  await prisma.whatsAppSession.deleteMany({ where: { id: session.id } });
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
