import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, status, sourceTxHash, destinationTxHash, cctpMessageId, attestationStatus, attestationBytes, errorReason } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required for Cross Pay update' }, { status: 400 })
    }

    const existing = await db.crossPay.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Cross Pay record not found' }, { status: 404 })
    }

    const updated = await db.crossPay.update({
      where: { id },
      data: {
        status: status || existing.status,
        sourceTxHash: sourceTxHash !== undefined ? sourceTxHash : existing.sourceTxHash,
        destinationTxHash: destinationTxHash !== undefined ? destinationTxHash : existing.destinationTxHash,
        cctpMessageId: cctpMessageId !== undefined ? cctpMessageId : existing.cctpMessageId,
        attestationStatus: attestationStatus !== undefined ? attestationStatus : existing.attestationStatus,
        attestationBytes: attestationBytes !== undefined ? attestationBytes : existing.attestationBytes,
        errorReason: errorReason !== undefined ? errorReason : existing.errorReason,
      },
    })

    return NextResponse.json({ success: true, crossPay: updated })
  } catch (err: any) {
    console.error('Failed to update Cross Pay record in Turso:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
