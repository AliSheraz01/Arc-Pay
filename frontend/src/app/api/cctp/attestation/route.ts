import { NextRequest, NextResponse } from 'next/server'
import { IS_PRODUCTION } from '@/config/network'

export const dynamic = 'force-dynamic'

const IRIS_API_URL = IS_PRODUCTION
  ? 'https://iris-api.circle.com'
  : 'https://iris-api-sandbox.circle.com'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sourceDomainId, transactionHash } = body

    if (sourceDomainId === undefined || !transactionHash) {
      return NextResponse.json(
        { error: 'sourceDomainId and transactionHash are required' },
        { status: 400 }
      )
    }

    const url = `${IRIS_API_URL}/v2/messages/${sourceDomainId}?transactionHash=${transactionHash}`
    const circleResponse = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    })

    if (!circleResponse.ok) {
      return NextResponse.json({
        status: 'pending',
        attestation: null,
        message: null
      })
    }

    const data: any = await circleResponse.json()
    const msg = data.messages && data.messages[0]

    if (!msg) {
      return NextResponse.json({
        status: 'pending',
        attestation: null,
        message: null
      })
    }

    const isComplete = msg.status === 'complete'
    return NextResponse.json({
      status: isComplete ? 'complete' : 'pending',
      attestation: isComplete ? msg.attestation : null,
      message: msg.message || null,
    })
  } catch (error: any) {
    console.error('[CCTP Attestation API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch attestation from Circle Iris API' },
      { status: 500 }
    )
  }
}
