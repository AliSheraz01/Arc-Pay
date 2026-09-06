import { NextRequest, NextResponse } from 'next/server'
import { bountiesStore } from '../../route'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { txHash } = await request.json()

  const bounty = bountiesStore.get(id)
  if (!bounty) {
    return NextResponse.json({ error: 'Bounty not found' }, { status: 404 })
  }

  bounty.fundTxHash = txHash
  bounty.updatedAt = new Date().toISOString()
  bountiesStore.set(id, bounty)

  return NextResponse.json(bounty)
}
