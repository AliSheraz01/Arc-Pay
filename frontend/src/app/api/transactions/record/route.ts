import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { txHash, fromAddress, toAddress, amount, memo, chainId, type } = body

    if (!txHash || !fromAddress || !toAddress || !amount) {
      return NextResponse.json({ error: 'txHash, fromAddress, toAddress, and amount are required.' }, { status: 400 })
    }

    const fromLower = fromAddress.toLowerCase()
    const toLower = toAddress.toLowerCase()
    const activeChainId = Number(chainId) || 5042
    const activeExplorer = activeChainId === 5042 ? 'https://explorer.arc.io' : 'https://testnet.arcscan.app'

    // Ensure User records exist
    await db.user.upsert({
      where: { address: fromLower },
      update: {},
      create: { address: fromLower },
    })
    await db.user.upsert({
      where: { address: toLower },
      update: {},
      create: { address: toLower },
    })

    const tx = await db.transaction.upsert({
      where: {
        txHash_toAddress_amount: {
          txHash,
          toAddress: toLower,
          amount: amount.toString(),
        },
      },
      update: {
        status: 'COMPLETED',
        memo: memo || undefined,
      },
      create: {
        txHash,
        fromAddress: fromLower,
        toAddress: toLower,
        amount: amount.toString(),
        memo: memo || undefined,
        token: 'USDC',
        chainId: activeChainId,
        type: type || 'SEND',
        status: 'COMPLETED',
        explorerUrl: `${activeExplorer}/tx/${txHash}`,
        timestamp: new Date(),
        confirmedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, transaction: tx })
  } catch (err: any) {
    console.error('Failed to record transaction to Turso:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
