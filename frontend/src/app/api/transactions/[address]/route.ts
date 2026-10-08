import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createPublicClient, http, parseAbiItem, isAddress } from 'viem'
import { ACTIVE_CHAIN, RPC_URL, USDC_ADDRESS, ROUTER_ADDRESS, EXPLORER_URL } from '@/lib/constants'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const arcClient = createPublicClient({
  chain: ACTIVE_CHAIN as any,
  transport: http(RPC_URL)
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

    // 2. Fetch cross-chain transfers from Turso Cloud Database
    let crossPayTxs: any[] = []
    try {
      const dbCrossPays = await db.crossPay.findMany({
        where: {
          OR: [
            { senderAddress: addrLower },
            { recipientAddress: addrLower }
          ]
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      })

      for (const cp of dbCrossPays) {
        if (cp.sourceTxHash) {
          const isComplete = cp.status === 'complete' || cp.status === 'COMPLETED'
          crossPayTxs.push({
            id: cp.id,
            txHash: cp.sourceTxHash,
            fromAddress: cp.senderAddress,
            toAddress: cp.recipientAddress,
            amount: cp.amount,
            token: cp.token || 'USDC',
            chainId: cp.sourceChain,
            sourceChain: cp.sourceChain,
            destinationChain: cp.destinationChain,
            destinationTxHash: cp.destinationTxHash || undefined,
            type: 'CROSS_PAY',
            status: isComplete ? 'COMPLETED' : 'PENDING',
            memo: `Cross-chain USDC: ${cp.sourceChain} → ${cp.destinationChain}`,
            explorerUrl: `${EXPLORER_URL}/tx/${cp.sourceTxHash}`,
            timestamp: cp.createdAt.toISOString(),
            confirmedAt: isComplete ? cp.updatedAt.toISOString() : undefined,
          })
        }
      }
    } catch (cpErr) {
      console.warn('[Transactions API] CrossPay read warning:', cpErr)
    }

    // 3. Fetch live on-chain token transactions directly from Arc Mainnet Blockscout API
    let onChainTxs: any[] = []
    const fetchHeaders = {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }

    try {
      const tokenTxUrl = `${EXPLORER_URL}/api?module=account&action=tokentx&address=${addrLower}`
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
                id: tx.hash + '_' + tx.from + '_' + (tx.nonce || '0'),
                txHash: tx.hash,
                fromAddress: tx.from.toLowerCase(),
                toAddress: tx.to.toLowerCase(),
                amount: formattedAmount,
                token: tx.tokenSymbol || 'USDC',
                chainId: ACTIVE_CHAIN.id,
                type: tx.from.toLowerCase() === addrLower ? 'SEND' : 'RECEIVE',
                status: 'COMPLETED',
                explorerUrl: `${EXPLORER_URL}/tx/${tx.hash}`,
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

    // 4. Fallback: Query live RPC node (last 4500 blocks) if Blockscout was blocked or returned empty
    if (onChainTxs.length === 0 && isAddress(targetAddress)) {
      try {
        const latestBlock = await arcClient.getBlockNumber()
        // Stay within Arc's 5000 block max query range
        const fromBlock = latestBlock > 4500n ? latestBlock - 4500n : 0n

        const transferEvent = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')
        const paymentSentEvent = parseAbiItem('event PaymentSent(address indexed from, address indexed to, uint256 amount, string memo)')

        const [sentLogs, receivedLogs, routerSentLogs, routerReceivedLogs] = await Promise.all([
          arcClient.getLogs({
            address: USDC_ADDRESS,
            event: transferEvent,
            args: { from: targetAddress },
            fromBlock,
            toBlock: 'latest'
          }).catch(() => []),
          arcClient.getLogs({
            address: USDC_ADDRESS,
            event: transferEvent,
            args: { to: targetAddress },
            fromBlock,
            toBlock: 'latest'
          }).catch(() => []),
          arcClient.getLogs({
            address: ROUTER_ADDRESS,
            event: paymentSentEvent,
            args: { from: targetAddress },
            fromBlock,
            toBlock: 'latest'
          }).catch(() => []),
          arcClient.getLogs({
            address: ROUTER_ADDRESS,
            event: paymentSentEvent,
            args: { to: targetAddress },
            fromBlock,
            toBlock: 'latest'
          }).catch(() => [])
        ])

        // Process Router events first (they include memos)
        const routerLogs = [...routerSentLogs, ...routerReceivedLogs]
        for (const log of routerLogs) {
          if (log.transactionHash && log.args) {
            const rawVal = log.args.amount ? log.args.amount.toString() : '0'
            const formatted = (Number(rawVal) / 1e6).toString()
            const fromAddr = log.args.from?.toLowerCase() || ''
            const toAddr = log.args.to?.toLowerCase() || ''
            const memo = log.args.memo || ''

            onChainTxs.push({
              id: log.transactionHash + '_' + fromAddr,
              txHash: log.transactionHash,
              fromAddress: fromAddr,
              toAddress: toAddr,
              amount: formatted,
              memo,
              token: 'USDC',
              chainId: ACTIVE_CHAIN.id,
              type: fromAddr === addrLower ? 'SEND' : 'RECEIVE',
              status: 'COMPLETED',
              explorerUrl: `${EXPLORER_URL}/tx/${log.transactionHash}`,
              timestamp: new Date().toISOString(),
              confirmedAt: new Date().toISOString(),
            })
          }
        }

        // Process ERC-20 transfer events
        const transferLogs = [...sentLogs, ...receivedLogs]
        for (const log of transferLogs) {
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
              chainId: ACTIVE_CHAIN.id,
              type: fromAddr === addrLower ? 'SEND' : 'RECEIVE',
              status: 'COMPLETED',
              explorerUrl: `${EXPLORER_URL}/tx/${log.transactionHash}`,
              timestamp: new Date().toISOString(),
              confirmedAt: new Date().toISOString(),
            })
          }
        }
      } catch (rpcErr) {
        console.warn('[Transactions API] Arc RPC getLogs warning:', rpcErr)
      }
    }

    // 5. Merge all sources deduplicated by txHash
    const txMap = new Map<string, any>()

    // First add on-chain transactions
    for (const tx of onChainTxs) {
      txMap.set(tx.txHash.toLowerCase(), tx)
    }

    // Add CrossPay transactions
    for (const tx of crossPayTxs) {
      const existing = txMap.get(tx.txHash.toLowerCase())
      txMap.set(tx.txHash.toLowerCase(), {
        ...existing,
        ...tx,
      })
    }

    // Overlay DB transactions (which contain memos, usernames, specific types)
    for (const tx of dbTxs) {
      const existing = txMap.get(tx.txHash.toLowerCase())
      txMap.set(tx.txHash.toLowerCase(), {
        ...existing,
        ...tx,
        explorerUrl: tx.explorerUrl || `${EXPLORER_URL}/tx/${tx.txHash}`,
        type: tx.type || existing?.type || 'SEND',
        token: tx.token || existing?.token || 'USDC',
        chainId: tx.chainId || ACTIVE_CHAIN.id,
        timestamp: tx.timestamp || existing?.timestamp || new Date().toISOString(),
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
