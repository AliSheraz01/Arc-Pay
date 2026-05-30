'use client'

import { useAccount } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { Header } from '@/components/Header'
import { NetworkGuard } from '@/components/NetworkGuard'
import { BACKEND_URL, EXPLORER_URL } from '@/lib/constants'
import Link from 'next/link'

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
      <div style={{ minHeight: '100vh', background: '#0a0a0f' }}>
        <Header />
        <div style={{ maxWidth: '480px', margin: '80px auto', padding: '0 16px', textAlign: 'center' }}>
          <p style={{ color: '#8888aa' }}>Connect your wallet to view history.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f' }}>
      <Header />
      <main style={{ maxWidth: '480px', margin: '0 auto', padding: '24px 16px' }}>
        <Link href="/" style={{ color: '#55556a', fontSize: '13px', textDecoration: 'none', display: 'block', marginBottom: '20px' }}>
          ← Back
        </Link>

        <NetworkGuard>
          <div style={{ background: '#111118', border: '1px solid #2a2a3a', borderRadius: '20px', padding: '24px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#f0f0ff', marginBottom: '6px' }}>Transaction History</h1>
            <p style={{ color: '#55556a', fontSize: '13px', marginBottom: '24px' }}>Your recent USDC transfers on Arc Network</p>

            {isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[1, 2, 3].map(i => (
                  <div key={i} style={{ height: '72px', borderRadius: '12px', background: '#1a1a24' }} className="shimmer" />
                ))}
              </div>
            ) : !transactions || transactions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🌀</div>
                <p style={{ color: '#55556a', fontSize: '14px' }}>No transactions yet</p>
                <Link href="/send" style={{ color: '#7c3aed', fontSize: '13px', textDecoration: 'none', display: 'block', marginTop: '12px' }}>
                  Send your first payment →
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {transactions.map(tx => {
                  const isSent = tx.fromAddress.toLowerCase() === address?.toLowerCase()
                  const amountFormatted = (parseInt(tx.amount) / 1e6).toFixed(2)
                  const shortHash = `${tx.txHash.slice(0, 8)}…${tx.txHash.slice(-6)}`
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
                        background: '#0a0a0f', border: '1px solid #2a2a3a',
                        borderRadius: '14px', padding: '14px 16px',
                        transition: 'border-color 0.2s',
                      }}
                        onMouseOver={e => (e.currentTarget as HTMLDivElement).style.borderColor = '#7c3aed'}
                        onMouseOut={e => (e.currentTarget as HTMLDivElement).style.borderColor = '#2a2a3a'}
                      >
                        {/* Icon */}
                        <div style={{
                          width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                          background: isSent ? '#ff446615' : '#00d4a815',
                          border: `1px solid ${isSent ? '#ff446630' : '#00d4a830'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '18px',
                        }}>
                          {isSent ? '↑' : '↓'}
                        </div>

                        {/* Details */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: '#f0f0ff', fontWeight: 700, fontSize: '14px', marginBottom: '2px' }}>
                            {isSent ? 'Sent' : 'Received'}
                          </div>
                          <div style={{ color: '#55556a', fontSize: '12px', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {counterparty.slice(0, 8)}…{counterparty.slice(-6)}
                          </div>
                          {tx.memo && (
                            <div style={{ color: '#8888aa', fontSize: '12px', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {tx.memo}
                            </div>
                          )}
                        </div>

                        {/* Amount + date */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{
                            fontWeight: 800, fontSize: '15px',
                            color: isSent ? '#ff4466' : '#00d4a8',
                          }}>
                            {isSent ? '-' : '+'}{amountFormatted}
                          </div>
                          <div style={{ color: '#55556a', fontSize: '11px' }}>USDC</div>
                          <div style={{ color: '#55556a', fontSize: '11px', marginTop: '2px' }}>{date}</div>
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
    </div>
  )
}
