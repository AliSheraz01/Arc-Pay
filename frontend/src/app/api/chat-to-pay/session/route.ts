import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET: Retrieve active persistent WhatsApp session from Turso Cloud database
 * Ensures refreshing webpage maintains the paired session state.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')?.toLowerCase().trim()

    if (!address) {
      return NextResponse.json({ error: 'address parameter is required' }, { status: 400 })
    }

    // 1. Query non-volatile database for active paired session
    let session = await db.whatsAppSession.findFirst({
      where: {
        OR: [
          { ownerAddress: address },
          { smartAccountAddress: address },
        ],
        status: 'PAIRED',
        validUntil: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        phoneId: true,
        pairingToken: true,
        spendingLimit: true,
        spentAmount: true,
        validUntil: true,
        status: true,
        createdAt: true,
      },
    })

    // 2. Case-insensitive raw SQL fallback in case address was saved in mixed-case
    if (!session) {
      try {
        const rawMatches: any = await db.$queryRawUnsafe(`
          SELECT id, phoneId, pairingToken, spendingLimit, spentAmount, validUntil, status, createdAt
          FROM WhatsAppSession
          WHERE (LOWER(ownerAddress) = LOWER(?) OR LOWER(smartAccountAddress) = LOWER(?))
            AND status = 'PAIRED'
            AND validUntil > CURRENT_TIMESTAMP
          ORDER BY createdAt DESC
          LIMIT 1
        `, address, address)
        if (rawMatches && rawMatches.length > 0) {
          session = rawMatches[0]
        }
      } catch (sqlErr) {
        console.warn('[Session API] Raw SQL fallback note:', sqlErr)
      }
    }

    if (!session) {
      return NextResponse.json({ found: false })
    }


    return NextResponse.json({
      found: true,
      session: {
        paired: true,
        sessionId: session.id,
        phoneId: session.phoneId,
        spendingLimit: session.spendingLimit,
        spentAmount: session.spentAmount,
        validUntil: session.validUntil,
        status: session.status,
      },
    })
  } catch (err: any) {
    console.error('[Session API] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * DELETE: Revoke active session if user chooses to disconnect
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId parameter is required' }, { status: 400 })
    }

    await db.whatsAppSession.update({
      where: { id: sessionId },
      data: { status: 'REVOKED' },
    })

    return NextResponse.json({ success: true, message: 'Session revoked successfully' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
