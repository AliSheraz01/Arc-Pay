import { NextRequest, NextResponse } from 'next/server'
import { socialAccountsStore } from '@/app/api/resolve/[identifier]/route'

export async function POST(request: NextRequest) {
  try {
    const { address, username, displayName, avatar, providerUserId } = await request.json()
    if (!address || !username) {
      return NextResponse.json({ error: 'Address and username required' }, { status: 400 })
    }

    let clean = username.trim()
    if (clean.startsWith('@')) clean = clean.substring(1)

    const account = {
      userId: `usr_${address.toLowerCase()}`,
      provider: 'x',
      providerUserId: providerUserId || `x_uid_${clean.toLowerCase()}`,
      username: clean,
      displayName: displayName || `@${clean}`,
      avatar: avatar || `https://unavatar.io/twitter/${clean}`,
      address: address.toLowerCase(),
    }

    socialAccountsStore.set(address.toLowerCase(), account)

    return NextResponse.json({
      success: true,
      socialAccount: account,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Connection failed' }, { status: 500 })
  }
}
