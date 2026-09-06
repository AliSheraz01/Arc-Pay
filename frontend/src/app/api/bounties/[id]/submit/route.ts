import { NextRequest, NextResponse } from 'next/server'
import { bountiesStore } from '../../route'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { submitterAddress, content } = await request.json()

  if (!submitterAddress || !content) {
    return NextResponse.json({ error: 'Submitter address and content required' }, { status: 400 })
  }

  const bounty = bountiesStore.get(id)
  if (!bounty) {
    return NextResponse.json({ error: 'Bounty not found' }, { status: 404 })
  }

  const submission = {
    id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    bountyId: id,
    submitterAddress: submitterAddress.toLowerCase(),
    content,
    status: 'PENDING' as const,
    createdAt: new Date().toISOString(),
  }

  bounty.submissions.push(submission)
  bounty.updatedAt = new Date().toISOString()
  bountiesStore.set(id, bounty)

  return NextResponse.json(submission)
}
