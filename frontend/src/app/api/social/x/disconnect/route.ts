import { NextRequest, NextResponse } from 'next/server'
import { socialAccountsStore } from '@/app/api/resolve/[identifier]/route'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { address } = body
    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 })
    }

    const cleanAddr = address.toLowerCase()
    socialAccountsStore.delete(cleanAddr)

    try {
      await db.socialAccount.deleteMany({
        where: {
          provider: 'x',
          user: { address: cleanAddr },
        },
      })
    } catch (dbErr) {
      console.warn('[Social Disconnect DB] Delete error:', dbErr)
    }

    return NextResponse.json({ success: true, message: 'X account disconnected.' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Disconnect failed' }, { status: 500 })
  }
}
