'use client'

import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { Header } from '@/components/Header'
import { NetworkGuard } from '@/components/NetworkGuard'
import { REGISTRY_ADDRESS, EXPLORER_URL } from '@/lib/constants'
import { REGISTRY_ABI } from '@/lib/abi'
import Link from 'next/link'

export default function SettingsPage() {
  const { address, isConnected } = useAccount()
  const [usernameInput, setUsernameInput] = useState('')
  const [regTxHash, setRegTxHash] = useState<`0x${string}` | undefined>()
  const [registering, setRegistering] = useState(false)
  const [regError, setRegError] = useState('')

  const { writeContractAsync } = useWriteContract()

  const { data: currentUsername, refetch } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'getMyUsername',
    query: { enabled: !!address },
  })

  const { isLoading: waitingReg, isSuccess: regSuccess } = useWaitForTransactionReceipt({ hash: regTxHash })

  async function handleRegister() {
    if (!usernameInput) return
    setRegistering(true)
    setRegError('')
    try {
      const tx = await writeContractAsync({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'registerUsername',
        args: [usernameInput.toLowerCase().replace('@', '')],
      })
      setRegTxHash(tx)
      setTimeout(() => refetch(), 4000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Transaction failed'
      setRegError(msg.includes('already') ? 'Username already taken' : msg.includes('Address') ? 'This wallet already has a username' : 'Registration failed')
    } finally {
      setRegistering(false)
    }
  }

  if (!isConnected) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0f' }}>
        <Header />
        <div style={{ maxWidth: '480px', margin: '80px auto', padding: '0 16px', textAlign: 'center' }}>
          <p style={{ color: '#8888aa' }}>Connect your wallet to view settings.</p>
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
          {/* Profile */}
          <div style={{ background: '#111118', border: '1px solid #2a2a3a', borderRadius: '20px', padding: '28px', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#f0f0ff', marginBottom: '20px' }}>Username</h2>

            {currentUsername ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                background: '#7c3aed15', border: '1px solid #7c3aed30',
                borderRadius: '12px', padding: '16px',
              }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #7c3aed, #9f5aff)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '18px', fontWeight: 800, color: 'white', flexShrink: 0,
                }}>
                  {(currentUsername as string)[0]?.toUpperCase()}
                </div>
                <div>
                  <p style={{ color: '#9f5aff', fontWeight: 700, fontSize: '16px' }}>@{currentUsername as string}</p>
                  <p style={{ color: '#55556a', fontSize: '12px' }}>Registered on Arc Network</p>
                </div>
              </div>
            ) : (
              <>
                <p style={{ color: '#8888aa', fontSize: '13px', marginBottom: '16px' }}>
                  Register a @username so others can send you USDC without knowing your address.
                </p>
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute', left: '14px', top: '50%',
                      transform: 'translateY(-50%)', color: '#7c3aed', fontWeight: 700,
                    }}>@</span>
                    <input
                      type="text"
                      placeholder="yourname"
                      value={usernameInput}
                      onChange={e => setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      maxLength={30}
                      style={{
                        width: '100%', background: '#0a0a0f', border: '1px solid #2a2a3a',
                        borderRadius: '12px', padding: '14px 16px 14px 32px', color: '#f0f0ff',
                        fontSize: '15px', outline: 'none', boxSizing: 'border-box',
                      }}
                      onFocus={e => e.currentTarget.style.borderColor = '#7c3aed'}
                      onBlur={e => e.currentTarget.style.borderColor = '#2a2a3a'}
                    />
                  </div>
                  <p style={{ color: '#55556a', fontSize: '11px', marginTop: '6px' }}>
                    Lowercase letters, numbers, and underscores only
                  </p>
                </div>

                {regError && <p style={{ color: '#ff4466', fontSize: '13px', marginBottom: '12px' }}>✗ {regError}</p>}

                {(regSuccess || waitingReg) && (
                  <div style={{
                    background: '#00d4a815', border: '1px solid #00d4a830',
                    borderRadius: '10px', padding: '12px', marginBottom: '12px',
                  }}>
                    <p style={{ color: '#00d4a8', fontSize: '13px', fontWeight: 600 }}>
                      {waitingReg ? '⏳ Confirming on-chain...' : '✓ Username registered!'}
                    </p>
                    {regTxHash && (
                      <a href={`${EXPLORER_URL}/tx/${regTxHash}`} target="_blank" rel="noreferrer"
                        style={{ color: '#7c3aed', fontSize: '12px', textDecoration: 'none' }}>
                        View on ArcScan ↗
                      </a>
                    )}
                  </div>
                )}

                <button
                  disabled={!usernameInput || registering || waitingReg}
                  onClick={handleRegister}
                  style={{
                    width: '100%',
                    background: usernameInput && !registering ? 'linear-gradient(135deg, #7c3aed, #9f5aff)' : '#2a2a3a',
                    border: 'none', borderRadius: '12px', padding: '14px',
                    color: usernameInput && !registering ? 'white' : '#55556a',
                    fontSize: '15px', fontWeight: 800,
                    cursor: usernameInput && !registering ? 'pointer' : 'not-allowed',
                    boxShadow: usernameInput && !registering ? '0 0 30px #7c3aed40' : 'none',
                  }}
                >
                  {registering || waitingReg ? 'Registering...' : 'Register Username'}
                </button>
              </>
            )}
          </div>

          {/* Wallet Info */}
          <div style={{ background: '#111118', border: '1px solid #2a2a3a', borderRadius: '20px', padding: '28px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#f0f0ff', marginBottom: '16px' }}>Wallet</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Row label="Address" value={address ?? ''} mono />
              <Row label="Network" value="Arc Testnet" />
              <Row label="Chain ID" value="5042002" />
              <Row label="RPC" value="rpc.testnet.arc.network" />
            </div>

            <a
              href={`${EXPLORER_URL}/address/${address}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'block', marginTop: '20px', textAlign: 'center',
                background: '#1a1a24', border: '1px solid #2a2a3a',
                borderRadius: '12px', padding: '12px',
                color: '#7c3aed', fontSize: '13px', fontWeight: 700, textDecoration: 'none',
              }}
            >
              View on ArcScan ↗
            </a>
          </div>
        </NetworkGuard>
      </main>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #1a1a24' }}>
      <span style={{ color: '#55556a', fontSize: '13px' }}>{label}</span>
      <span style={{
        color: '#f0f0ff', fontSize: '12px',
        fontFamily: mono ? 'monospace' : 'inherit',
        maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        textAlign: 'right',
      }}>
        {value}
      </span>
    </div>
  )
}
