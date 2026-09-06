import { NextRequest, NextResponse } from 'next/server'

export const transactionsStore: Map<string, any[]> =
  (globalThis as any).__transactionsStore || ((globalThis as any).__transactionsStore = new Map())

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params
  if (!address) return NextResponse.json([])

  const addrLower = address.toLowerCase()
  const txs = transactionsStore.get(addrLower) || []

  return NextResponse.json(txs)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params
    const tx = await request.json()
    const addrLower = address.toLowerCase()

    const list = transactionsStore.get(addrLower) || []
    if (!list.some(existing => existing.txHash === tx.txHash)) {
      list.unshift({
        ...tx,
        explorerUrl: tx.explorerUrl || `https://testnet.arcscan.app/tx/${tx.txHash}`,
        status: tx.status || 'CONFIRMED',
        timestamp: tx.timestamp || new Date().toISOString(),
      })
      transactionsStore.set(addrLower, list)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
