import { NextRequest, NextResponse } from 'next/server'
import { socialAccountsStore } from '@/app/api/resolve/[identifier]/route'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { address } = body
    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 })
    }

    socialAccountsStore.delete(address.toLowerCase())
    return NextResponse.json({ success: true, message: 'X account disconnected.' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Disconnect failed' }, { status: 500 })
  }
}
