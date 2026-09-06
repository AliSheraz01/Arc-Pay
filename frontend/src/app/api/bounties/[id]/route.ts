import { NextRequest, NextResponse } from 'next/server'
import { bountiesStore } from '../route'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const bounty = bountiesStore.get(id)
  if (!bounty) {
    return NextResponse.json({ error: 'Bounty not found' }, { status: 404 })
  }
  return NextResponse.json(bounty)
}
