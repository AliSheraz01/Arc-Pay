import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http, isAddress } from 'viem'
import { ACTIVE_CHAIN, REGISTRY_ADDRESS, IS_PRODUCTION } from '@/lib/constants'
import { REGISTRY_ABI } from '@/lib/abi'

// In-memory store for connected social accounts in serverless runtime
export const socialAccountsStore: Map<string, {
  userId: string
  provider: string
  providerUserId: string
  username: string
  displayName: string
  avatar: string | null
  address: string
}> = (globalThis as any).__socialAccountsStore || ((globalThis as any).__socialAccountsStore = new Map())

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ identifier: string }> }
) {
  try {
    const { identifier } = await params
    let clean = decodeURIComponent(identifier).trim()

    let isX = false
    if (clean.toLowerCase().startsWith('x:')) {
      isX = true
      clean = clean.substring(2).trim()
    }
    if (clean.startsWith('@')) {
      clean = clean.substring(1).trim()
    }

    const response = {
      found: false,
      registered: false,
      type: 'unknown',
      userId: null as string | null,
      username: null as string | null,
      xUserId: null as string | null,
      xUsername: null as string | null,
      walletAddress: null as string | null,
      displayName: null as string | null,
      avatar: null as string | null,
    }

    // 1. Direct EVM address
    if (isAddress(clean)) {
      const addr = clean.toLowerCase()
      response.found = true
      response.registered = true
      response.type = 'wallet'
      response.walletAddress = clean

      // Check if this address has connected X
      for (const acc of socialAccountsStore.values()) {
        if (acc.address.toLowerCase() === addr) {
          response.xUserId = acc.providerUserId
          response.xUsername = acc.username
          response.displayName = acc.displayName
          response.avatar = acc.avatar
          break
        }
      }

      // Try on-chain registry to get username
      try {
        const client = createPublicClient({
          chain: ACTIVE_CHAIN as any,
          transport: http(process.env.NEXT_PUBLIC_ARC_RPC_URL || (IS_PRODUCTION ? 'https://rpc.mainnet.arc.io' : 'https://rpc.testnet.arc.network')),
        })
        const onChainName = await client.readContract({
          address: REGISTRY_ADDRESS,
          abi: REGISTRY_ABI,
          functionName: 'getMyUsername',
          account: clean as `0x${string}`,
        })
        if (onChainName && typeof onChainName === 'string' && onChainName.length > 0) {
          response.username = onChainName
          if (!response.displayName) response.displayName = `@${onChainName}`
        }
      } catch {}

      return NextResponse.json(response)
    }

    // 2. X Username search
    if (isX) {
      response.type = 'x'
      const lower = clean.toLowerCase()
      let foundAcc = null

      for (const acc of socialAccountsStore.values()) {
        if (acc.username.toLowerCase() === lower) {
          foundAcc = acc
          break
        }
      }

      if (foundAcc) {
        response.found = true
        response.registered = !!foundAcc.address
        response.userId = foundAcc.userId
        response.walletAddress = foundAcc.address
        response.xUserId = foundAcc.providerUserId
        response.xUsername = foundAcc.username
        response.displayName = foundAcc.displayName
        response.avatar = foundAcc.avatar
      } else {
        response.xUsername = clean
      }

      return NextResponse.json(response)
    }

    // 3. EasyZPay Username on-chain resolution
    response.type = 'username'
    const lowerUser = clean.toLowerCase()

    try {
      const client = createPublicClient({
        chain: ACTIVE_CHAIN as any,
        transport: http(process.env.NEXT_PUBLIC_ARC_RPC_URL || (IS_PRODUCTION ? 'https://rpc.mainnet.arc.io' : 'https://rpc.testnet.arc.network')),
      })
      const resolvedAddress = await client.readContract({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'resolveUsername',
        args: [lowerUser],
      }) as `0x${string}`

      if (
        resolvedAddress &&
        resolvedAddress !== '0x0000000000000000000000000000000000000000' &&
        isAddress(resolvedAddress)
      ) {
        response.found = true
        response.registered = true
        response.username = lowerUser
        response.walletAddress = resolvedAddress
        response.displayName = `@${lowerUser}`

        // Check if user has X connected
        for (const acc of socialAccountsStore.values()) {
          if (acc.address.toLowerCase() === resolvedAddress.toLowerCase()) {
            response.xUserId = acc.providerUserId
            response.xUsername = acc.username
            response.avatar = acc.avatar
            break
          }
        }

        return NextResponse.json(response)
      }
    } catch (err) {
      console.warn('[Resolve API] On-chain resolve failed:', err)
    }

    // Also check if matches any connected X username as fallback
    for (const acc of socialAccountsStore.values()) {
      if (acc.username.toLowerCase() === lowerUser) {
        response.found = true
        response.registered = !!acc.address
        response.type = 'x'
        response.userId = acc.userId
        response.walletAddress = acc.address
        response.xUserId = acc.providerUserId
        response.xUsername = acc.username
        response.displayName = acc.displayName
        response.avatar = acc.avatar
        return NextResponse.json(response)
      }
    }

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('[Resolve API] Error:', error)
    return NextResponse.json({ error: error.message || 'Resolution failed' }, { status: 500 })
  }
}
