import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

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

    // Automatically sync CrossPay transaction state into the unified Transaction table
    if (updated.sourceTxHash) {
      try {
        const isCompleted = updated.status === 'complete' || updated.status === 'COMPLETED'
        await db.transaction.upsert({
          where: {
            txHash_toAddress_amount: {
              txHash: updated.sourceTxHash,
              toAddress: updated.recipientAddress,
              amount: updated.amount,
            },
          },
          update: {
            status: isCompleted ? 'COMPLETED' : 'PENDING',
            destinationTxHash: updated.destinationTxHash || undefined,
            confirmedAt: isCompleted ? new Date() : undefined,
          },
          create: {
            txHash: updated.sourceTxHash,
            fromAddress: updated.senderAddress,
            toAddress: updated.recipientAddress,
            amount: updated.amount,
            token: updated.token || 'USDC',
            chainId: updated.sourceChain,
            sourceChain: updated.sourceChain,
            destinationChain: updated.destinationChain,
            destinationTxHash: updated.destinationTxHash || undefined,
            type: 'CROSS_PAY',
            status: isCompleted ? 'COMPLETED' : 'PENDING',
            memo: `Cross-chain USDC: ${updated.sourceChain} → ${updated.destinationChain}`,
            explorerUrl: `https://explorer.arc.io/tx/${updated.sourceTxHash}`,
            timestamp: updated.createdAt,
            confirmedAt: isCompleted ? new Date() : undefined,
          },
        })
      } catch (txSyncErr) {
        console.warn('Could not sync CrossPay into Transaction table:', txSyncErr)
      }
    }

    return NextResponse.json({ success: true, crossPay: updated })
  } catch (err: any) {
    console.error('Failed to update Cross Pay record in Turso:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
