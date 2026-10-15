import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "WhatsAppSession" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "phoneId" TEXT,
          "pairingToken" TEXT NOT NULL,
          "pairingTokenExpiresAt" DATETIME NOT NULL,
          "smartAccountAddress" TEXT NOT NULL,
          "ownerAddress" TEXT NOT NULL,
          "sessionPublicKey" TEXT NOT NULL,
          "sessionPrivateKeyEncrypted" TEXT NOT NULL,
          "spendingLimit" TEXT NOT NULL,
          "spentAmount" TEXT NOT NULL DEFAULT '0',
          "validUntil" DATETIME NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'PENDING_PAIRING',
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL
      );
    `)

    await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppSession_phoneId_key" ON "WhatsAppSession"("phoneId");`)
    await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppSession_pairingToken_key" ON "WhatsAppSession"("pairingToken");`)
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "WhatsAppSession_phoneId_idx" ON "WhatsAppSession"("phoneId");`)
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "WhatsAppSession_pairingToken_idx" ON "WhatsAppSession"("pairingToken");`)
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "WhatsAppSession_ownerAddress_idx" ON "WhatsAppSession"("ownerAddress");`)

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ChatPaymentIntent" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "phoneId" TEXT NOT NULL,
          "sessionId" TEXT NOT NULL,
          "rawMessage" TEXT NOT NULL,
          "action" TEXT NOT NULL DEFAULT 'PAY',
          "amount" TEXT NOT NULL,
          "asset" TEXT NOT NULL DEFAULT 'USDC',
          "recipientInput" TEXT NOT NULL,
          "recipientType" TEXT NOT NULL,
          "resolvedAddress" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'AWAITING_CONFIRMATION',
          "expiresAt" DATETIME NOT NULL,
          "txHash" TEXT,
          "userOpHash" TEXT,
          "errorMessage" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL,
          CONSTRAINT "ChatPaymentIntent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WhatsAppSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `)

    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ChatPaymentIntent_phoneId_idx" ON "ChatPaymentIntent"("phoneId");`)
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ChatPaymentIntent_sessionId_idx" ON "ChatPaymentIntent"("sessionId");`)
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ChatPaymentIntent_status_idx" ON "ChatPaymentIntent"("status");`)

    return NextResponse.json({ success: true, message: 'Chat-to-Pay tables successfully initialized on Turso!' })
  } catch (err: any) {
    console.error('Migration error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
