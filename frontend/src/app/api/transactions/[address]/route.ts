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

    // 1. Fetch recorded transactions from Turso Cloud Database
    let dbTxs: any[] = []
    try {
      dbTxs = await db.transaction.findMany({
        where: {
          OR: [
            { fromAddress: addrLower },
            { toAddress: addrLower }
          ]
        },
        orderBy: { timestamp: 'desc' },
        take: 50
      })
    } catch (dbErr) {
      console.warn('[Transactions API] Turso DB read warning:', dbErr)
    }

    // 2. Fetch live on-chain token transactions directly from Arc Mainnet Blockscout API
    let onChainTxs: any[] = []
    try {
      const explorerUrl = `https://explorer.arc.io/api?module=account&action=tokentx&address=${addrLower}`
      const res = await fetch(explorerUrl, { headers: { Accept: 'application/json' }, next: { revalidate: 15 } })
      if (res.ok) {
        const data = await res.json()
        if (data.status === '1' && Array.isArray(data.result)) {
          onChainTxs = data.result.map((tx: any) => {
            const rawAmount = tx.value || '0'
            const decimals = Number(tx.tokenDecimal) || 6
            const formattedAmount = (Number(rawAmount) / Math.pow(10, decimals)).toString()

            return {
              id: tx.hash + '_' + tx.from,
              txHash: tx.hash,
              fromAddress: tx.from.toLowerCase(),
              toAddress: tx.to.toLowerCase(),
              amount: formattedAmount,
              token: tx.tokenSymbol || 'USDC',
              chainId: 5042,
              type: tx.from.toLowerCase() === addrLower ? 'SEND' : 'RECEIVE',
              status: 'COMPLETED',
              explorerUrl: `https://explorer.arc.io/tx/${tx.hash}`,
              timestamp: new Date(Number(tx.timeStamp) * 1000).toISOString(),
              confirmedAt: new Date(Number(tx.timeStamp) * 1000).toISOString(),
            }
          })
        }
      }
    } catch (explorerErr) {
      console.warn('[Transactions API] Arc Explorer API fetch warning:', explorerErr)
    }

    // 3. Merge DB transactions and On-chain Explorer transactions deduplicated by txHash
    const txMap = new Map<string, any>()

    // First add on-chain transactions
    for (const tx of onChainTxs) {
      txMap.set(tx.txHash.toLowerCase(), tx)
    }

    // Overlay DB transactions (which contain extra metadata like memos, usernames)
    for (const tx of dbTxs) {
      const existing = txMap.get(tx.txHash.toLowerCase())
      txMap.set(tx.txHash.toLowerCase(), {
        ...existing,
        ...tx,
        explorerUrl: tx.explorerUrl || `https://explorer.arc.io/tx/${tx.txHash}`,
        type: tx.type || existing?.type || 'SEND',
        token: tx.token || existing?.token || 'USDC',
        chainId: tx.chainId || 5042,
        timestamp: tx.timestamp || existing?.timestamp,
      })
    }

    const merged = Array.from(txMap.values()).sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    })

    return NextResponse.json(merged)
  } catch (err: any) {
    console.error('Failed to fetch transactions:', err)
    return NextResponse.json([], { status: 500 })
  }
}
