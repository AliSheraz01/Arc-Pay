import { NextRequest, NextResponse } from 'next/server'
import { setTelegramWebhook } from '@/lib/chatToPay/telegramApi'

export const dynamic = 'force-dynamic'

/**
 * 1-Click Webhook Setup for Telegram
 * Visit this endpoint in your browser to automatically register the webhook with Telegram
 */
export async function GET(request: NextRequest) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) {
      return NextResponse.json({
        ok: false,
        error: 'TELEGRAM_BOT_TOKEN is not configured in Vercel environment variables.',
        instructions: 'Add TELEGRAM_BOT_TOKEN to your Vercel Project Settings > Environment Variables, then redeploy.'
      }, { status: 400 })
    }

    const host = request.headers.get('host') || 'easyzpay.xyz'
    const proto = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
    const webhookUrl = `${proto}://${host}/api/chat-to-pay/webhook/telegram`

    const result = await setTelegramWebhook(webhookUrl)

    return NextResponse.json({
      success: true,
      message: 'Telegram Webhook successfully registered!',
      webhookUrl,
      telegramResponse: result,
    })
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err.message || 'Failed to register webhook with Telegram.',
    }, { status: 500 })
  }
}
