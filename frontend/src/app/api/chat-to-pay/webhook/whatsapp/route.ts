import { NextRequest, NextResponse } from 'next/server'
import { WhatsAppAIAgent } from '@/lib/chatToPay/aiAgent'
import { sendGreenApiMessage } from '@/lib/chatToPay/greenApi'
import { normalizePhone } from '@/lib/chatToPay/crypto'

export const dynamic = 'force-dynamic'

const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'easyzpay_arc_webhook_secure_2026'

/**
 * Webhook Verification (GET)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge || '', { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

/**
 * Incoming Webhook (POST) - Green-API, Meta, Twilio
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const agent = new WhatsAppAIAgent()

    let senderPhone = ''
    let messageText = ''
    let greenApiChatId = ''

    const isGreenApi = Boolean(body.typeWebhook === 'incomingMessageReceived' || body.instanceData)
    const isTwilio = Boolean(body.AccountSid || (body.From && String(body.From).startsWith('whatsapp:')))

    if (isGreenApi && body.messageData) {
      greenApiChatId = body.senderData?.chatId || body.senderData?.sender || ''
      // Ignore group chats (@g.us) to prevent spam or unintentional triggers
      if (greenApiChatId.endsWith('@g.us')) {
        return NextResponse.json({ status: 'ignored_group_message' })
      }

      senderPhone = normalizePhone(greenApiChatId.replace(/@.*$/, ''))
      messageText = (
        body.messageData?.textMessageData?.textMessage ||
        body.messageData?.extendedTextMessageData?.text ||
        body.messageData?.buttonsResponseMessageData?.selectedDisplayText ||
        body.messageData?.buttonsResponseMessageData?.selectedButtonId ||
        body.messageData?.listResponseMessageData?.title ||
        body.messageData?.listResponseMessageData?.selectedRowId ||
        ''
      ).trim()
    } else if (body.entry && body.entry[0]?.changes && body.entry[0]?.changes[0]?.value?.messages) {
      const msg = body.entry[0].changes[0].value.messages[0]
      senderPhone = normalizePhone(msg.from)
      messageText = (msg.text?.body || msg.interactive?.button_reply?.title || '').trim()
    } else if (body.from && body.text) {
      senderPhone = normalizePhone(body.from)
      messageText = String(body.text).trim()
    }

    if (!senderPhone || !messageText) {
      return NextResponse.json({ status: 'ignored_empty_message' })
    }

    console.log(`[Next.js WhatsApp Webhook] Message from ${senderPhone}: "${messageText}"`)

    const replyMessage = await agent.handleIncomingMessage(senderPhone, messageText)

    console.log(`[Next.js WhatsApp Webhook] Reply to ${senderPhone}: "${replyMessage}"`)

    // Send reply back via Green-API
    if (isGreenApi && greenApiChatId) {
      await sendGreenApiMessage(greenApiChatId, replyMessage)
      return NextResponse.json({ status: 'ok', to: greenApiChatId })
    }

    // Default JSON response
    return NextResponse.json({
      success: true,
      to: senderPhone,
      reply: replyMessage,
    })
  } catch (err: any) {
    console.error('[Next.js WhatsApp Webhook] Error:', err)
    // Always return HTTP 200 with status error so Green-API doesn't queue and retry failed requests indefinitely
    return NextResponse.json({ status: 'handled_with_error', error: err.message || 'Internal error' })
  }
}
