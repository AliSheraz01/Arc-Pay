import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createPublicClient, createWalletClient, http, formatUnits, parseUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { ACTIVE_CHAIN } from '@/lib/constants'

export const dynamic = 'force-dynamic'

const publicClient = createPublicClient({
  chain: ACTIVE_CHAIN,
  transport: http(process.env.NEXT_PUBLIC_ARC_RPC_URL || process.env.RPC_URL || 'https://rpc.mainnet.arc.io'),
})

// Central Agent hot wallet key or relayer
const AGENT_PRIVATE_KEY = (
  process.env.X_BOT_AGENT_PRIVATE_KEY || 
  process.env.RELAYER_PRIVATE_KEY || 
  '0xba1ecd5380605eb913a71790c804c95d87ace7b7d0a7e27800be95147f5a43d2'
) as `0x${string}`

const agentAccount = privateKeyToAccount(AGENT_PRIVATE_KEY)

/**
 * GET: Fetch User's Agent Wallet Details & On-Chain Balance
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')?.toLowerCase()

    if (!address) {
      return NextResponse.json({ error: 'Main wallet address is required' }, { status: 400 })
    }

    // 1. Check linked X account in Turso DB
    let xAccount = null
    try {
      const social = await db.socialAccount.findFirst({
        where: { provider: 'x', user: { address } },
      })
      if (social) {
        xAccount = {
          username: social.username,
          displayName: social.displayName,
          avatar: social.avatar,
        }
      }
    } catch {
      // Non-fatal if DB not yet queried
    }

    // 2. The dedicated Agent Wallet address (Non-custodial hot vault)
    const agentAddress = agentAccount.address

    // 3. Read on-chain native USDC balance of the Agent Wallet on Arc Network
    let balanceFormatted = '0.00'
    try {
      const balanceWei = await publicClient.getBalance({ address: agentAddress })
      balanceFormatted = Number(formatUnits(balanceWei, 6)).toFixed(2)
    } catch {
      balanceFormatted = '0.00'
    }

    return NextResponse.json({
      success: true,
      mainWalletAddress: address,
      agentWalletAddress: agentAddress,
      balanceUSDC: balanceFormatted,
      dailyLimitUSDC: '50.00',
      xAccount,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch agent wallet' }, { status: 500 })
  }
}

/**
 * POST: Withdraw (Sweep) funds from Agent Wallet back to user's Main Wallet
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { address, amount } = body

    if (!address) {
      return NextResponse.json({ error: 'Recipient address required' }, { status: 400 })
    }

    const walletClient = createWalletClient({
      account: agentAccount,
      chain: ACTIVE_CHAIN,
      transport: http(process.env.NEXT_PUBLIC_ARC_RPC_URL || process.env.RPC_URL || 'https://rpc.mainnet.arc.io'),
    })

    const sweepAmountNum = parseFloat(amount || '0')
    const balanceWei = await publicClient.getBalance({ address: agentAccount.address })
    const balanceNum = parseFloat(formatUnits(balanceWei, 6))

    const withdrawNum = sweepAmountNum > 0 && sweepAmountNum <= balanceNum ? sweepAmountNum : Math.max(0, balanceNum - 0.01)

    if (withdrawNum <= 0) {
      return NextResponse.json({ error: 'No funds available to withdraw' }, { status: 400 })
    }

    const txHash = await walletClient.sendTransaction({
      account: agentAccount,
      chain: ACTIVE_CHAIN,
      to: address as `0x${string}`,
      value: parseUnits(withdrawNum.toFixed(6), 6),
    } as any)

    return NextResponse.json({
      success: true,
      txHash,
      withdrawnUSDC: withdrawNum.toFixed(2),
      destination: address,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Withdrawal failed' }, { status: 500 })
  }
}
