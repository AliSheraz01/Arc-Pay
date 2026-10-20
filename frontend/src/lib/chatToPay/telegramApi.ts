/**
 * Telegram Bot API Client
 * 100% Free, Official, Serverless-ready on Vercel
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const TELEGRAM_API_BASE = 'https://api.telegram.org'

export interface InlineKeyboardButton {
  text: string
  callback_data?: string
  url?: string
}

export interface SendTelegramMessageOptions {
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2'
  inlineKeyboard?: InlineKeyboardButton[][]
  replyToMessageId?: number
}

/**
 * Send a message to a Telegram chat with optional inline keyboard buttons
 */
export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  options: SendTelegramMessageOptions = {}
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN
  if (!token) {
    console.warn('[Telegram API] TELEGRAM_BOT_TOKEN is not set in environment.')
    return false
  }

  const url = `${TELEGRAM_API_BASE}/bot${token}/sendMessage`

  const payload: any = {
    chat_id: chatId,
    text: text,
    parse_mode: options.parseMode || 'HTML',
    disable_web_page_preview: false,
  }

  if (options.inlineKeyboard && options.inlineKeyboard.length > 0) {
    payload.reply_markup = {
      inline_keyboard: options.inlineKeyboard,
    }
  }

  if (options.replyToMessageId) {
    payload.reply_to_message_id = options.replyToMessageId
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('[Telegram API] Error sending message:', errText)
      return false
    }

    return true
  } catch (err) {
    console.error('[Telegram API] Network error:', err)
    return false
  }
}

/**
 * Answer a callback query from an inline button press
 */
export async function answerTelegramCallback(
  callbackQueryId: string,
  text?: string
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN
  if (!token) return false

  const url = `${TELEGRAM_API_BASE}/bot${token}/answerCallbackQuery`

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text,
        show_alert: false,
      }),
    })
    return true
  } catch (err) {
    console.error('[Telegram API] answerCallbackQuery error:', err)
    return false
  }
}

/**
 * Set the Telegram Webhook URL
 */
export async function setTelegramWebhook(webhookUrl: string): Promise<any> {
  const token = process.env.TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is missing')

  const url = `${TELEGRAM_API_BASE}/bot${token}/setWebhook`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ['message', 'callback_query'],
    }),
  })
  return res.json()
}
