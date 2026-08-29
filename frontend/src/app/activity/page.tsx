'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { PageLayout } from '@/components/PageLayout'
import { NetworkGuard } from '@/components/NetworkGuard'
import { BACKEND_URL, EXPLORER_URL } from '@/lib/constants'
import Link from 'next/link'
import { 
  MdArrowBack, 
  MdCallMade, 
  MdCallReceived, 
  MdCalendarToday, 
  MdSearch, 
  MdOpenInNew, 
  MdChevronLeft, 
  MdChevronRight 
} from 'react-icons/md'

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

export default function ActivityPage() {
  const { address, isConnected } = useAccount()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'sent' | 'received'>('all')
  const [page, setPage] = useState(1)
  const itemsPerPage = 8

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
          <p style={{ color: 'var(--text-secondary)' }}>Connect your wallet to view activity.</p>
        </div>
      </PageLayout>
    )
  }

  // Apply filters and search client-side for immediate feedback
  const filteredTxs = (transactions || []).filter(tx => {
    const isSent = address ? tx.fromAddress.toLowerCase() === address.toLowerCase() : false
    
    // Filter Type
    if (filter === 'sent' && !isSent) return false
    if (filter === 'received' && isSent) return false

    // Search query match
    if (search.trim()) {
      const query = search.toLowerCase()
      const matchesHash = tx.txHash.toLowerCase().includes(query)
      const matchesFrom = tx.fromAddress.toLowerCase().includes(query)
      const matchesTo = tx.toAddress.toLowerCase().includes(query)
      const matchesMemo = tx.memo?.toLowerCase().includes(query) ?? false
      return matchesHash || matchesFrom || matchesTo || matchesMemo
    }

    return true
  })

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredTxs.length / itemsPerPage))
  const paginatedTxs = filteredTxs.slice((page - 1) * itemsPerPage, page * itemsPerPage)

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage)
    }
  }

  return (
    <PageLayout>
      <main style={{ maxWidth: '720px', margin: '0 auto' }}>
        <Link href="/" style={{ color: 'var(--text-muted)', fontSize: '13px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '20px', fontWeight: 600 }}>
          <MdArrowBack size={20} /> Back to Dashboard
        </Link>

        <NetworkGuard>
          <div style={{ 
            background: 'var(--surface)', 
            border: '1px solid var(--border)', 
            borderRadius: '24px', 
            padding: '28px',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.02)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '28px' }}>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '4px' }}>Activity</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Your unified USDC transaction timeline on Arc</p>
              </div>
            </div>

            {/* Search and Filters */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                <input
                  type="text"
                  placeholder="Search by address, hash, or memo..."
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value)
                    setPage(1) // Reset page on search
                  }}
                  style={{
                    width: '100%',
                    background: 'var(--surface-raised)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '12px 16px 12px 42px',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'all 0.2s',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                />
                <MdSearch size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              </div>

              <div style={{ display: 'flex', gap: '4px', background: 'var(--surface-raised)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                {(['all', 'sent', 'received'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => {
                      setFilter(tab)
                      setPage(1) // Reset page on filter change
                    }}
                    style={{
                      background: filter === tab ? 'var(--surface)' : 'transparent',
                      border: filter === tab ? '1px solid var(--border)' : '1px solid transparent',
                      borderRadius: '8px',
                      padding: '8px 16px',
                      color: filter === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      textTransform: 'capitalize'
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} style={{ height: '76px', borderRadius: '16px', background: 'var(--surface-raised)' }} className="shimmer" />
                ))}
              </div>
            ) : paginatedTxs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', border: '1px dashed var(--border)', borderRadius: '16px' }}>
                <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔍</div>
                <h3 style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 800, marginBottom: '6px' }}>No transactions found</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '320px', margin: '0 auto' }}>
                  {search ? "No records match your search criteria. Try a different query." : "You haven't made any transactions on this network yet."}
                </p>
                {!search && (
                  <Link href="/send" style={{ display: 'inline-block', marginTop: '16px', textDecoration: 'none' }}>
                    <button style={{
                      background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '12px', padding: '10px 20px', fontSize: '13px', fontWeight: 800, cursor: 'pointer'
                    }}>
                      Send USDC
                    </button>
                  </Link>
                )}
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {paginatedTxs.map(tx => {
                    const isSent = address ? tx.fromAddress.toLowerCase() === address.toLowerCase() : false
                    const rawAmt = tx.amount ? parseInt(tx.amount) : 0
                    const amountFormatted = !isNaN(rawAmt) ? (rawAmt / 1e6).toFixed(2) : '0.00'
                    const counterparty = isSent ? tx.toAddress : tx.fromAddress
                    const date = new Date(tx.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

                    return (
                      <div
                        key={tx.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '14px',
                          background: 'var(--surface-raised)', border: '1px solid var(--border)',
                          borderRadius: '16px', padding: '16px',
                          position: 'relative'
                        }}
                      >
                        {/* Status Icon */}
                        <div style={{
                          width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                          background: isSent ? 'var(--red-glow)' : 'var(--green-glow)',
                          border: `1px solid ${isSent ? 'rgba(255,68,102,0.1)' : 'rgba(0,212,168,0.1)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: isSent ? 'var(--red)' : 'var(--green)',
                        }}>
                          {isSent ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
                          ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="17" y1="17" x2="7" y2="7"></line><polyline points="7 17 7 7 17 7"></polyline></svg>
                          )}
                        </div>

                        {/* Details */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '14px' }}>
                              {isSent ? 'USDC Outflow' : 'USDC Inflow'}
                            </span>
                            <span style={{ 
                              fontSize: '10px', 
                              background: tx.status === 'COMPLETED' ? 'var(--green-glow)' : 'var(--border)', 
                              color: tx.status === 'COMPLETED' ? 'var(--green)' : 'var(--text-secondary)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 700,
                              textTransform: 'uppercase'
                            }}>
                              {tx.status}
                            </span>
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)', fontSize: '12px', fontFamily: 'monospace' }}>
                            <span style={{ color: 'var(--text-muted)' }}>{isSent ? 'To:' : 'From:'}</span>
                            <span>{counterparty.slice(0, 10)}…{counterparty.slice(-8)}</span>
                          </div>

                          {tx.memo && (
                            <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: 'italic' }}>
                              "{tx.memo}"
                            </div>
                          )}
                        </div>

                        {/* Amount & Date & Explorer Link */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                          <div style={{
                            fontWeight: 900, fontSize: '16px',
                            color: isSent ? 'var(--text-primary)' : 'var(--green)',
                          }}>
                            {isSent ? '-' : '+'}{amountFormatted} <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>USDC</span>
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <MdCalendarToday size={12} />
                              <span>{date}</span>
                            </div>
                            <a
                              href={`${EXPLORER_URL}/tx/${tx.txHash}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                color: 'var(--accent)',
                                background: 'var(--accent-glow)',
                                border: '1px solid var(--border-accent)',
                                borderRadius: '6px',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                textDecoration: 'none',
                                transition: 'all 0.2s',
                              }}
                              title="View on ArcScan"
                              onMouseOver={e => e.currentTarget.style.background = 'var(--accent)'}
                              onMouseOut={e => e.currentTarget.style.background = 'var(--accent-glow)'}
                            >
                              <MdOpenInNew size={12} style={{ color: 'inherit' }} />
                            </a>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                      Page {page} of {totalPages}
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handlePageChange(page - 1)}
                        disabled={page === 1}
                        style={{
                          background: 'var(--surface-raised)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          color: page === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                          cursor: page === 1 ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '13px',
                          fontWeight: 700
                        }}
                      >
                        <MdChevronLeft size={16} /> Prev
                      </button>
                      <button
                        onClick={() => handlePageChange(page + 1)}
                        disabled={page === totalPages}
                        style={{
                          background: 'var(--surface-raised)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          color: page === totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                          cursor: page === totalPages ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '13px',
                          fontWeight: 700
                        }}
                      >
                        Next <MdChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </NetworkGuard>
      </main>
    </PageLayout>
  )
}
