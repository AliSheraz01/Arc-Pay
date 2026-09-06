import { NextRequest, NextResponse } from 'next/server'
import { socialAccountsStore } from '@/app/api/resolve/[identifier]/route'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const address = searchParams.get('address')
  if (!address) {
    return NextResponse.json({ error: 'Address required' }, { status: 400 })
  }

  const clientId = process.env.X_CLIENT_ID
  const host = request.headers.get('host') || 'localhost:3000'
  const proto = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
  const redirectUri = process.env.X_REDIRECT_URI || `${proto}://${host}/api/social/x/callback`

  if (clientId) {
    const state = Buffer.from(JSON.stringify({ address })).toString('base64')
    const authUrl = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=tweet.read%20users.read&state=${state}&code_challenge=challenge&code_challenge_method=plain`
    return NextResponse.json({ url: authUrl })
  }

  // If X_CLIENT_ID is not configured, generate a direct connect link for Arc Testnet
  const state = Buffer.from(JSON.stringify({ address })).toString('base64')
  const connectUrl = `${proto}://${host}/api/social/x/callback?state=${state}&code=testnet_direct`
  return NextResponse.json({ url: connectUrl })
}
