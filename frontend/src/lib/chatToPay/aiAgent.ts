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

    // Greetings check regex
    const isGreeting = /^(HI+|HELLO+|HEY+|AOA|SALA+M|ASSALAM\s*O\s*ALAIKUM|ASSALAMU\s*ALAIKUM|SUP|YO|GOOD\s*MORNING|GOOD\s*EVENING|GOOD\s*AFTERNOON|HOLA|HELP)\b/i.test(trimmed) ||
      ['HI', 'HELLO', 'HEY', 'AOA', 'SALAM', 'SALAAM', 'HELP', 'ASSALAM O ALAIKUM', 'ASSALAMU ALAIKUM', 'SUP', 'YO'].includes(upper)

    if (!session) {
      if (isGreeting || ['PANEL', '/PANEL', 'MENU', '/MENU'].includes(upper)) {
        return (
          `Hey! 👋 Welcome to Easyzpay on Arc Chain! ⚡\n\n` +
          `I'm your personal WhatsApp payment assistant. You can send instant USDC right from chat!\n\n` +
          `*To connect in seconds:*\n` +
          `1️⃣ Visit https://easyzpay.xyz\n` +
          `2️⃣ Go to the *Chat to Pay* tab\n` +
          `3️⃣ Text me your pairing code (e.g. *PAIR ARC-XXXX*)\n\n` +
          `Let me know once you're ready! 💬`
        )
      }

      return (
        '👋 *Welcome to Easyzpay Chat-to-Pay on Arc Chain!*\n\n' +
        'Your WhatsApp is not yet paired with an Easyzpay Smart Account.\n\n' +
        '👉 Please visit https://easyzpay.xyz, click *"Chat to Pay"*, and send: *PAIR <CODE>*\n' +
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
        'Please renew your session on https://easyzpay.xyz (Chat to Pay tab) to continue sending payments.'
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

    // 4. Greetings Handler (Friendly & Warm)
    if (isGreeting && !['1', '2', '3'].includes(upper)) {
      const remaining = Math.max(0, parseFloat(session.spendingLimit) - parseFloat(session.spentAmount || '0')).toFixed(2)
      return (
        `Hey there! 👋 Great to see you!\n\n` +
        `Your Easyzpay wallet is active and ready to send instant payments on Arc Chain. 🚀\n\n` +
        `*Quick Actions:*\n` +
        `💸 *Send Payment:* Just text:\n` +
        `• \`Pay 5 USDC to @username\`\n` +
        `• \`Send 1 to 0x742d...44e\`\n\n` +
        `🎛️ *Control Menu:*\n` +
        `Type */panel* to view your transaction history or manage your session.\n\n` +
        `Remaining allowance: *${remaining} USDC* 🛡️`
      )
    }

    // 5. /panel Command (or panel, /menu, menu)
    if (['/PANEL', 'PANEL', '/MENU', 'MENU'].includes(upper)) {
      const spent = parseFloat(session.spentAmount || '0').toFixed(2)
      const limit = parseFloat(session.spendingLimit).toFixed(2)
      const remaining = Math.max(0, parseFloat(session.spendingLimit) - parseFloat(session.spentAmount || '0')).toFixed(2)
      const shortAddr = `${session.ownerAddress.slice(0, 6)}...${session.ownerAddress.slice(-4)}`

      return (
        `🎛️ *Easyzpay Control Panel*\n\n` +
        `👤 *Account:* \`${shortAddr}\`\n` +
        `💰 *Daily Cap:* ${limit} USDC\n` +
        `📊 *Spent:* ${spent} USDC (Remaining: *${remaining} USDC*)\n` +
        `🟢 *Status:* Active & Protected on Arc Mainnet\n\n` +
        `*Reply with a number or command:*\n` +
        `1️⃣ *1* or */history* - Transaction History 📜\n` +
        `2️⃣ *2* or */disconnect* - Disconnect WhatsApp Session 🔌\n` +
        `3️⃣ *3* or */help* - Payment Guide & Examples 💡\n\n` +
        `💡 Or simply text a payment anytime:\n` +
        `👉 \`Pay 1 USDC to @username\``
      )
    }

    // 6. Option 1: Transaction History (1, /history, history, tx, transactions)
    if (['1', '/HISTORY', 'HISTORY', '/TX', 'TX', 'TRANSACTIONS'].includes(upper)) {
      return this.handleHistory(session)
    }

    // 7. Option 2: Disconnect Session (2, /disconnect, disconnect, unlink, logout)
    if (['2', '/DISCONNECT', 'DISCONNECT', 'UNLINK', 'LOGOUT', '/LOGOUT'].includes(upper)) {
      return this.handleDisconnect(session.phoneId || phoneId)
    }

    // 8. Option 3 / Help (3, /help, help)
    if (['3', '/HELP'].includes(upper)) {
      return (
        `💡 *Easyzpay Chat-to-Pay Guide*\n\n` +
        `Send USDC instantly with natural commands:\n\n` +
        `• *By Username:*\n` +
        `  \`Pay 5 USDC to @alisheraz\`\n` +
        `  \`Send 10 to @alex\`\n\n` +
        `• *By Wallet Address:*\n` +
        `  \`Pay 2 USDC to 0x742d35Cc6634C0532925a3b844Bc454e4438f44e\`\n\n` +
        `• *Control Commands:*\n` +
        `  \`/panel\` - Open Control Panel\n` +
        `  \`/history\` - View recent payments\n` +
        `  \`/disconnect\` - Revoke session\n\n` +
        `Every transfer requires your explicit *YES* confirmation before broadcasting to Arc Mainnet.`
      )
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

    // Clear previous sessions for this phone number and owner address to prevent UNIQUE constraint errors
    await db.whatsAppSession.updateMany({
      where: { phoneId },
      data: {
        status: 'REVOKED',
        phoneId: null,
      },
    })

    await db.whatsAppSession.updateMany({
      where: {
        ownerAddress: session.ownerAddress,
        id: { not: session.id },
        status: 'PAIRED',
      },
      data: {
        status: 'REVOKED',
        phoneId: null,
      },
    })

    // Bind the WhatsApp Phone ID to the newly authenticated session
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
          `Hey! I couldn't quite catch that payment command. 😊\n\n` +
          `*Here is how to send USDC:*\n` +
          `• \`Pay 5 USDC to @username\`\n` +
          `• \`Send 10 to 0x742d...44e\`\n` +
          `• \`Transfer 2.5 to @alisheraz\`\n\n` +
          `💡 Reply with */panel* anytime to view your account menu or transaction history!`,
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

  /**
   * Option 1: Transaction History queried directly from Turso database
   */
  async handleHistory(session: any): Promise<string> {
    try {
      // 1. Check ChatPaymentIntent executed rows for this session or phone
      const intents = await db.chatPaymentIntent.findMany({
        where: {
          sessionId: session.id,
          status: 'EXECUTED',
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      })

      if (intents && intents.length > 0) {
        let historyText = `📜 *Recent Transactions (Arc Mainnet)*\n\n`
        intents.forEach((intent, idx) => {
          const dateStr = new Date(intent.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })
          historyText += `${idx + 1}. 💸 *${intent.amount} USDC* ➔ ${intent.recipientInput}\n`
          historyText += `   Status: Confirmed ✅ (${dateStr})\n`
          if (intent.txHash) {
            historyText += `   Tx: https://explorer.arc.io/tx/${intent.txHash}\n`
          }
          historyText += `\n`
        })

        const remaining = Math.max(0, parseFloat(session.spendingLimit) - parseFloat(session.spentAmount || '0')).toFixed(2)
        historyText += `💳 *Remaining Allowance:* ${remaining} USDC`
        return historyText
      }

      // 2. Fallback check db.transaction for recorded on-chain transfers
      const userAddr = (session.ownerAddress || session.smartAccountAddress).toLowerCase()
      const txs = await db.transaction.findMany({
        where: {
          OR: [
            { fromAddress: userAddr },
            { toAddress: userAddr },
          ],
        },
        orderBy: { timestamp: 'desc' },
        take: 5,
      })

      if (txs && txs.length > 0) {
        let historyText = `📜 *Recent Transactions (Arc Mainnet)*\n\n`
        txs.forEach((tx, idx) => {
          const isSent = tx.fromAddress.toLowerCase() === userAddr
          const dateStr = new Date(tx.timestamp).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })
          const counterparty = tx.recipientUsername
            ? `@${tx.recipientUsername}`
            : isSent
            ? `${tx.toAddress.slice(0, 6)}...${tx.toAddress.slice(-4)}`
            : `${tx.fromAddress.slice(0, 6)}...${tx.fromAddress.slice(-4)}`

          historyText += `${idx + 1}. ${isSent ? '💸 Sent' : '📥 Received'} *${tx.amount} USDC* ${isSent ? '➔' : 'from'} ${counterparty}\n`
          historyText += `   Status: Confirmed ✅ (${dateStr})\n`
          if (tx.txHash) {
            historyText += `   Tx: https://explorer.arc.io/tx/${tx.txHash}\n`
          }
          historyText += `\n`
        })

        const remaining = Math.max(0, parseFloat(session.spendingLimit) - parseFloat(session.spentAmount || '0')).toFixed(2)
        historyText += `💳 *Remaining Allowance:* ${remaining} USDC`
        return historyText
      }

      return (
        `📜 *Recent Transactions (Arc Mainnet)*\n\n` +
        `No transactions recorded yet!\n\n` +
        `👉 Send your first payment by texting:\n` +
        `\`Pay 1 USDC to @username\``
      )
    } catch (err: any) {
      console.error('[AI Agent] History error:', err)
      return `❌ *Could not retrieve history:* ${err.message || 'Database error'}. Please try again later.`
    }
  }

  /**
   * Option 2: Disconnect WhatsApp Session and revoke active session keys in Turso
   */
  async handleDisconnect(phoneId: string): Promise<string> {
    try {
      await db.whatsAppSession.updateMany({
        where: { phoneId, status: 'PAIRED' },
        data: {
          status: 'REVOKED',
          phoneId: null,
        },
      })

      return (
        `🔌 *Session Disconnected Successfully*\n\n` +
        `Your WhatsApp has been unlinked from Easyzpay. Your delegated session keys have been revoked and no further payments can be broadcasted from this chat.\n\n` +
        `To reconnect anytime, visit https://easyzpay.xyz -> *Chat to Pay* tab and generate a new pairing code.\n\n` +
        `Have a wonderful day! 👋`
      )
    } catch (err: any) {
      console.error('[AI Agent] Disconnect error:', err)
      return `❌ *Disconnect Failed:* ${err.message || 'Database error'}. Please try again later.`
    }
  }
}
