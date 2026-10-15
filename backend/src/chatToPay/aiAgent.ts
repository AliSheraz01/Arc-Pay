import { PrismaClient } from '@prisma/client';
import { createPublicClient, http, isAddress } from 'viem';
import { PaymentIntentParsed } from './types';
import { ChatToPayRelayer } from './relayer';

const RPC_URL = process.env.RPC_URL || 'https://rpc.mainnet.arc.io';
const REGISTRY_ADDRESS = (process.env.REGISTRY_ADDRESS || '0x0D09b1348455540a6394c9d1Bf2F7C2b0cC40E6D') as `0x${string}`;

const publicClient = createPublicClient({
  transport: http(RPC_URL),
});

// ArcPayUsernameRegistry ABI
const REGISTRY_ABI = [
  {
    type: 'function',
    name: 'resolveUsername',
    inputs: [{ name: '_username', type: 'string' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
] as const;

export class WhatsAppAIAgent {
  private prisma: PrismaClient;
  private relayer: ChatToPayRelayer;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.relayer = new ChatToPayRelayer(prisma);
  }

  /**
   * Main entry point for incoming WhatsApp messages
   */
  async handleIncomingMessage(phoneId: string, messageText: string): Promise<string> {
    const trimmed = messageText.trim();
    const upper = trimmed.toUpperCase();

    // 1. Handle Pairing Command: "PAIR <TOKEN>"
    if (upper.startsWith('PAIR')) {
      const parts = trimmed.split(/\s+/);
      const token = parts[1]?.toUpperCase();
      if (!token) {
        return '⚠️ Please provide your pairing code. Example: *PAIR ARC-8492*';
      }
      return this.handlePairing(phoneId, token);
    }

    // 2. Look up active user session
    const session = await this.prisma.whatsAppSession.findFirst({
      where: { phoneId, status: 'PAIRED' },
    });

    if (!session) {
      return (
        '👋 *Welcome to Easyzpay Chat-to-Pay on Arc Chain!*\n\n' +
        'Your WhatsApp is not yet paired with an Easyzpay Smart Account.\n\n' +
        '👉 Please visit https://easyzpay.xyz, click *"Connect WhatsApp"*, and send: *PAIR <CODE>*\n' +
        'Example: *PAIR ARC-8492*'
      );
    }

    // Check if session has expired
    if (new Date() > new Date(session.validUntil)) {
      await this.prisma.whatsAppSession.update({
        where: { id: session.id },
        data: { status: 'EXPIRED' },
      });
      return (
        '⏳ *Session Expired:*\n' +
        'Your delegated Chat-to-Pay session has reached its expiry limit.\n' +
        'Please renew your session on https://easyzpay.xyz to continue sending payments.'
      );
    }

    // 3. Handle Confirmation Step (Two-step confirmation)
    const pendingIntent = await this.prisma.chatPaymentIntent.findFirst({
      where: {
        phoneId,
        status: 'AWAITING_CONFIRMATION',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (pendingIntent) {
      if (['YES', 'CONFIRM', 'Y', 'APPROVE', 'PAY', 'HAAN', 'OK', 'OKAY'].includes(upper)) {
        // Execute transaction via relayer
        await this.prisma.chatPaymentIntent.update({
          where: { id: pendingIntent.id },
          data: { status: 'CONFIRMED' },
        });

        const execution = await this.relayer.executePayment(pendingIntent.id);

        if (execution.success) {
          return (
            `✅ *Payment Successful!*\n\n` +
            `💸 *Amount:* ${pendingIntent.amount} USDC\n` +
            `👤 *Recipient:* ${pendingIntent.recipientInput}\n` +
            `⛽ *Network:* Arc Mainnet\n` +
            `🔗 *Arc Explorer:*\n${execution.explorerUrl}\n\n` +
            `💳 *Remaining Session Allowance:* ${execution.remainingAllowance} USDC`
          );
        } else {
          return `❌ *Payment Execution Failed:*\n${execution.error || 'Network error on Arc Chain'}`;
        }
      } else if (['NO', 'CANCEL', 'N', 'NAHI', 'REJECT', 'STOP'].includes(upper)) {
        await this.prisma.chatPaymentIntent.update({
          where: { id: pendingIntent.id },
          data: { status: 'REJECTED' },
        });
        return (
          `🚫 *Payment Cancelled:*\n` +
          `Your payment of ${pendingIntent.amount} USDC to ${pendingIntent.recipientInput} was cancelled. No funds were transferred.`
        );
      }
    }

    // 4. Parse message using Natural Language Understanding & Intent Extraction
    const parseResult = await this.parsePaymentIntent(trimmed);

    if (parseResult.success === false) {
      return parseResult.errorResponse;
    }

    const { intent } = parseResult;

    // 5. Validate intent against Session Key limits
    const transferAmount = parseFloat(intent.amount);
    const alreadySpent = parseFloat(session.spentAmount || '0');
    const spendingLimit = parseFloat(session.spendingLimit);

    if (alreadySpent + transferAmount > spendingLimit) {
      const remaining = Math.max(0, spendingLimit - alreadySpent).toFixed(2);
      return (
        `⚠️ *Spending Limit Exceeded:*\n\n` +
        `Requested: *${transferAmount} USDC*\n` +
        `Remaining Session Allowance: *${remaining} USDC*\n` +
        `Total Session Cap: *${spendingLimit} USDC*\n\n` +
        `Please adjust the amount or increase your spending limit on https://easyzpay.xyz.`
      );
    }

    // 6. Create Pending Payment Intent with 2-minute expiry (Two-step confirmation requirement)
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes

    await this.prisma.chatPaymentIntent.create({
      data: {
        phoneId,
        sessionId: session.id,
        rawMessage: trimmed,
        action: intent.action,
        amount: intent.amount,
        asset: intent.asset,
        recipientInput: intent.recipientInput,
        recipientType: intent.recipientType,
        resolvedAddress: intent.resolvedAddress,
        status: 'AWAITING_CONFIRMATION',
        expiresAt,
      },
    });

    const remainingAfter = (spendingLimit - (alreadySpent + transferAmount)).toFixed(2);
    const shortAddress = `${intent.resolvedAddress.slice(0, 6)}...${intent.resolvedAddress.slice(-4)}`;

    return (
      `💳 *Easyzpay Payment Confirmation*\n\n` +
      `💸 *Amount:* ${parseFloat(intent.amount).toFixed(2)} USDC\n` +
      `👤 *Recipient:* ${intent.recipientInput} (${shortAddress})\n` +
      `⛽ *Network:* Arc Mainnet (Gasless)\n` +
      `🛡️ *Remaining Allowance After:* ${remainingAfter} USDC\n\n` +
      `👉 Reply *YES* or *CONFIRM* to broadcast this payment.\n` +
      `👉 Reply *NO* to cancel.\n\n` +
      `_(Expires in 2 minutes)_`
    );
  }

  /**
   * Binds a WhatsApp phone number with an authenticated Session Key using a pairing token
   */
  async handlePairing(phoneId: string, pairingToken: string): Promise<string> {
    const session = await this.prisma.whatsAppSession.findUnique({
      where: { pairingToken },
    });

    if (!session) {
      return '❌ *Invalid Pairing Token:* No matching session found. Please generate a new code at https://easyzpay.xyz.';
    }

    if (session.status === 'PAIRED') {
      return 'ℹ️ *Already Paired:* This session is already active. You can start sending payments anytime!';
    }

    if (new Date() > new Date(session.pairingTokenExpiresAt)) {
      await this.prisma.whatsAppSession.update({
        where: { id: session.id },
        data: { status: 'EXPIRED' },
      });
      return '⏳ *Pairing Token Expired:* Please generate a fresh pairing token on https://easyzpay.xyz.';
    }

    // Securely bind the WhatsApp Phone ID with the authenticated session
    await this.prisma.whatsAppSession.update({
      where: { id: session.id },
      data: {
        phoneId,
        status: 'PAIRED',
      },
    });

    const expiryFormatted = new Date(session.validUntil).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    return (
      `🎉 *Easyzpay Chat-to-Pay Connected!*\n\n` +
      `🛡️ *Account:* \`${session.smartAccountAddress.slice(0, 6)}...${session.smartAccountAddress.slice(-4)}\`\n` +
      `💰 *Spending Limit:* ${session.spendingLimit} USDC\n` +
      `📅 *Valid Until:* ${expiryFormatted}\n\n` +
      `*How to Send Payments:*\n` +
      `Simply text:\n` +
      `• *Pay 5 USDC to @username*\n` +
      `• *Send 10 to 0x742d...44e*\n` +
      `• *Transfer $2.5 to @alisheraz*`
    );
  }

  /**
   * Parses natural language payment messages with strict recipient validation
   */
  async parsePaymentIntent(
    message: string
  ): Promise<{ success: true; intent: PaymentIntentParsed } | { success: false; errorResponse: string }> {
    // Regex matching payment patterns (e.g. "Pay 5 USDC to @alice", "Send $10 to 0x123", "Transfer 2.5 usdc to @bob")
    const paymentRegex = /(?:pay|send|transfer|bhej\s+do|give)\s+(?:\$)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:usdc|usd|\$)?\s+(?:to|ko)?\s*([@a-zA-Z0-9_.-]+)/i;
    
    // Also support reversed format: "@alice ko 5 usdc bhej do"
    const reversedRegex = /([@a-zA-Z0-9_.-]+)\s+(?:ko|to)\s+(?:\$)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:usdc|usd|\$)?/i;

    let amountStr: string | null = null;
    let recipientRaw: string | null = null;

    const matchNormal = message.match(paymentRegex);
    if (matchNormal) {
      amountStr = matchNormal[1];
      recipientRaw = matchNormal[2];
    } else {
      const matchReversed = message.match(reversedRegex);
      if (matchReversed) {
        recipientRaw = matchReversed[1];
        amountStr = matchReversed[2];
      }
    }

    if (!amountStr || !recipientRaw) {
      return {
        success: false,
        errorResponse:
          `❓ *Could not understand payment request.*\n\n` +
          `Please use one of the following formats:\n` +
          `• *Pay 5 USDC to @username*\n` +
          `• *Send 10 to 0x1234...abcd*\n` +
          `• *Transfer $2.5 to @alisheraz*`,
      };
    }

    const amountNum = parseFloat(amountStr);
    if (isNaN(amountNum) || amountNum <= 0) {
      return {
        success: false,
        errorResponse: '❌ *Invalid Amount:* Please specify an amount greater than 0 USDC.',
      };
    }

    // ==============================================================
    // STRICT RECIPIENT VALIDATION REQUIREMENT:
    // "The recipient must be strictly validated as either an Easyzpay
    // registered username or a raw wallet address. The agent must
    // reject any other name services."
    // ==============================================================

    // Check 1: Explicitly reject any other name services (.eth, .lens, .sol, .arc, .crypto, etc.)
    const unsupportedNameServices = /\.(eth|lens|sol|arc|crypto|nft|wallet|x|dao|base|bnb|avax)$/i;
    if (unsupportedNameServices.test(recipientRaw)) {
      return {
        success: false,
        errorResponse:
          `❌ *Unsupported Name Service:*\n` +
          `Easyzpay Chat-to-Pay strictly accepts registered Easyzpay usernames (e.g. *@alisheraz*) or raw 0x wallet addresses.\n` +
          `Third-party name services (\`${recipientRaw}\`) are not supported for security reasons.`,
      };
    }

    // Check 2: Raw Ethereum/Arc wallet address (0x...)
    if (isAddress(recipientRaw)) {
      return {
        success: true,
        intent: {
          action: 'PAY',
          amount: amountStr,
          asset: 'USDC',
          recipientInput: recipientRaw,
          recipientType: 'WALLET',
          resolvedAddress: recipientRaw,
        },
      };
    }

    // Check 3: Easyzpay registered username (starts with @ or standard 3-30 character string)
    const usernameClean = recipientRaw.replace(/^@/, '').toLowerCase();
    const usernameValidFormat = /^[a-z0-9_]{3,30}$/.test(usernameClean);

    if (usernameValidFormat) {
      try {
        // Resolve on-chain via ArcPayUsernameRegistry
        const resolved = await (publicClient as any).readContract({
          address: REGISTRY_ADDRESS,
          abi: REGISTRY_ABI,
          functionName: 'resolveUsername',
          args: [usernameClean],
        });

        if (resolved && resolved !== '0x0000000000000000000000000000000000000000') {
          return {
            success: true,
            intent: {
              action: 'PAY',
              amount: amountStr,
              asset: 'USDC',
              recipientInput: `@${usernameClean}`,
              recipientType: 'USERNAME',
              resolvedAddress: resolved,
            },
          };
        } else {
          return {
            success: false,
            errorResponse:
              `❌ *Unregistered Username:*\n` +
              `The username *@${usernameClean}* is not registered on Easyzpay.\n` +
              `Please ask the recipient to register on https://easyzpay.xyz, or send directly to their 0x wallet address.`,
          };
        }
      } catch (err: any) {
        console.error('[AIAgent] Username registry query failed:', err);
        return {
          success: false,
          errorResponse: `⚠️ Could not verify username *@${usernameClean}* on Arc Chain registry. Please try again or use their 0x wallet address.`,
        };
      }
    }

    return {
      success: false,
      errorResponse:
        `❌ *Invalid Recipient Format:*\n` +
        `Easyzpay Chat-to-Pay only accepts:\n` +
        `1. Registered Easyzpay @usernames (e.g. *@alisheraz*)\n` +
        `2. Raw 0x wallet addresses (e.g. *0x1C1F89F6Cc9b65eddE36D9F7fbd0222D53A158d6*)\n\n` +
        `All other name services are rejected.`,
    };
  }
}
