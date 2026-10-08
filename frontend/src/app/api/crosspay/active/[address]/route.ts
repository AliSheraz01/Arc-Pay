import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params
    if (!address) {
      return NextResponse.json({ activeTx: null })
    }

    const addrLower = address.toLowerCase()

    const activeTx = await db.crossPay.findFirst({
      where: {
        senderAddress: addrLower,
        status: {
          in: [
            'CREATED',
            'VALIDATING',
            'SOURCE_TRANSACTION_PENDING',
            'SOURCE_CONFIRMED',
            'ATTESTATION_PENDING',
            'ATTESTATION_RECEIVED',
            'DESTINATION_TRANSACTION_PENDING',
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ activeTx: activeTx || null })
  } catch (error: any) {
    console.error('[CrossPay Active API] Error:', error)
    return NextResponse.json({ activeTx: null }, { status: 500 })
  }
}
