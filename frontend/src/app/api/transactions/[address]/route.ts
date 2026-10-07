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

    const transactions = await db.transaction.findMany({
      where: {
        OR: [
          { fromAddress: addrLower },
          { toAddress: addrLower }
        ]
      },
      orderBy: { timestamp: 'desc' },
      take: 50
    })

    const enriched = transactions.map((tx: any) => ({
      ...tx,
      explorerUrl: tx.explorerUrl || `https://explorer.arc.io/tx/${tx.txHash}`,
      type: tx.type || 'SEND',
      token: tx.token || 'USDC',
      chainId: tx.chainId || 5042,
    }))

    return NextResponse.json(enriched)
  } catch (err: any) {
    console.error('Failed to fetch transactions from Turso:', err)
    return NextResponse.json([], { status: 500 })
  }
}
