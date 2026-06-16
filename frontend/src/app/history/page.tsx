'use client'

import { useAccount } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { PageLayout } from '@/components/PageLayout'
import { NetworkGuard } from '@/components/NetworkGuard'
import { BACKEND_URL, EXPLORER_URL } from '@/lib/constants'
import Link from 'next/link'
import { MdArrowBack, MdCallMade, MdCallReceived, MdCalendarToday } from 'react-icons/md'

interface Transaction {
  id: string
  txHash: string
  fromAddress: string
  toAddress: string
  amount: string
  memo?: string
  status: string
  timestamp: string
}

export default function HistoryPage() {
  const { address, isConnected } = useAccount()

  const { data: transactions, isLoading } = useQuery({
    queryKey: ['transactions', address],
    queryFn: async () => {
      if (!address) return []
      const res = await fetch(`${BACKEND_URL}/api/transactions/${address}`)
      if (!res.ok) return []
      return res.json() as Promise<Transaction[]>
    },
    enabled: !!address,
    refetchInterval: 10000,
  })

  if (!isConnected) {
    return (
      <PageLayout>
        <div style={{ maxWidth: '480px', margin: '80px auto', padding: '0 16px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Connect your wallet to view history.</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <main style={{ maxWidth: '560px', margin: '0 auto' }}>
        <Link href="/" style={{ color: 'var(--text-muted)', fontSize: '13px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px', fontWeight: 600 }}>
          <MdArrowBack size={20} /> Back to Dashboard
        </Link>

        <NetworkGuard>
          <div style={{ 
            background: 'var(--surface)', 
            border: '1px solid var(--border)', 
            borderRadius: '24px', 
            padding: '28px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
          }}>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>Transaction History</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '28px' }}>Your recent USDC transfers on Arc Network</p>

            {isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[1, 2, 3].map(i => (
                  <div key={i} style={{ height: '76px', borderRadius: '16px', background: 'var(--surface-raised)' }} className="shimmer" />
                ))}
              </div>
            ) : !transactions || transactions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', border: '1px dashed var(--border)', borderRadius: '16px' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🌀</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No transactions yet</p>
                <Link href="/send" style={{ color: 'var(--accent)', fontSize: '13px', textDecoration: 'none', display: 'block', marginTop: '12px', fontWeight: 700 }}>
                  Send your first payment →
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {transactions.map(tx => {
                  const isSent = tx.fromAddress.toLowerCase() === address?.toLowerCase()
                  const rawAmt = tx.amount ? parseInt(tx.amount) : 0
                  const amountFormatted = !isNaN(rawAmt) ? (rawAmt / 1e6).toFixed(2) : '0.00'
                  const counterparty = isSent ? tx.toAddress : tx.fromAddress
                  const date = new Date(tx.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

                  return (
                    <a
                      key={tx.id}
                      href={`${EXPLORER_URL}/tx/${tx.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ textDecoration: 'none' }}
                    >
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '14px',
                        background: 'var(--surface-raised)', border: '1px solid var(--border)',
                        borderRadius: '16px', padding: '16px',
                        transition: 'border-color 0.2s',
                      }}
                        onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                        onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
                      >
                        {/* Icon */}
                        <div style={{
                          width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                          background: isSent ? 'var(--red-glow)' : 'var(--green-glow)',
                          border: `1px solid ${isSent ? 'rgba(255,68,102,0.2)' : 'rgba(0,212,168,0.2)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: isSent ? 'var(--red)' : 'var(--green)',
                        }}>
                          {isSent ? <MdCallMade size={18} /> : <MdCallReceived size={18} />}
                        </div>

                        {/* Details */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '14px', marginBottom: '2px' }}>
                            {isSent ? 'Sent' : 'Received'}
                          </div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '12px', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {counterparty.slice(0, 10)}…{counterparty.slice(-8)}
                          </div>
                          {tx.memo && (
                            <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: 'italic' }}>
                              "{tx.memo}"
                            </div>
                          )}
                        </div>

                        {/* Amount + date */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{
                            fontWeight: 800, fontSize: '15px',
                            color: isSent ? 'var(--red)' : 'var(--green)',
                          }}>
                            {isSent ? '-' : '+'}{amountFormatted}
                          </div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 600 }}>USDC</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                            <MdCalendarToday size={16} />
                            <span>{date}</span>
                          </div>
                        </div>
                      </div>
                    </a>
                  )
                })}
              </div>
            )}
          </div>
        </NetworkGuard>
      </main>
    </PageLayout>
  )
}
