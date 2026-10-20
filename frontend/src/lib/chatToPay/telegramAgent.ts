import { createPublicClient, http, isAddress } from 'viem'
import { db } from '@/lib/db'
import { PaymentIntentParsed } from './types'
import { ChatToPayRelayer } from './relayer'
import { REGISTRY_ADDRESS, ACTIVE_CHAIN, EXPLORER_URL } from '@/lib/constants'
import { REGISTRY_ABI } from '@/lib/abi'
import { sendTelegramMessage, InlineKeyboardButton } from './telegramApi'

export class TelegramAIAgent {
  private relayer: ChatToPayRelayer

  constructor() {
    this.relayer = new ChatToPayRelayer()
  }

  /**
   * Main incoming update handler for Telegram Bot
   */
  async handleTelegramUpdate(update: any): Promise<void> {
    // 1. Handle Inline Button Click (callback_query)
    if (update.callback_query) {
      const callback = update.callback_query
      const chatId = callback.message?.chat?.id
      const data = String(callback.data || '')
      const userKey = `tg_${callback.from?.id || chatId}`

      if (!chatId) return

      await this.handleCallbackAction(chatId, userKey, data)
      return
    }

    // 2. Handle Text Message
    const message = update.message
    if (!message || !message.text) return

    const chatId = message.chat.id
    const userKey = `tg_${message.from?.id || chatId}`
    const text = String(message.text).trim()
    const upper = text.toUpperCase()

    // A. Handle /start with deep link token: "/start ARC-XXXX"
    const startMatch = text.match(/^\/start(?:\s+([A-Za-z0-9_-]+))?$/i)
    if (startMatch) {
      const tokenParam = startMatch[1]
      if (tokenParam) {
        const pairingToken = tokenParam.toUpperCase().replace(/\s+/g, '')
        await this.handlePairing(chatId, userKey, pairingToken)
        return
      }
    }

    // B. Handle manual pairing token: "PAIR ARC-XXXX" or "ARC-XXXX"
    const normalizedForPairing = upper.replace(/\s*-\s*/g, '-')
    const pairingMatch = normalizedForPairing.match(/(?:PAIR\s+)?(ARC-[A-Z0-9]{4})/i)
    if (pairingMatch) {
      const token = pairingMatch[1].toUpperCase()
      await this.handlePairing(chatId, userKey, token)
      return
    }

    // C. Lookup active session
    const session = await db.whatsAppSession.findFirst({
      where: { phoneId: userKey, status: 'PAIRED' },
    })

    const isGreeting =
      /^(HI+|HELLO+|HEY+|AOA|SALA+M|ASSALAM\s*O\s*ALAIKUM|ASSALAMU\s*ALAIKUM|SUP|YO|GOOD\s*MORNING|GOOD\s*EVENING|GOOD\s*AFTERNOON|HOLA|HELP)\b/i.test(
        text
      ) ||
      ['HI', 'HELLO', 'HEY', 'AOA', 'SALAM', 'SALAAM', 'HELP', '/START', 'START', 'SUP', 'YO'].includes(upper)

    // Unpaired flow
    if (!session) {
      await sendTelegramMessage(
        chatId,
        `👋 <b>Welcome to Easyzpay on Arc Chain!</b> ⚡\n\n` +
          `I am your non-custodial crypto assistant on Telegram. You can send USDC gaslessly to usernames or wallet addresses instantly!\n\n` +
          `<b>How to connect your wallet in 10 seconds:</b>\n` +
          `1️⃣ Visit <a href="https://easyzpay.xyz/chat-to-pay">easyzpay.xyz/chat-to-pay</a>\n` +
          `2️⃣ Click <b>Connect Telegram</b>\n` +
          `3️⃣ Or send me your pairing code here: <code>PAIR ARC-XXXX</code>\n\n` +
          `Let me know once you're ready! 😊`,
        {
          inlineKeyboard: [
            [{ text: '🌐 Open Easyzpay Web App', url: 'https://easyzpay.xyz/chat-to-pay' }],
          ],
        }
      )
      return
    }

    // Check expiry
    if (new Date() > new Date(session.validUntil)) {
      await db.whatsAppSession.update({
        where: { id: session.id },
        data: { status: 'EXPIRED' },
      })
      await sendTelegramMessage(
        chatId,
        `⏳ <b>Session Expired:</b>\nYour delegated Telegram session has reached its expiry limit. Please renew your session on <a href="https://easyzpay.xyz/chat-to-pay">easyzpay.xyz/chat-to-pay</a> to continue sending payments.`
      )
      return
    }

    // D. Two-step confirmation via text (e.g. typing YES or NO)
    const pendingIntent = await db.chatPaymentIntent.findFirst({
      where: {
        phoneId: userKey,
        status: 'AWAITING_CONFIRMATION',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (pendingIntent) {
      if (['YES', 'CONFIRM', 'Y', 'APPROVE', 'PAY', 'HAAN', 'OK', 'OKAY'].includes(upper)) {
        await this.executePaymentIntent(chatId, pendingIntent.id)
        return
      } else if (['NO', 'CANCEL', 'N', 'NAHI', 'REJECT', 'STOP'].includes(upper)) {
        await db.chatPaymentIntent.update({
          where: { id: pendingIntent.id },
          data: { status: 'REJECTED' },
        })
        await sendTelegramMessage(
          chatId,
          `🚫 <b>Payment Cancelled:</b>\nYour payment of ${pendingIntent.amount} USDC to ${pendingIntent.recipientInput} was cancelled. No funds were transferred.`
        )
        return
      }
    }

    // E. Greetings handler
    if (isGreeting && !['1', '2', '3'].includes(upper)) {
      const remaining = Math.max(
        0,
        parseFloat(session.spendingLimit) - parseFloat(session.spentAmount || '0')
      ).toFixed(2)
      await sendTelegramMessage(
        chatId,
        `Hey there! 👋 <b>Great to see you!</b>\n\n` +
          `Your Easyzpay wallet is active and ready to send instant payments on Arc Chain. 🚀\n\n` +
          `<b>Quick Actions:</b>\n` +
          `💸 <b>Send Payment:</b> Just text:\n` +
          `• <code>Pay 5 USDC to @username</code>\n` +
          `• <code>Send 1 to 0x742d...44e</code>\n\n` +
          `🛡️ Remaining allowance: <b>${remaining} USDC</b>`,
        {
          inlineKeyboard: [
            [
              { text: '🎛️ Control Panel', callback_data: 'btn_panel' },
              { text: '📜 Recent History', callback_data: 'btn_history' },
            ],
            [{ text: '💡 How to Pay', callback_data: 'btn_help' }],
          ],
        }
      )
      return
    }

    // F. /panel command
    if (['/PANEL', 'PANEL', '/MENU', 'MENU'].includes(upper)) {
      await this.showControlPanel(chatId, session)
      return
    }

    // G. /history command
    if (['/HISTORY', 'HISTORY', '/TX', 'TX', 'TRANSACTIONS'].includes(upper)) {
      await this.showHistory(chatId, session)
      return
    }

    // H. /disconnect command
    if (['/DISCONNECT', 'DISCONNECT', 'UNLINK', 'LOGOUT', '/LOGOUT'].includes(upper)) {
      await this.disconnectSession(chatId, userKey)
      return
    }

    // I. /help command
    if (['/HELP', 'HELP'].includes(upper)) {
      await this.showHelp(chatId)
      return
    }

    // J. Parse Payment Intent
    const parseResult = await this.parsePaymentIntent(text)
    if (!parseResult.success) {
      await sendTelegramMessage(
        chatId,
        `Hey! I couldn't quite catch that payment command. 😊\n\n` +
          `<b>Here is how to send USDC:</b>\n` +
          `• <code>Pay 5 USDC to @username</code>\n` +
          `• <code>Send 10 to 0x742d...44e</code>\n` +
          `• <code>Transfer 2.5 to @alisheraz</code>\n\n` +
          `💡 Use the buttons below or type <b>/panel</b> anytime!`,
        {
          inlineKeyboard: [
            [
              { text: '🎛️ Open Control Panel', callback_data: 'btn_panel' },
              { text: '💡 View Guide', callback_data: 'btn_help' },
            ],
          ],
        }
      )
      return
    }

    const { intent } = parseResult
    const transferAmount = parseFloat(intent.amount)
    const alreadySpent = parseFloat(session.spentAmount || '0')
    const spendingLimit = parseFloat(session.spendingLimit)

    if (alreadySpent + transferAmount > spendingLimit) {
      const remaining = Math.max(0, spendingLimit - alreadySpent).toFixed(2)
      await sendTelegramMessage(
        chatId,
        `⚠️ <b>Daily Spending Limit Exceeded:</b>\n\n` +
          `Requested: <b>${transferAmount} USDC</b>\n` +
          `Remaining Daily Allowance: <b>${remaining} USDC</b>\n` +
          `Total Daily Cap: <b>${spendingLimit} USDC</b>\n\n` +
          `Please adjust the amount or increase your limit at <a href="https://easyzpay.xyz/chat-to-pay">easyzpay.xyz/chat-to-pay</a>.`
      )
      return
    }

    // Create Pending Intent with 2-minute expiry
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000)
    const pending = await db.chatPaymentIntent.create({
      data: {
        phoneId: userKey,
        sessionId: session.id,
        rawMessage: text,
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

    await sendTelegramMessage(
      chatId,
      `💳 <b>Easyzpay Payment Confirmation</b>\n\n` +
        `💸 <b>Amount:</b> ${parseFloat(intent.amount).toFixed(2)} USDC\n` +
        `👤 <b>Recipient:</b> ${intent.recipientInput} (<code>${shortAddress}</code>)\n` +
        `⛽ <b>Network:</b> Arc Mainnet (Gasless Relayer)\n` +
        `🛡️ <b>Remaining Allowance After:</b> ${remainingAfter} USDC\n\n` +
        `Tap below to broadcast or cancel:`,
      {
        inlineKeyboard: [
          [
            { text: '✅ Confirm & Broadcast', callback_data: `confirm_${pending.id}` },
            { text: '❌ Cancel', callback_data: `cancel_${pending.id}` },
          ],
        ],
      }
    )
  }

  /**
   * Handle Inline Keyboard Button Clicks
   */
  private async handleCallbackAction(chatId: number, userKey: string, data: string): Promise<void> {
    const session = await db.whatsAppSession.findFirst({
      where: { phoneId: userKey, status: 'PAIRED' },
    })

    if (data === 'btn_panel') {
      if (!session) {
        await sendTelegramMessage(chatId, `ℹ️ Please pair your account first at <a href="https://easyzpay.xyz/chat-to-pay">easyzpay.xyz/chat-to-pay</a>.`)
        return
      }
      await this.showControlPanel(chatId, session)
      return
    }

    if (data === 'btn_history') {
      if (!session) return
      await this.showHistory(chatId, session)
      return
    }

    if (data === 'btn_disconnect') {
      await this.disconnectSession(chatId, userKey)
      return
    }

    if (data === 'btn_help') {
      await this.showHelp(chatId)
      return
    }

    // Handle Confirm Payment Button
    if (data.startsWith('confirm_')) {
      const intentId = data.replace('confirm_', '')
      await this.executePaymentIntent(chatId, intentId)
      return
    }

    // Handle Cancel Payment Button
    if (data.startsWith('cancel_')) {
      const intentId = data.replace('cancel_', '')
      await db.chatPaymentIntent.update({
        where: { id: intentId },
        data: { status: 'REJECTED' },
      }).catch(() => null)

      await sendTelegramMessage(
        chatId,
        `🚫 <b>Payment Cancelled:</b>\nThe payment was cancelled safely. No funds were transferred.`
      )
    }
  }

  /**
   * Show Control Panel with interactive buttons
   */
  private async showControlPanel(chatId: number, session: any): Promise<void> {
    const spent = parseFloat(session.spentAmount || '0').toFixed(2)
    const limit = parseFloat(session.spendingLimit).toFixed(2)
    const remaining = Math.max(0, parseFloat(session.spendingLimit) - parseFloat(session.spentAmount || '0')).toFixed(2)
    const shortAddr = `${session.ownerAddress.slice(0, 6)}...${session.ownerAddress.slice(-4)}`

    await sendTelegramMessage(
      chatId,
      `🎛️ <b>Easyzpay Control Panel</b>\n\n` +
        `👤 <b>Account:</b> <code>${shortAddr}</code>\n` +
        `💰 <b>Daily Limit:</b> ${limit} USDC\n` +
        `📊 <b>Spent Today:</b> ${spent} USDC (Remaining: <b>${remaining} USDC</b>)\n` +
        `🟢 <b>Status:</b> Active & Protected on Arc Mainnet\n\n` +
        `Tap an option below:`,
      {
        inlineKeyboard: [
          [{ text: '📜 View Transaction History', callback_data: 'btn_history' }],
          [{ text: '💡 Payment Examples & Guide', callback_data: 'btn_help' }],
          [{ text: '🔌 Disconnect Telegram Session', callback_data: 'btn_disconnect' }],
        ],
      }
    )
  }

  /**
   * Show Transaction History from Turso DB
   */
  private async showHistory(chatId: number, session: any): Promise<void> {
    try {
      const intents = await db.chatPaymentIntent.findMany({
        where: {
          sessionId: session.id,
          status: 'EXECUTED',
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      })

      if (intents && intents.length > 0) {
        let historyText = `📜 <b>Recent Transactions (Arc Mainnet)</b>\n\n`
        intents.forEach((intent, idx) => {
          const dateStr = new Date(intent.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })
          historyText += `${idx + 1}. 💸 <b>${intent.amount} USDC</b> ➔ ${intent.recipientInput}\n`
          historyText += `   Status: Confirmed ✅ (${dateStr})\n`
          if (intent.txHash) {
            historyText += `   <a href="${EXPLORER_URL}/tx/${intent.txHash}">Track on Arc Explorer ↗</a>\n`
          }
          historyText += `\n`
        })

        const remaining = Math.max(
          0,
          parseFloat(session.spendingLimit) - parseFloat(session.spentAmount || '0')
        ).toFixed(2)
        historyText += `💳 <b>Remaining Daily Allowance:</b> ${remaining} USDC`

        await sendTelegramMessage(chatId, historyText, {
          inlineKeyboard: [[{ text: '🎛️ Back to Panel', callback_data: 'btn_panel' }]],
        })
        return
      }

      const userAddr = (session.ownerAddress || session.smartAccountAddress).toLowerCase()
      const txs = await db.transaction.findMany({
        where: {
          OR: [{ fromAddress: userAddr }, { toAddress: userAddr }],
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      })

      if (txs && txs.length > 0) {
        let historyText = `📜 <b>Recent Transactions (Arc Mainnet)</b>\n\n`
        txs.forEach((tx, idx) => {
          const isSent = tx.fromAddress.toLowerCase() === userAddr
          const dateStr = new Date(tx.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })
          const counterparty = tx.recipientUsername
            ? `@${tx.recipientUsername}`
            : isSent
            ? `${tx.toAddress.slice(0, 6)}...${tx.toAddress.slice(-4)}`
            : `${tx.fromAddress.slice(0, 6)}...${tx.fromAddress.slice(-4)}`

          historyText += `${idx + 1}. ${isSent ? '💸 Sent' : '📥 Received'} <b>${tx.amount} USDC</b> ${
            isSent ? '➔' : 'from'
          } ${counterparty}\n`
          historyText += `   Status: Confirmed ✅ (${dateStr})\n`
          if (tx.txHash) {
            historyText += `   <a href="${EXPLORER_URL}/tx/${tx.txHash}">Track on Arc Explorer ↗</a>\n`
          }
          historyText += `\n`
        })

        const remaining = Math.max(
          0,
          parseFloat(session.spendingLimit) - parseFloat(session.spentAmount || '0')
        ).toFixed(2)
        historyText += `💳 <b>Remaining Allowance:</b> ${remaining} USDC`

        await sendTelegramMessage(chatId, historyText, {
          inlineKeyboard: [[{ text: '🎛️ Back to Panel', callback_data: 'btn_panel' }]],
        })
        return
      }

      await sendTelegramMessage(
        chatId,
        `📜 <b>Transaction History (Arc Mainnet)</b>\n\nNo payments recorded yet!\n\n👉 Send your first payment by texting:\n<code>Pay 1 USDC to @username</code>`,
        {
          inlineKeyboard: [[{ text: '🎛️ Back to Panel', callback_data: 'btn_panel' }]],
        }
      )
    } catch (err: any) {
      console.error('[Telegram History] Error:', err)
      await sendTelegramMessage(chatId, `❌ Could not load history. Please try again later.`)
    }
  }

  /**
   * Disconnect active session in Turso DB
   */
  private async disconnectSession(chatId: number, userKey: string): Promise<void> {
    try {
      await db.whatsAppSession.updateMany({
        where: { phoneId: userKey, status: 'PAIRED' },
        data: {
          status: 'REVOKED',
          phoneId: null,
        },
      })

      await sendTelegramMessage(
        chatId,
        `🔌 <b>Telegram Session Disconnected Successfully</b>\n\n` +
          `Your Telegram account has been unlinked from Easyzpay. Your delegated session keys have been revoked and no further payments can be broadcasted from this chat.\n\n` +
          `To reconnect anytime, visit <a href="https://easyzpay.xyz/chat-to-pay">easyzpay.xyz/chat-to-pay</a>. Have a great day! 👋`,
        {
          inlineKeyboard: [
            [{ text: '🌐 Reconnect on Easyzpay', url: 'https://easyzpay.xyz/chat-to-pay' }],
          ],
        }
      )
    } catch (err: any) {
      console.error('[Telegram Disconnect] Error:', err)
      await sendTelegramMessage(chatId, `❌ Disconnect failed: ${err.message}`)
    }
  }

  /**
   * Show Payment Help
   */
  private async showHelp(chatId: number): Promise<void> {
    await sendTelegramMessage(
      chatId,
      `💡 <b>Easyzpay Chat-to-Pay Guide</b>\n\n` +
        `Send USDC instantly on Arc Mainnet with simple messages:\n\n` +
        `• <b>By Username:</b>\n` +
        `  <code>Pay 5 USDC to @alisheraz</code>\n` +
        `  <code>Send 10 to @alex</code>\n\n` +
        `• <b>By Wallet Address:</b>\n` +
        `  <code>Pay 2 USDC to 0x742d35Cc6634C0532925a3b844Bc454e4438f44e</code>\n\n` +
        `• <b>Commands:</b>\n` +
        `  <code>/panel</code> - Open Interactive Control Panel\n` +
        `  <code>/history</code> - View Recent Transactions\n` +
        `  <code>/disconnect</code> - Unlink and Revoke Session\n\n` +
        `Every transfer requires your explicit confirmation before broadcasting on Arc Mainnet.`,
      {
        inlineKeyboard: [[{ text: '🎛️ Open Control Panel', callback_data: 'btn_panel' }]],
      }
    )
  }

  /**
   * Execute Confirmed Payment via Relayer on Arc Mainnet
   */
  private async executePaymentIntent(chatId: number, intentId: string): Promise<void> {
    await db.chatPaymentIntent.update({
      where: { id: intentId },
      data: { status: 'CONFIRMED' },
    }).catch(() => null)

    const execution = await this.relayer.executePayment(intentId)

    if (execution.success) {
      await sendTelegramMessage(
        chatId,
        `✅ <b>Payment Successful!</b>\n\n` +
          `💸 <b>Network:</b> Arc Mainnet (Gasless)\n` +
          `🔗 <a href="${execution.explorerUrl}">View on ArcScan Explorer ↗</a>\n\n` +
          `💳 <b>Remaining Daily Allowance:</b> ${execution.remainingAllowance} USDC`,
        {
          inlineKeyboard: [
            [{ text: '🔍 View on ArcScan', url: execution.explorerUrl }],
            [{ text: '🎛️ Control Panel', callback_data: 'btn_panel' }],
          ],
        }
      )
    } else {
      await sendTelegramMessage(
        chatId,
        `❌ <b>Payment Execution Failed:</b>\n${execution.error || 'Network error on Arc Chain'}`
      )
    }
  }

  /**
   * Pair Telegram Account with Session in Turso DB
   */
  async handlePairing(chatId: number, userKey: string, pairingToken: string): Promise<void> {
    const session = await db.whatsAppSession.findUnique({
      where: { pairingToken },
    })

    if (!session) {
      await sendTelegramMessage(
        chatId,
        `❌ <b>Invalid Pairing Code:</b>\nNo matching session found. Please generate a new code at <a href="https://easyzpay.xyz/chat-to-pay">easyzpay.xyz/chat-to-pay</a>.`
      )
      return
    }

    if (session.status === 'PAIRED') {
      await sendTelegramMessage(
        chatId,
        `ℹ️ <b>Already Paired:</b> This session is already active. You can start sending payments anytime!`,
        {
          inlineKeyboard: [[{ text: '🎛️ Open Control Panel', callback_data: 'btn_panel' }]],
        }
      )
      return
    }

    if (new Date() > new Date(session.pairingTokenExpiresAt)) {
      await db.whatsAppSession.update({
        where: { id: session.id },
        data: { status: 'EXPIRED' },
      })
      await sendTelegramMessage(
        chatId,
        `⏳ <b>Pairing Code Expired:</b>\nPlease generate a fresh code at <a href="https://easyzpay.xyz/chat-to-pay">easyzpay.xyz/chat-to-pay</a>.`
      )
      return
    }

    // Revoke older sessions for this userKey to enforce unique constraints
    await db.whatsAppSession.updateMany({
      where: { phoneId: userKey },
      data: { status: 'REVOKED', phoneId: null },
    })

    // Link Telegram userKey to this session
    await db.whatsAppSession.update({
      where: { id: session.id },
      data: {
        phoneId: userKey,
        status: 'PAIRED',
      },
    })

    const shortAccount = `${session.smartAccountAddress.slice(0, 6)}...${session.smartAccountAddress.slice(-4)}`

    await sendTelegramMessage(
      chatId,
      `🎉 <b>Easyzpay Chat-to-Pay Connected!</b>\n\n` +
        `🛡️ <b>Account:</b> <code>${shortAccount}</code>\n` +
        `💰 <b>Daily Cap:</b> ${session.spendingLimit} USDC\n` +
        `⛽ <b>Network:</b> Arc Mainnet (Gasless Delegated Relayer)\n\n` +
        `<b>Try sending a payment:</b>\n` +
        `• <code>Pay 1 USDC to @username</code>\n` +
        `• <code>Send 5 to 0x...</code>`,
      {
        inlineKeyboard: [
          [
            { text: '🎛️ Control Panel', callback_data: 'btn_panel' },
            { text: '📜 History', callback_data: 'btn_history' },
          ],
        ],
      }
    )
  }

  /**
   * Parse Payment Instruction from Text
   */
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
      return { success: false, errorResponse: 'Invalid payment syntax' }
    }

    const amountNum = parseFloat(amountStr)
    if (isNaN(amountNum) || amountNum <= 0) {
      return { success: false, errorResponse: 'Invalid amount' }
    }

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

    const cleanUsername = recipientRaw.replace(/^@/, '').toLowerCase().trim()
    try {
      const client = createPublicClient({
        chain: ACTIVE_CHAIN as any,
        transport: http(process.env.NEXT_PUBLIC_ARC_RPC_URL || process.env.RPC_URL || 'https://rpc.mainnet.arc.io'),
      })

      const resolvedAddress = (await client.readContract({
        address: REGISTRY_ADDRESS as `0x${string}`,
        abi: REGISTRY_ABI,
        functionName: 'resolveUsername',
        args: [cleanUsername],
      })) as `0x${string}`

      if (!resolvedAddress || resolvedAddress === '0x0000000000000000000000000000000000000000' || !isAddress(resolvedAddress)) {
        return { success: false, errorResponse: `Username @${cleanUsername} is not registered on Easyzpay.` }
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
    } catch {
      return { success: false, errorResponse: `Could not resolve username @${cleanUsername}.` }
    }
  }
}
