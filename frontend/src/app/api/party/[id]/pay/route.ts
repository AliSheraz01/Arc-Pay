import { NextRequest, NextResponse } from 'next/server'
import { partiesStore } from '../../route'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { participantId, txHash } = await request.json()

  const party = partiesStore.get(id)
  if (!party) {
    return NextResponse.json({ error: 'Party not found' }, { status: 404 })
  }

  const participant = party.participants.find(p => p.id === participantId)
  if (participant) {
    participant.status = 'PAID'
    participant.txHash = txHash
  }

  const allPaid = party.participants.every(p => p.status === 'PAID')
  if (allPaid) {
    party.status = 'COMPLETED'
  }
  party.updatedAt = new Date().toISOString()
  partiesStore.set(id, party)

  return NextResponse.json(participant || { success: true })
}
