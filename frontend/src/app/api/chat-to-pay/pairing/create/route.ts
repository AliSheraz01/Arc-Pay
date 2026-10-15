import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generatePairingToken, encryptPrivateKey } from '@/lib/chatToPay/crypto'

export const dynamic = 'force-dynamic'

const BOT_PHONE_NUMBER = process.env.WHATSAPP_BOT_NUMBER || '923497225236'

export async function POST(request: NextRequest) {
  try {
    const { 
      smartAccountAddress, 
      ownerAddress, 
      sessionPublicKey, 
      sessionPrivateKey, 
      spendingLimit = '50.0', 
      expiryDays = 7 
    } = await request.json()

    if (!smartAccountAddress || !ownerAddress || !sessionPublicKey || !sessionPrivateKey) {
      return NextResponse.json(
        { error: 'Missing required parameters: smartAccountAddress, ownerAddress, sessionPublicKey, sessionPrivateKey' },
        { status: 400 }
      )
    }

    const pairingToken = generatePairingToken()
    const pairingTokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    const validUntil = new Date(Date.now() + Number(expiryDays) * 24 * 60 * 60 * 1000)

    const sessionPrivateKeyEncrypted = encryptPrivateKey(sessionPrivateKey)

    const session = await db.whatsAppSession.create({
      data: {
        pairingToken,
        pairingTokenExpiresAt,
        smartAccountAddress: smartAccountAddress.toLowerCase(),
        ownerAddress: ownerAddress.toLowerCase(),
        sessionPublicKey,
        sessionPrivateKeyEncrypted,
        spendingLimit: String(spendingLimit),
        validUntil,
        status: 'PENDING_PAIRING',
      },
    })

    const whatsappDeepLink = `https://wa.me/${BOT_PHONE_NUMBER}?text=${encodeURIComponent(`PAIR ${pairingToken}`)}`

    return NextResponse.json({
      success: true,
      pairingToken,
      expiresAt: pairingTokenExpiresAt.toISOString(),
      whatsappDeepLink,
      sessionId: session.id,
    })
  } catch (err: any) {
    console.error('[Pairing Create API] Error:', err)
    return NextResponse.json({ error: 'Failed to create pairing session' }, { status: 500 })
  }
}
