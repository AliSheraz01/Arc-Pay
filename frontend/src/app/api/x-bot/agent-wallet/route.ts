import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createPublicClient, createWalletClient, http, formatUnits, parseUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { ACTIVE_CHAIN, USDC_ADDRESS } from '@/lib/constants'
import { USDC_ABI } from '@/lib/abi'

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

    // 3. Read on-chain canonical ERC-20 USDC balance (6 decimals)
    let balanceFormatted = '0.00'
    try {
      const balanceUnits = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'balanceOf',
        args: [agentAddress as `0x${string}`],
      }) as bigint
      balanceFormatted = Number(formatUnits(balanceUnits, 6)).toFixed(2)
    } catch (balErr) {
      console.warn('[AgentWalletAPI] USDC balance read error:', balErr)
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

    const balanceUnits = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: 'balanceOf',
      args: [agentAccount.address],
    }) as bigint

    const balanceNum = parseFloat(formatUnits(balanceUnits, 6))
    const sweepAmountNum = parseFloat(amount || '0')
    const withdrawNum = sweepAmountNum > 0 && sweepAmountNum <= balanceNum ? sweepAmountNum : balanceNum

    if (withdrawNum <= 0) {
      return NextResponse.json({ error: 'No USDC available to withdraw' }, { status: 400 })
    }

    const withdrawUnits = parseUnits(withdrawNum.toFixed(6), 6)

    // Send ERC-20 USDC transfer back to main wallet
    const txHash = await walletClient.writeContract({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: 'transfer',
      args: [address as `0x${string}`, withdrawUnits],
      account: agentAccount,
      chain: ACTIVE_CHAIN,
    })

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
