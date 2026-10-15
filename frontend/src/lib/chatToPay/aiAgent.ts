import { createPublicClient, http, isAddress } from 'viem'
import { db } from '@/lib/db'
import { PaymentIntentParsed } from './types'
import { ChatToPayRelayer } from './relayer'
import { REGISTRY_ADDRESS, ACTIVE_CHAIN } from '@/lib/constants'
import { REGISTRY_ABI } from '@/lib/abi'

export class WhatsAppAIAgent {
  private relayer: ChatToPayRelayer

  constructor() {
    this.relayer = new ChatToPayRelayer()
  }

  async handleIncomingMessage(phoneId: string, messageText: string): Promise<string> {
    const trimmed = messageText.trim()
    const upper = trimmed.toUpperCase()

    // 1. Handle Pairing: "PAIR ARC-XXXX", "ARC-XXXX", "ARC - XXXX", etc.
    const normalizedForPairing = upper.replace(/\s*-\s*/g, '-')
    const pairingMatch = normalizedForPairing.match(/(?:PAIR\s+)?(ARC-[A-Z0-9]{4})/i)
    if (pairingMatch) {
      const token = pairingMatch[1].toUpperCase()
      return this.handlePairing(phoneId, token)
    }


    // 2. Active Session Lookup
    const session = await db.whatsAppSession.findFirst({
      where: { phoneId, status: 'PAIRED' },
    })

    if (!session) {
      return (
        '👋 *Welcome to Easyzpay Chat-to-Pay on Arc Chain!*\n\n' +
        'Your WhatsApp is not yet paired with an Easyzpay Smart Account.\n\n' +
        '👉 Please visit https://easyzpay.xyz, click *"Connect WhatsApp"*, and send: *PAIR <CODE>*\n' +
        'Example: *PAIR ARC-8492*'
      )
    }

    // Check expiry
    if (new Date() > new Date(session.validUntil)) {
      await db.whatsAppSession.update({
        where: { id: session.id },
        data: { status: 'EXPIRED' },
      })
      return (
        '⏳ *Session Expired:*\n' +
        'Your delegated Chat-to-Pay session has reached its expiry limit.\n' +
        'Please renew your session on https://easyzpay.xyz to continue sending payments.'
      )
    }

    // 3. Two-Step Confirmation Handling
    const pendingIntent = await db.chatPaymentIntent.findFirst({
      where: {
        phoneId,
        status: 'AWAITING_CONFIRMATION',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (pendingIntent) {
      if (['YES', 'CONFIRM', 'Y', 'APPROVE', 'PAY', 'HAAN', 'OK', 'OKAY'].includes(upper)) {
        await db.chatPaymentIntent.update({
          where: { id: pendingIntent.id },
          data: { status: 'CONFIRMED' },
        })

        const execution = await this.relayer.executePayment(pendingIntent.id)

        if (execution.success) {
          return (
            `✅ *Payment Successful!*\n\n` +
            `💸 *Amount:* ${pendingIntent.amount} USDC\n` +
            `👤 *Recipient:* ${pendingIntent.recipientInput}\n` +
            `⛽ *Network:* Arc Mainnet\n` +
            `🔗 *Arc Explorer:*\n${execution.explorerUrl}\n\n` +
            `💳 *Remaining Session Allowance:* ${execution.remainingAllowance} USDC`
          )
        } else {
          return `❌ *Payment Execution Failed:*\n${execution.error || 'Network error on Arc Chain'}`
        }
      } else if (['NO', 'CANCEL', 'N', 'NAHI', 'REJECT', 'STOP'].includes(upper)) {
        await db.chatPaymentIntent.update({
          where: { id: pendingIntent.id },
          data: { status: 'REJECTED' },
        })
        return (
          `🚫 *Payment Cancelled:*\n` +
          `Your payment of ${pendingIntent.amount} USDC to ${pendingIntent.recipientInput} was cancelled. No funds were transferred.`
        )
      }
    }

    // 4. Intent Extraction
    const parseResult = await this.parsePaymentIntent(trimmed)
    if (parseResult.success === false) {
      return parseResult.errorResponse
    }

    const { intent } = parseResult

    // 5. Check spending limits
    const transferAmount = parseFloat(intent.amount)
    const alreadySpent = parseFloat(session.spentAmount || '0')
    const spendingLimit = parseFloat(session.spendingLimit)

    if (alreadySpent + transferAmount > spendingLimit) {
      const remaining = Math.max(0, spendingLimit - alreadySpent).toFixed(2)
      return (
        `⚠️ *Spending Limit Exceeded:*\n\n` +
        `Requested: *${transferAmount} USDC*\n` +
        `Remaining Session Allowance: *${remaining} USDC*\n` +
        `Total Session Cap: *${spendingLimit} USDC*\n\n` +
        `Please adjust the amount or increase your spending limit on https://easyzpay.xyz.`
      )
    }

    // 6. Create Pending Payment Intent with 2-minute expiry
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000)

    await db.chatPaymentIntent.create({
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
    })

    const remainingAfter = (spendingLimit - (alreadySpent + transferAmount)).toFixed(2)
    const shortAddress = `${intent.resolvedAddress.slice(0, 6)}...${intent.resolvedAddress.slice(-4)}`

    return (
      `💳 *Easyzpay Payment Confirmation*\n\n` +
      `💸 *Amount:* ${parseFloat(intent.amount).toFixed(2)} USDC\n` +
      `👤 *Recipient:* ${intent.recipientInput} (${shortAddress})\n` +
      `⛽ *Network:* Arc Mainnet (Gasless)\n` +
      `🛡️ *Remaining Allowance After:* ${remainingAfter} USDC\n\n` +
      `👉 Reply *YES* or *CONFIRM* to broadcast this payment.\n` +
      `👉 Reply *NO* to cancel.\n\n` +
      `_(Expires in 2 minutes)_`
    )
  }

  async handlePairing(phoneId: string, pairingToken: string): Promise<string> {
    const session = await db.whatsAppSession.findUnique({
      where: { pairingToken },
    })

    if (!session) {
      return '❌ *Invalid Pairing Token:* No matching session found. Please generate a new code at https://easyzpay.xyz.'
    }

    if (session.status === 'PAIRED') {
      return 'ℹ️ *Already Paired:* This session is already active. You can start sending payments anytime!'
    }

    if (new Date() > new Date(session.pairingTokenExpiresAt)) {
      await db.whatsAppSession.update({
        where: { id: session.id },
        data: { status: 'EXPIRED' },
      })
      return '⏳ *Pairing Token Expired:* Please generate a fresh pairing token on https://easyzpay.xyz.'
    }

    await db.whatsAppSession.update({
      where: { id: session.id },
      data: {
        phoneId,
        status: 'PAIRED',
      },
    })

    const expiryFormatted = new Date(session.validUntil).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

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
    )
  }

  async parsePaymentIntent(
    message: string
  ): Promise<{ success: true; intent: PaymentIntentParsed } | { success: false; errorResponse: string }> {
    const paymentRegex = /(?:pay|send|transfer|bhej\s+do|give)\s+(?:\$)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:usdc|usd|\$)?\s+(?:to|ko)?\s*([@a-zA-Z0-9_.-]+)/i
    const reversedRegex = /([@a-zA-Z0-9_.-]+)\s+(?:ko|to)\s+(?:\$)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:usdc|usd|\$)?/i

    let amountStr: string | null = null
    let recipientRaw: string | null = null

    const matchNormal = message.match(paymentRegex)
    if (matchNormal) {
      amountStr = matchNormal[1]
      recipientRaw = matchNormal[2]
    } else {
      const matchReversed = message.match(reversedRegex)
      if (matchReversed) {
        recipientRaw = matchReversed[1]
        amountStr = matchReversed[2]
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
      }
    }

    const amountNum = parseFloat(amountStr)
    if (isNaN(amountNum) || amountNum <= 0) {
      return {
        success: false,
        errorResponse: '❌ *Invalid Amount:* Please specify an amount greater than 0 USDC.',
      }
    }

    // STRICT RECIPIENT VALIDATION REQUIREMENT:
    // Strictly reject any other name services (.eth, .lens, .sol, etc.)
    const unsupportedNameServices = /\.(eth|lens|sol|arc|crypto|nft|wallet|x|dao|base|bnb|avax)$/i
    if (unsupportedNameServices.test(recipientRaw)) {
      return {
        success: false,
        errorResponse:
          `❌ *Unsupported Name Service:*\n` +
          `Easyzpay Chat-to-Pay strictly accepts registered Easyzpay usernames (e.g. *@alisheraz*) or raw 0x wallet addresses.\n` +
          `Third-party name services (\`${recipientRaw}\`) are not supported for security reasons.`,
      }
    }

    // Check raw address
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
      }
    }

    // Check Easyzpay registered username (@username or username)
    const cleanUsername = recipientRaw.replace(/^@/, '').toLowerCase().trim()
    try {
      const client = createPublicClient({
        chain: ACTIVE_CHAIN as any,
        transport: http(process.env.NEXT_PUBLIC_ARC_RPC_URL || process.env.RPC_URL || 'https://rpc.mainnet.arc.io'),
      })

      const resolvedAddress = await client.readContract({
        address: REGISTRY_ADDRESS as `0x${string}`,
        abi: REGISTRY_ABI,
        functionName: 'resolveUsername',
        args: [cleanUsername],
      }) as `0x${string}`

      if (
        !resolvedAddress ||
        resolvedAddress === '0x0000000000000000000000000000000000000000' ||
        !isAddress(resolvedAddress)
      ) {
        return {
          success: false,
          errorResponse:
            `❌ *Username Not Found:*\n` +
            `The username *@${cleanUsername}* is not registered on Easyzpay.\n` +
            `Please verify the username or send to a raw 0x address.`,
        }
      }

      return {
        success: true,
        intent: {
          action: 'PAY',
          amount: amountStr,
          asset: 'USDC',
          recipientInput: `@${cleanUsername}`,
          recipientType: 'USERNAME',
          resolvedAddress: resolvedAddress,
        },
      }
    } catch (err: any) {
      return {
        success: false,
        errorResponse: `❌ *Registry Resolution Error:* Could not resolve @${cleanUsername}. Please try again later.`,
      }
    }
  }
}
