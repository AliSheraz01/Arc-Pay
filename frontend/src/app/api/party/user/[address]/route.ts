import { NextRequest, NextResponse } from 'next/server'
import { partiesStore } from '../../route'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params
  const addrLower = address.toLowerCase()
  const userParties = Array.from(partiesStore.values()).filter(
    p => p.creatorAddress.toLowerCase() === addrLower ||
      p.participants.some(pt => pt.resolvedAddress?.toLowerCase() === addrLower)
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return NextResponse.json(userParties)
}
