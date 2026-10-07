import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sourceChain, destinationChain, amount, senderAddress, recipientAddress, recipientUsername, idempotencyKey } = body

    if (!sourceChain || !destinationChain || !amount || !senderAddress || !recipientAddress) {
      return NextResponse.json({ error: 'Missing required fields for Cross Pay creation' }, { status: 400 })
    }

    const senderLower = senderAddress.toLowerCase()
    const recipientLower = recipientAddress.toLowerCase()

    let crossPay
    if (idempotencyKey) {
      crossPay = await db.crossPay.findUnique({ where: { idempotencyKey } })
    }

    if (!crossPay) {
      crossPay = await db.crossPay.create({
        data: {
          sourceChain: Number(sourceChain),
          destinationChain: Number(destinationChain),
          amount: amount.toString(),
          senderAddress: senderLower,
          recipientAddress: recipientLower,
          recipientUsername,
          idempotencyKey,
          status: 'CREATED',
        },
      })
    }

    return NextResponse.json({ success: true, crossPay })
  } catch (err: any) {
    console.error('Failed to create Cross Pay record in Turso:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
