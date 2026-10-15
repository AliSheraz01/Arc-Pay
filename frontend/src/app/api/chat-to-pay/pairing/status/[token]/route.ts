import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const normalized = token.toUpperCase()

    const session = await db.whatsAppSession.findUnique({
      where: { pairingToken: normalized },
      select: {
        id: true,
        status: true,
        phoneId: true,
        spendingLimit: true,
        spentAmount: true,
        validUntil: true,
        pairingTokenExpiresAt: true,
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    return NextResponse.json({
      paired: session.status === 'PAIRED',
      status: session.status,
      phoneId: session.phoneId,
      spendingLimit: session.spendingLimit,
      spentAmount: session.spentAmount,
      validUntil: session.validUntil,
    })
  } catch (err: any) {
    console.error('[Pairing Status API] Error:', err)
    return NextResponse.json({ error: 'Failed to retrieve session status' }, { status: 500 })
  }
}
