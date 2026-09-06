import { NextRequest, NextResponse } from 'next/server'

export interface BountySubmission {
  id: string
  bountyId: string
  submitterAddress: string
  content: string
  status: 'PENDING' | 'WINNER' | 'REJECTED'
  rewardAmount?: string | null
  rewardTxHash?: string | null
  createdAt: string
}

export interface Bounty {
  id: string
  title: string
  description?: string | null
  creatorAddress: string
  prizeAmount: string
  token: string
  chainId: number
  status: 'OPEN' | 'REVIEWING' | 'COMPLETED' | 'CANCELLED'
  fundTxHash?: string | null
  createdAt: string
  updatedAt: string
  submissions: BountySubmission[]
}

export const bountiesStore: Map<string, Bounty> =
  (globalThis as any).__bountiesStore || ((globalThis as any).__bountiesStore = new Map())

export async function GET() {
  const list = Array.from(bountiesStore.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
  return NextResponse.json(list)
}

export async function POST(request: NextRequest) {
  try {
    const { title, description, creatorAddress, prizeAmount } = await request.json()
    if (!title || !creatorAddress || !prizeAmount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const id = `bounty_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const newBounty: Bounty = {
      id,
      title,
      description: description || '',
      creatorAddress: creatorAddress.toLowerCase(),
      prizeAmount,
      token: 'USDC',
      chainId: 5042002,
      status: 'OPEN',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      submissions: [],
    }

    bountiesStore.set(id, newBounty)
    return NextResponse.json(newBounty)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Creation failed' }, { status: 500 })
  }
}
