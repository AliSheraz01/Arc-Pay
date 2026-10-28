import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { XBotAgentWallet } from '@/lib/xBot/agentWallet'
import { XApiClient } from '@/lib/xBot/xClient'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const agentWallet = new XBotAgentWallet()
    const xClient = new XApiClient()

    // 1. Fetch transaction statistics from Turso DB
    let totalTransactions = 0
    let totalGrossVolume = 0
    let totalFeesCollected = 0
    let recentTxs: any[] = []

    try {
      const txs = await db.xBotTransaction.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
      })
      recentTxs = txs

      const allTxs = await db.xBotTransaction.findMany({
        select: { grossAmount: true, feeAmount: true },
      })
      totalTransactions = allTxs.length
      totalGrossVolume = allTxs.reduce((sum, t) => sum + parseFloat(t.grossAmount || '0'), 0)
      totalFeesCollected = allTxs.reduce((sum, t) => sum + parseFloat(t.feeAmount || '0'), 0)
    } catch {
      // Table might not have entries yet
    }

    const feeTreasury = process.env.EASYPAY_FEE_TREASURY || process.env.NEXT_PUBLIC_FEE_TREASURY || '0x0D09b1348455540a6394c9d1Bf2F7C2b0cC40E6D'

    return NextResponse.json({
      status: 'active',
      network: 'Arc Mainnet (Chain ID 5042)',
      xApiConfigured: xClient.isConfigured(),
      agentWalletAddress: agentWallet.getAgentAddress(),
      feeTreasuryWallet: feeTreasury,
      feePercentage: '1%',
      analytics: {
        totalTransactions,
        totalGrossVolumeUSDC: totalGrossVolume.toFixed(2),
        totalFeesCollectedUSDC: totalFeesCollected.toFixed(2),
      },
      recentTransactions: recentTxs,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch status' }, { status: 500 })
  }
}
