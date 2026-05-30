'use client'

import { useAccount, useReadContract, useChainId } from 'wagmi'
import { Header } from '@/components/Header'
import { NetworkGuard } from '@/components/NetworkGuard'
import { USDC_ADDRESS, ROUTER_ADDRESS, REGISTRY_ADDRESS, EXPLORER_URL, ARC_CHAIN_ID, BACKEND_URL } from '@/lib/constants'
import { USDC_ABI, REGISTRY_ABI } from '@/lib/abi'
import Link from 'next/link'
import { formatUnits } from 'viem'
import { useQuery } from '@tanstack/react-query'

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


export default function DashboardPage() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const isCorrectNetwork = chainId === ARC_CHAIN_ID

  const { data: usdcBalance, isLoading: balanceLoading } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && isCorrectNetwork, refetchInterval: 5000 },
  })

  const { data: myUsername } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'getMyUsername',
    query: { enabled: !!address && isCorrectNetwork },
  })

  const formattedBalance = usdcBalance ? parseFloat(formatUnits(usdcBalance, 6)).toFixed(2) : '0.00'

  const { data: transactions, isLoading: txsLoading } = useQuery({
    queryKey: ['transactions', address],
    queryFn: async () => {
      if (!address) return []
      const res = await fetch(`${BACKEND_URL}/api/transactions/${address}`)
      if (!res.ok) return []
      return res.json() as Promise<Transaction[]>
    },
    enabled: !!address && isCorrectNetwork,
    refetchInterval: 8000,
  })


  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f' }}>
      <Header />

      {/* Background glows */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-200px', left: '50%', transform: 'translateX(-50%)', width: '600px', height: '600px', background: '#7c3aed15', borderRadius: '50%', filter: 'blur(100px)' }} />
        <div style={{ position: 'absolute', bottom: '-100px', right: '-100px', width: '400px', height: '400px', background: '#00d4a810', borderRadius: '50%', filter: 'blur(80px)' }} />
      </div>

      <main style={{ maxWidth: '480px', margin: '0 auto', padding: '24px 16px', position: 'relative', zIndex: 1 }}>

        {!isConnected ? (
          <OnboardingSection />
        ) : (
          <>
            <NetworkGuard>
              {/* Balance Card */}
              <div style={{
                background: 'linear-gradient(135deg, #1a0a3a 0%, #0d1a2a 100%)',
                border: '1px solid #7c3aed40',
                borderRadius: '24px',
                padding: '32px 28px',
                marginBottom: '20px',
                boxShadow: '0 0 40px #7c3aed20',
                position: 'relative',
                overflow: 'hidden',
              }}>
                {/* Decorative */}
                <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '160px', height: '160px', background: '#7c3aed15', borderRadius: '50%', filter: 'blur(40px)' }} />

                <p style={{ color: '#8888aa', fontSize: '13px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
                  USDC Balance
                </p>

                {balanceLoading ? (
                  <div style={{ height: '52px', borderRadius: '8px', background: '#ffffff10', marginBottom: '8px' }} className="shimmer" />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '48px', fontWeight: 900, color: '#f0f0ff', letterSpacing: '-0.03em', lineHeight: 1 }}>
                      {formattedBalance}
                    </span>
                    <span style={{ fontSize: '20px', fontWeight: 700, color: '#7c3aed' }}>USDC</span>
                  </div>
                )}

                {myUsername && (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    background: '#7c3aed20', border: '1px solid #7c3aed40',
                    borderRadius: '8px', padding: '4px 10px', marginTop: '4px',
                  }}>
                    <span style={{ color: '#9f5aff', fontSize: '13px', fontWeight: 700 }}>@{myUsername as string}</span>
                  </div>
                )}

                {address && (
                  <a
                    href={`${EXPLORER_URL}/address/${address}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: 'block', color: '#55556a', fontSize: '12px', marginTop: '12px', textDecoration: 'none', fontFamily: 'monospace' }}
                  >
                    {address.slice(0, 8)}…{address.slice(-6)} ↗
                  </a>
                )}
              </div>

              {/* Quick Actions */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <ActionCard href="/send" emoji="↑" label="Send" color="#7c3aed" />
                <ActionCard href="/receive" emoji="↓" label="Receive" color="#00d4a8" />
              </div>

              {/* Contract Info */}
              {(ROUTER_ADDRESS !== '0x0000000000000000000000000000000000000000') && (
                <div style={{
                  background: '#111118',
                  border: '1px solid #2a2a3a',
                  borderRadius: '16px',
                  padding: '16px',
                  marginBottom: '20px',
                }}>
                  <p style={{ color: '#55556a', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>
                    Contracts
                  </p>
                  <ContractRow label="USDC" address={USDC_ADDRESS} />
                  <ContractRow label="Router" address={ROUTER_ADDRESS} />
                  <ContractRow label="Registry" address={REGISTRY_ADDRESS} />
                </div>
              )}

              {/* Recent Tx Section */}
              <div style={{
                background: '#111118',
                border: '1px solid #2a2a3a',
                borderRadius: '16px',
                padding: '20px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <p style={{ color: '#f0f0ff', fontWeight: 700, fontSize: '15px' }}>Recent Activity</p>
                  <Link href="/history" style={{ color: '#7c3aed', fontSize: '13px', textDecoration: 'none', fontWeight: 600 }}>
                    View all →
                  </Link>
                </div>
                {txsLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[1, 2].map(i => (
                      <div key={i} style={{ height: '54px', borderRadius: '10px', background: '#1a1a24' }} className="shimmer" />
                    ))}
                  </div>
                ) : !transactions || transactions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>🌀</div>
                    <p style={{ color: '#55556a', fontSize: '14px' }}>No transactions yet</p>
                    <p style={{ color: '#55556a', fontSize: '12px', marginTop: '4px' }}>Send your first payment to get started</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {transactions.slice(0, 5).map(tx => {
                      const isSent = tx.fromAddress.toLowerCase() === address?.toLowerCase()
                      const amountFormatted = (parseInt(tx.amount) / 1e6).toFixed(2)
                      const counterparty = isSent ? tx.toAddress : tx.fromAddress

                      return (
                        <a
                          key={tx.id}
                          href={`${EXPLORER_URL}/tx/${tx.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ textDecoration: 'none' }}
                        >
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            background: '#0a0a0f', border: '1px solid #2a2a3a',
                            borderRadius: '10px', padding: '10px 12px',
                            transition: 'border-color 0.2s',
                          }}
                            onMouseOver={e => (e.currentTarget as HTMLDivElement).style.borderColor = '#7c3aed'}
                            onMouseOut={e => (e.currentTarget as HTMLDivElement).style.borderColor = '#2a2a3a'}
                          >
                            {/* Icon */}
                            <div style={{
                              width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                              background: isSent ? '#ff446615' : '#00d4a815',
                              border: `1px solid ${isSent ? '#ff446630' : '#00d4a830'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '13px', color: isSent ? '#ff4466' : '#00d4a8',
                            }}>
                              {isSent ? '↑' : '↓'}
                            </div>

                            {/* Details */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ color: '#f0f0ff', fontWeight: 700, fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {isSent ? 'To' : 'From'}: {counterparty.slice(0, 6)}…{counterparty.slice(-4)}
                              </div>
                              {tx.memo && (
                                <div style={{ color: '#8888aa', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {tx.memo}
                                </div>
                              )}
                            </div>

                            {/* Amount */}
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <span style={{
                                fontWeight: 800, fontSize: '13px',
                                color: isSent ? '#ff4466' : '#00d4a8',
                              }}>
                                {isSent ? '-' : '+'}{amountFormatted}
                              </span>
                              <span style={{ color: '#55556a', fontSize: '10px', marginLeft: '4px' }}>USDC</span>
                            </div>
                          </div>
                        </a>
                      )
                    })}
                  </div>
                )}
              </div>
            </NetworkGuard>
          </>
        )}
      </main>
    </div>
  )
}

function ActionCard({ href, emoji, label, color }: { href: string; emoji: string; label: string; color: string }) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{
        background: `${color}15`,
        border: `1px solid ${color}30`,
        borderRadius: '16px',
        padding: '20px',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
        onMouseOver={e => {
          e.currentTarget.style.background = `${color}25`
          e.currentTarget.style.borderColor = `${color}60`
          e.currentTarget.style.transform = 'translateY(-2px)'
        }}
        onMouseOut={e => {
          e.currentTarget.style.background = `${color}15`
          e.currentTarget.style.borderColor = `${color}30`
          e.currentTarget.style.transform = 'translateY(0)'
        }}
      >
        <div style={{
          width: '44px', height: '44px', borderRadius: '50%',
          background: `${color}30`, border: `1px solid ${color}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '20px', margin: '0 auto 10px',
          color,
        }}>
          {emoji}
        </div>
        <span style={{ color: '#f0f0ff', fontWeight: 700, fontSize: '15px' }}>{label}</span>
      </div>
    </Link>
  )
}

function ContractRow({ label, address }: { label: string; address: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1a1a24' }}>
      <span style={{ color: '#8888aa', fontSize: '13px' }}>{label}</span>
      <a
        href={`${EXPLORER_URL}/address/${address}`}
        target="_blank"
        rel="noreferrer"
        style={{ color: '#7c3aed', fontSize: '12px', fontFamily: 'monospace', textDecoration: 'none' }}
      >
        {address.slice(0, 6)}…{address.slice(-4)} ↗
      </a>
    </div>
  )
}

function OnboardingSection() {
  return (
    <div style={{ textAlign: 'center', paddingTop: '40px' }}>
      {/* Hero badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        background: '#7c3aed15', border: '1px solid #7c3aed30',
        borderRadius: '100px', padding: '6px 14px', marginBottom: '28px',
      }}>
        <span style={{ color: '#7c3aed', fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em' }}>
          ⚡ POWERED BY ARC NETWORK
        </span>
      </div>

      <h1 style={{
        fontSize: '42px', fontWeight: 900,
        background: 'linear-gradient(135deg, #f0f0ff 0%, #9f5aff 50%, #00d4a8 100%)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '16px',
      }}>
        Send Money at the Speed of Web3
      </h1>

      <p style={{ color: '#8888aa', fontSize: '16px', lineHeight: 1.6, marginBottom: '36px', maxWidth: '340px', margin: '0 auto 36px' }}>
        Instant USDC transfers on Arc Network. Zero friction, near-zero fees, and real-time finality.
      </p>

      {/* Features */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '40px', textAlign: 'left' }}>
        {[
          { icon: '⚡', label: 'Instant', desc: 'Sub-second finality' },
          { icon: '💸', label: 'Cheap', desc: 'Near-zero gas fees' },
          { icon: '🔒', label: 'Secure', desc: 'Non-custodial wallet' },
          { icon: '📱', label: 'Simple', desc: 'Send by @username' },
        ].map(f => (
          <div key={f.label} style={{
            background: '#111118',
            border: '1px solid #2a2a3a',
            borderRadius: '14px',
            padding: '16px',
          }}>
            <div style={{ fontSize: '22px', marginBottom: '6px' }}>{f.icon}</div>
            <div style={{ color: '#f0f0ff', fontWeight: 700, fontSize: '14px' }}>{f.label}</div>
            <div style={{ color: '#55556a', fontSize: '12px' }}>{f.desc}</div>
          </div>
        ))}
      </div>

      <p style={{ color: '#55556a', fontSize: '13px' }}>
        Connect your wallet above to get started
      </p>
    </div>
  )
}
