import { NextRequest, NextResponse } from 'next/server'
import { socialAccountsStore } from '@/app/api/resolve/[identifier]/route'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params
  if (!address) {
    return NextResponse.json({ connected: false, account: null })
  }

  const acc = socialAccountsStore.get(address.toLowerCase())
  if (!acc) {
    return NextResponse.json({ connected: false, account: null })
  }

  return NextResponse.json({
    connected: true,
    account: {
      username: acc.username,
      displayName: acc.displayName,
      avatar: acc.avatar,
      providerUserId: acc.providerUserId,
      connectedAt: new Date().toISOString(),
    }
  })
}
