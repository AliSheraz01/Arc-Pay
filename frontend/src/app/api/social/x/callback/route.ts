import { NextRequest, NextResponse } from 'next/server'
import { socialAccountsStore } from '@/app/api/resolve/[identifier]/route'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')

    const host = request.headers.get('host') || 'localhost:3000'
    const proto = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
    const baseUrl = `${proto}://${host}`

    if (!state) {
      return NextResponse.redirect(`${baseUrl}/profile?x_error=missing_state`)
    }

    let address = ''
    try {
      const parsed = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'))
      address = parsed.address
    } catch {
      return NextResponse.redirect(`${baseUrl}/profile?x_error=invalid_state`)
    }

    const clientId = process.env.X_CLIENT_ID
    const clientSecret = process.env.X_CLIENT_SECRET
    const redirectUri = process.env.X_REDIRECT_URI || `${baseUrl}/api/social/x/callback`

    let providerUserId = `x_uid_${address.slice(2, 10)}`
    let username = `user_${address.slice(2, 8)}`
    let displayName = `Arc User`
    let avatar = `https://unavatar.io/twitter/${username}`

    if (clientId && clientSecret && code && code !== 'testnet_direct') {
      try {
        const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
          },
          body: new URLSearchParams({
            code,
            grant_type: 'authorization_code',
            client_id: clientId,
            redirect_uri: redirectUri,
            code_verifier: 'challenge',
          }),
        })
        const tokenData = await tokenRes.json()
        if (tokenData.access_token) {
          const userRes = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
          })
          const userData = await userRes.json()
          if (userData.data) {
            providerUserId = userData.data.id
            username = userData.data.username
            displayName = userData.data.name || `@${username}`
            avatar = userData.data.profile_image_url || avatar
          }
        }
      } catch (err) {
        console.error('[X OAuth] Exchange failed, falling back to testnet identity:', err)
      }
    }

    // Save into serverless store
    socialAccountsStore.set(address.toLowerCase(), {
      userId: `usr_${address.toLowerCase()}`,
      provider: 'x',
      providerUserId,
      username,
      displayName,
      avatar,
      address: address.toLowerCase(),
    })

    return NextResponse.redirect(`${baseUrl}/profile?x_connected=true&username=${username}`)
  } catch (error) {
    console.error('[X Callback] Error:', error)
    return NextResponse.redirect(`/profile?x_error=true`)
  }
}
