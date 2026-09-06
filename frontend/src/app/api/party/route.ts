import { NextRequest, NextResponse } from 'next/server'

export interface PartyParticipant {
  id: string
  partyId: string
  identifier: string
  resolvedAddress: string | null
  amount: string
  status: 'PENDING' | 'PAID' | 'FAILED'
  txHash?: string | null
}

export interface Party {
  id: string
  name: string
  creatorAddress: string
  splitType: string
  totalAmount: string
  token: string
  chainId: number
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  createdAt: string
  updatedAt: string
  participants: PartyParticipant[]
}

export const partiesStore: Map<string, Party> =
  (globalThis as any).__partiesStore || ((globalThis as any).__partiesStore = new Map())

export async function POST(request: NextRequest) {
  try {
    const { name, creatorAddress, splitType, totalAmount, participants } = await request.json()
    if (!name || !creatorAddress || !totalAmount || !participants?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const partyId = `party_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const newParty: Party = {
      id: partyId,
      name,
      creatorAddress: creatorAddress.toLowerCase(),
      splitType: splitType || 'equal',
      totalAmount,
      token: 'USDC',
      chainId: 5042002,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      participants: participants.map((p: any, idx: number) => ({
        id: `pp_${partyId}_${idx}`,
        partyId,
        identifier: p.identifier,
        resolvedAddress: p.resolvedAddress || null,
        amount: p.amount,
        status: 'PENDING',
      })),
    }

    partiesStore.set(partyId, newParty)
    return NextResponse.json(newParty)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Party creation failed' }, { status: 500 })
  }
}
