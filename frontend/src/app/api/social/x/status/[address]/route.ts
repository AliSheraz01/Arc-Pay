import { NextRequest, NextResponse } from 'next/server'
import { socialAccountsStore } from '@/app/api/resolve/[identifier]/route'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params
  if (!address) {
    return NextResponse.json({ connected: false, account: null })
  }

  const cleanAddr = address.toLowerCase()

  // 1. Check in-memory store
  const memAcc = socialAccountsStore.get(cleanAddr)
  if (memAcc) {
    return NextResponse.json({
      connected: true,
      account: {
        username: memAcc.username,
        displayName: memAcc.displayName,
        avatar: memAcc.avatar,
        providerUserId: memAcc.providerUserId,
        connectedAt: new Date().toISOString(),
      }
    })
  }

  // 2. Check Turso Cloud Database
  try {
    const dbAccount = await db.socialAccount.findFirst({
      where: {
        provider: 'x',
        user: { address: cleanAddr },
      },
      include: { user: true },
    })

    if (dbAccount) {
      // Re-hydrate memory store
      socialAccountsStore.set(cleanAddr, {
        userId: dbAccount.userId,
        provider: 'x',
        providerUserId: dbAccount.providerUserId,
        username: dbAccount.username,
        displayName: dbAccount.displayName || `@${dbAccount.username}`,
        avatar: dbAccount.avatar,
        address: cleanAddr,
      })

      return NextResponse.json({
        connected: true,
        account: {
          username: dbAccount.username,
          displayName: dbAccount.displayName || `@${dbAccount.username}`,
          avatar: dbAccount.avatar,
          providerUserId: dbAccount.providerUserId,
          connectedAt: dbAccount.connectedAt.toISOString(),
        }
      })
    }
  } catch (err) {
    console.warn('[Social Status DB] Check error:', err)
  }

  return NextResponse.json({ connected: false, account: null })
}
