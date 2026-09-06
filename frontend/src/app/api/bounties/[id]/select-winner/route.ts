import { NextRequest, NextResponse } from 'next/server'
import { bountiesStore } from '../../route'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { submissionId, rewardAmount, rewardTxHash } = await request.json()

  const bounty = bountiesStore.get(id)
  if (!bounty) {
    return NextResponse.json({ error: 'Bounty not found' }, { status: 404 })
  }

  const sub = bounty.submissions.find(s => s.id === submissionId)
  if (sub) {
    sub.status = 'WINNER'
    sub.rewardAmount = rewardAmount
    sub.rewardTxHash = rewardTxHash
  }

  bounty.status = 'COMPLETED'
  bounty.updatedAt = new Date().toISOString()
  bountiesStore.set(id, bounty)

  return NextResponse.json({ success: true, bounty })
}
