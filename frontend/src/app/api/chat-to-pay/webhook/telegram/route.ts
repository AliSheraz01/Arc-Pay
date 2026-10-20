import { NextRequest, NextResponse } from 'next/server'
import { TelegramAIAgent } from '@/lib/chatToPay/telegramAgent'

export const dynamic = 'force-dynamic'

/**
 * Telegram Webhook Health / Status
 */
export async function GET() {
  return NextResponse.json({
    status: 'active',
    platform: 'telegram',
    endpoint: '/api/chat-to-pay/webhook/telegram',
  })
}

/**
 * Incoming Telegram Updates (POST)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))

    if (!body || (!body.message && !body.callback_query)) {
      return NextResponse.json({ ok: true, status: 'ignored_empty' })
    }

    const agent = new TelegramAIAgent()
    await agent.handleTelegramUpdate(body)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[Telegram Webhook] Error processing update:', err)
    // Always return HTTP 200 so Telegram doesn't queue and retry endlessly
    return NextResponse.json({ ok: true, error: err.message || 'Internal error' })
  }
}
