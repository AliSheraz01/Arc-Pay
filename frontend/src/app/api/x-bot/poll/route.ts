import { NextRequest, NextResponse } from 'next/server'
import { XBotWorker } from '@/lib/xBot/xWorker'

export const dynamic = 'force-dynamic'

/**
 * X Bot Polling Trigger Endpoint (GET or POST)
 * Can be called every 60s via Vercel Cron or any external cron service
 */
export async function GET(request: NextRequest) {
  return handlePoll(request)
}

export async function POST(request: NextRequest) {
  return handlePoll(request)
}

async function handlePoll(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      const urlSecret = new URL(request.url).searchParams.get('secret')
      if (urlSecret !== cronSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const worker = new XBotWorker()
    const summary = await worker.processMentions()

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...summary,
    })
  } catch (err: any) {
    console.error('[API /api/x-bot/poll] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}
