import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params
    if (!address) return NextResponse.json([])

    const addrLower = address.toLowerCase()

    const crossPays = await db.crossPay.findMany({
      where: {
        OR: [
          { senderAddress: addrLower },
          { recipientAddress: addrLower },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json(crossPays)
  } catch (err: any) {
    console.error('Failed to fetch Cross Pay user history from Turso:', err)
    return NextResponse.json([], { status: 500 })
  }
}
