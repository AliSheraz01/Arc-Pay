'use client'

import { useState, useEffect } from 'react'
import { useAccount, useReadContract, useChainId } from 'wagmi'
import { useWallet } from '@solana/wallet-adapter-react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { PageLayout } from '@/components/PageLayout'
import { NetworkGuard } from '@/components/NetworkGuard'
import { USDC_ADDRESS, BACKEND_URL, EXPLORER_URL } from '@/lib/constants'
import { USDC_ABI } from '@/lib/abi'
import Link from 'next/link'
import { formatUnits } from 'viem'
import { useQuery } from '@tanstack/react-query'
import { 
  MdSend, MdCallReceived, MdVisibility, MdVisibilityOff, 
  MdPerson, MdQrCode, MdLink, MdMonetizationOn, 
  MdOpenInNew, MdChevronRight, MdCallMade
} from 'react-icons/md'
import { sepolia, baseSepolia } from 'wagmi/chains'
import { arcTestnet } from '@/lib/constants'

export default function DashboardPage() {
  const { address: evmAddress, isConnected: isEvmConnected, chainId } = useAccount()
  const { publicKey: solanaPublicKey, connected: isSolanaConnected } = useWallet()
  const solanaAddress = solanaPublicKey?.toBase58()
  
  const isConnected = isEvmConnected || isSolanaConnected

  const [hideBalance, setHideBalance] = useState(false)
  const [usernameInput, setUsernameInput] = useState('')
  const [registering, setRegistering] = useState(false)
  const [regError, setRegError] = useState('')
  const [myUsername, setMyUsername] = useState<string | null>(null)

  // Determine active chain balance
  const { data: usdcBalance, isLoading: balanceLoading } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: evmAddress ? [evmAddress] : undefined,
    query: { enabled: !!evmAddress, refetchInterval: 5000 },
  })

  const formattedBalance = usdcBalance ? parseFloat(formatUnits(usdcBalance as bigint, 6)).toFixed(2) : '0.00'

  // Fetch transactions using backend API
  const { data: transactions, isLoading: txsLoading } = useQuery({
    queryKey: ['transactions', myUsername || evmAddress || solanaAddress],
    queryFn: async () => {
      // In a real app we'd fetch by username or across all wallets.
      // For now, if we don't have a username, fetch by active EVM address.
      const queryId = myUsername ? `@${myUsername}` : evmAddress
      if (!queryId) return []
      const res = await fetch(`${BACKEND_URL}/api/transactions/${queryId}`)
      if (!res.ok) return []
      return res.json()
    },
    enabled: !!(myUsername || evmAddress),
    refetchInterval: 8000,
  })

  // Check if current wallets have a registered username
  useEffect(() => {
    async function checkIdentity() {
      // Try resolving by checking if backend knows this address
      if (evmAddress) {
        try {
          const res = await fetch(`${BACKEND_URL}/api/users/${evmAddress}`)
          if (res.ok) {
            const data = await res.json()
            if (data.username) setMyUsername(data.username)
          }
        } catch (e) {
          console.error(e)
        }
      }
    }
    checkIdentity()
  }, [evmAddress, solanaAddress])

  async function handleRegisterUsername() {
    if (!usernameInput) return
    setRegistering(true)
    setRegError('')
    try {
      const username = usernameInput.toLowerCase().trim().replace('@', '')
      
      const payload = {
        username,
        arcAddress: chainId === arcTestnet.id ? evmAddress : null,
        ethSepoliaAddress: chainId === sepolia.id ? evmAddress : null,
        baseSepoliaAddress: chainId === baseSepolia.id ? evmAddress : null,
        solanaAddress: solanaAddress || null
      }

      // If user is connected to Arc Testnet but wants to link it, we map it
      if (evmAddress) {
        if (chainId === arcTestnet.id) payload.arcAddress = evmAddress
        if (chainId === sepolia.id) payload.ethSepoliaAddress = evmAddress
        if (chainId === baseSepolia.id) payload.baseSepoliaAddress = evmAddress
      }

      const res = await fetch(`${BACKEND_URL}/api/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) throw new Error('Registration failed')
      
      const data = await res.json()
      setMyUsername(data.username)
    } catch (err: any) {
      setRegError(err.message)
    } finally {
      setRegistering(false)
    }
  }

  return (
    <PageLayout>
        {!isConnected ? (
          <div style={{ maxWidth: '600px', margin: '40px auto', textAlign: 'center', padding: '0 16px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'var(--accent-glow)', border: '1px solid var(--border-accent)',
              borderRadius: '100px', padding: '6px 14px', marginBottom: '28px',
            }}>
              <span style={{ color: 'var(--accent)', fontSize: '12px', fontWeight: 800, letterSpacing: '0.05em' }}>
                🧪 TESTNET MODE
              </span>
            </div>

            <h1 style={{
              fontSize: '44px', fontWeight: 900,
              background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--accent-bright) 50%, var(--accent) 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '16px',
            }}>
              Universal Payments
            </h1>

            <p style={{ color: 'var(--text-secondary)', fontSize: '16px', lineHeight: 1.6, marginBottom: '36px' }}>
              Map multiple wallets to one identity. Send USDC seamlessly across EVM and Solana chains.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '40px', textAlign: 'left' }}>
              {[
                { icon: '🌍', label: 'Cross-chain', desc: 'Circle CCTP powered' },
                { icon: '🦊', label: 'EVM Support', desc: 'Eth & Base Sepolia' },
                { icon: '👻', label: 'Solana', desc: 'Phantom / Solflare' },
                { icon: '📱', label: 'Identity', desc: 'Send by @username' },
              ].map(f => (
                <div key={f.label} style={{
                  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px',
                }}>
                  <div style={{ fontSize: '24px', marginBottom: '6px' }}>{f.icon}</div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '14px' }}>{f.label}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{f.desc}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
              <ConnectButton
                accountStatus="address"
                chainStatus="icon"
                showBalance={false}
                label="Connect Wallet"
              />
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '16px' }}>
              Connect your wallet to access the dashboard
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2.1fr 1fr',
            gap: '24px',
            maxWidth: '1200px',
            margin: '0 auto',
          }}
          className="dashboard-grid"
          >
            {/* Left Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Balance Card */}
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '24px', padding: '32px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', overflow: 'hidden',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.015)'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', zIndex: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      USDC Balance
                    </span>
                    <button 
                      onClick={() => setHideBalance(!hideBalance)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                    >
                      {hideBalance ? <MdVisibilityOff size={18} /> : <MdVisibility size={18} />}
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '4px' }}>
                    <span style={{ fontSize: '48px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                      {balanceLoading ? '...' : hideBalance ? '••••••' : formattedBalance}
                    </span>
                    <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent)' }}>USDC</span>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                    <Link href="/send" style={{ textDecoration: 'none' }}>
                      <button style={{
                        display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--accent)', border: 'none', borderRadius: '16px', padding: '12px 28px',
                        color: 'white', fontSize: '14px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 14px rgba(16, 53, 246, 0.2)', transition: 'all 0.2s',
                      }}>
                        <MdSend size={18} /> Cross-Chain Send
                      </button>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Profile Registration / Status Section */}
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '24px', padding: '28px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.015)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <MdPerson size={20} style={{ color: 'var(--accent)' }} />
                  <h3 style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '15px' }}>My Identity</h3>
                </div>

                {myUsername ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px 20px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{
                        width: '48px', height: '48px', borderRadius: '50%', background: 'var(--accent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 900, color: 'white'
                      }}>
                        {myUsername[0]?.toUpperCase()}
                      </div>
                      <div>
                        <h4 style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '18px' }}>@{myUsername}</h4>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px' }}>
                          Multi-chain Identity Active
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ position: 'relative' }}>
                        <span style={{
                          position: 'absolute', left: '16px', top: '50%',
                          transform: 'translateY(-50%)', color: 'var(--accent)', fontWeight: 800, fontSize: '16px'
                        }}>@</span>
                        <input 
                          type="text" 
                          placeholder="choose_username" 
                          value={usernameInput}
                          onChange={e => setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                          maxLength={24}
                          disabled={registering}
                          style={{
                            width: '100%', background: 'var(--surface-raised)', border: '1px solid var(--border)',
                            borderRadius: '12px', padding: '14px 16px 14px 34px', color: 'var(--text-primary)',
                            fontSize: '15px', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box'
                          }}
                        />
                      </div>

                      {regError && (
                        <div style={{ color: 'var(--red)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          ⚠️ <span>{regError}</span>
                        </div>
                      )}

                      <button
                        disabled={!usernameInput || registering}
                        onClick={handleRegisterUsername}
                        style={{
                          width: '100%',
                          background: usernameInput ? 'linear-gradient(135deg, #1035f6, #3b82f6)' : 'var(--border)',
                          border: 'none', borderRadius: '12px', padding: '14px 16px',
                          color: usernameInput ? 'white' : 'var(--text-secondary)',
                          fontSize: '15px', fontWeight: 800, cursor: usernameInput ? 'pointer' : 'not-allowed',
                        }}
                      >
                        {registering ? 'Creating Identity...' : 'Link Wallets & Create Identity'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Wallet Map Status */}
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '24px', padding: '24px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.015)'
              }}>
                <h3 style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '15px', marginBottom: '16px' }}>Wallet Map</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <NetworkRow 
                    label="Arc Testnet" 
                    value={chainId === arcTestnet.id ? <span style={{color: 'var(--green)'}}>Connected</span> : <span style={{color: 'var(--text-muted)'}}>Offline</span>} 
                  />
                  <NetworkRow 
                    label="Eth Sepolia" 
                    value={chainId === sepolia.id ? <span style={{color: 'var(--green)'}}>Connected</span> : <span style={{color: 'var(--text-muted)'}}>Offline</span>} 
                  />
                  <NetworkRow 
                    label="Base Sepolia" 
                    value={chainId === baseSepolia.id ? <span style={{color: 'var(--green)'}}>Connected</span> : <span style={{color: 'var(--text-muted)'}}>Offline</span>} 
                  />
                  <NetworkRow 
                    label="Solana Devnet" 
                    value={isSolanaConnected ? <span style={{color: 'var(--green)'}}>Connected</span> : <span style={{color: 'var(--text-muted)'}}>Offline</span>} 
                  />
                </div>
              </div>

            </div>
          </div>
        )}
    </PageLayout>
  )
}

function QuickActionRow({ href, icon: Icon, label }: { href: string; icon: any; label: string }) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', background: 'var(--surface-raised)', border: '1px solid var(--border)',
        borderRadius: '16px', transition: 'all 0.2s', cursor: 'pointer'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '10px',
            background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--accent)'
          }}>
            <Icon size={16} />
          </div>
          <span style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 800 }}>{label}</span>
        </div>
        <MdChevronRight size={20} style={{ color: 'var(--text-secondary)' }} />
      </div>
    </Link>
  )
}

function NetworkRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 700 }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 800 }}>{value}</span>
    </div>
  )
}

function HelpRow({ href, label }: { href: string; label: string }) {
  return (
    <a 
      href={href} target="_blank" rel="noreferrer" 
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px', background: 'var(--surface-raised)', border: '1px solid var(--border)',
        borderRadius: '12px', textDecoration: 'none', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 700,
        transition: 'all 0.2s'
      }}
    >
      <span>{label}</span>
      <MdOpenInNew size={18} style={{ color: 'var(--text-muted)' }} />
    </a>
  )
}
