import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http, isAddress } from 'viem'
import { arcTestnet, REGISTRY_ADDRESS } from '@/lib/constants'
import { REGISTRY_ABI } from '@/lib/abi'
import { socialAccountsStore } from '@/app/api/resolve/[identifier]/route'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params
  if (!address) {
    return NextResponse.json({ error: 'Address required' }, { status: 400 })
  }

  const addrLower = address.toLowerCase()
  let username: string | null = null

  // Check on-chain username
  if (isAddress(address)) {
    try {
      const client = createPublicClient({
        chain: arcTestnet,
        transport: http('https://rpc.testnet.arc.network'),
      })
      const onChain = await client.readContract({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'getMyUsername',
        account: address as `0x${string}`,
      })
      if (onChain && typeof onChain === 'string') {
        username = onChain
      }
    } catch {}
  }

  const xAcc = socialAccountsStore.get(addrLower)

  return NextResponse.json({
    id: `usr_${addrLower}`,
    address: addrLower,
    username: username || null,
    socialAccounts: xAcc ? [xAcc] : [],
  })
}
