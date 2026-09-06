import { NextRequest, NextResponse } from 'next/server'
import { partiesStore } from '../route'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const party = partiesStore.get(id)
  if (!party) {
    return NextResponse.json({ error: 'Party not found' }, { status: 404 })
  }
  return NextResponse.json(party)
}
