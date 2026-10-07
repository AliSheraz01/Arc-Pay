import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createPublicClient, http, parseAbiItem } from 'viem'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const arcClient = createPublicClient({
  transport: http('https://rpc.mainnet.arc.io')
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params
    if (!address) return NextResponse.json([])

    const addrLower = address.toLowerCase()
    const targetAddress = address as `0x${string}`

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
    const fetchHeaders = {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }

    try {
      const tokenTxUrl = `https://explorer.arc.io/api?module=account&action=tokentx&address=${addrLower}`
      const res = await fetch(tokenTxUrl, { headers: fetchHeaders, cache: 'no-store' })
      if (res.ok) {
        const text = await res.text()
        if (text.startsWith('{')) {
          const data = JSON.parse(text)
          if (data.status === '1' && Array.isArray(data.result)) {
            for (const tx of data.result) {
              const rawAmount = tx.value || '0'
              const decimals = Number(tx.tokenDecimal) || 6
              const formattedAmount = (Number(rawAmount) / Math.pow(10, decimals)).toString()

              onChainTxs.push({
                id: tx.hash + '_' + tx.from + '_' + tx.nonce,
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
              })
            }
          }
        }
      }
    } catch (explorerErr) {
      console.warn('[Transactions API] Arc Explorer API tokentx warning:', explorerErr)
    }

    // 3. Fallback: Query live RPC node (last 2000 blocks) if Blockscout was blocked
    if (onChainTxs.length === 0) {
      try {
        const latestBlock = await arcClient.getBlockNumber()
        const fromBlock = latestBlock > 2000n ? latestBlock - 2000n : 0n

        const transferEvent = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')
        
        const [sentLogs, receivedLogs] = await Promise.all([
          arcClient.getLogs({
            address: '0x3600000000000000000000000000000000000000',
            event: transferEvent,
            args: { from: targetAddress },
            fromBlock,
            toBlock: 'latest'
          }).catch(() => []),
          arcClient.getLogs({
            address: '0x3600000000000000000000000000000000000000',
            event: transferEvent,
            args: { to: targetAddress },
            fromBlock,
            toBlock: 'latest'
          }).catch(() => [])
        ])

        const rpcLogs = [...sentLogs, ...receivedLogs]
        for (const log of rpcLogs) {
          if (log.transactionHash && log.args) {
            const rawVal = log.args.value ? log.args.value.toString() : '0'
            const formatted = (Number(rawVal) / 1e6).toString()
            const fromAddr = log.args.from?.toLowerCase() || ''
            const toAddr = log.args.to?.toLowerCase() || ''

            onChainTxs.push({
              id: log.transactionHash + '_' + fromAddr,
              txHash: log.transactionHash,
              fromAddress: fromAddr,
              toAddress: toAddr,
              amount: formatted,
              token: 'USDC',
              chainId: 5042,
              type: fromAddr === addrLower ? 'SEND' : 'RECEIVE',
              status: 'COMPLETED',
              explorerUrl: `https://explorer.arc.io/tx/${log.transactionHash}`,
              timestamp: new Date().toISOString(),
              confirmedAt: new Date().toISOString(),
            })
          }
        }
      } catch (rpcErr) {
        console.warn('[Transactions API] Arc RPC getLogs warning:', rpcErr)
      }
    }

    // 4. Merge DB transactions and On-chain Explorer/RPC transactions deduplicated by txHash
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
