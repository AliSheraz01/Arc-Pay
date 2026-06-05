'use client'

import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { PageLayout } from '@/components/PageLayout'
import { NetworkGuard } from '@/components/NetworkGuard'
import { REGISTRY_ADDRESS, USDC_ADDRESS, EXPLORER_URL } from '@/lib/constants'
import { REGISTRY_ABI, USDC_ABI } from '@/lib/abi'
import Link from 'next/link'
import { formatUnits } from 'viem'
import { User, Shield, CreditCard, Clock, CheckCircle } from 'lucide-react'

export default function SettingsPage() {
  const { address, isConnected } = useAccount()
  const [usernameInput, setUsernameInput] = useState('')
  const [regTxHash, setRegTxHash] = useState<`0x${string}` | undefined>()
  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | undefined>()
  const [registering, setRegistering] = useState(false)
  const [regError, setRegError] = useState('')

  const { writeContractAsync } = useWriteContract()

  // 1. Read current username
  const { data: currentUsername, refetch } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'getMyUsername',
    query: { enabled: !!address },
  })

  // 2. Read USDC Allowance for Registry
  const { data: registryAllowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'allowance',
    args: address ? [address, REGISTRY_ADDRESS] : undefined,
    query: { enabled: !!address, refetchInterval: 5000 },
  })

  // 3. Read USDC Balance
  const { data: usdcBalance, refetch: refetchBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  const { isLoading: waitingApprove, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveTxHash })
  const { isLoading: waitingReg, isSuccess: regSuccess } = useWaitForTransactionReceipt({ hash: regTxHash })

  useEffect(() => {
    if (approveSuccess) {
      refetchAllowance()
    }
  }, [approveSuccess, refetchAllowance])

  useEffect(() => {
    if (regSuccess) {
      setRegistering(false)
      setUsernameInput('')
      refetch()
      refetchBalance()
    }
  }, [regSuccess, refetch, refetchBalance])

  const REGISTRATION_FEE = BigInt(1000000) // 1 USDC
  const hasAllowance = registryAllowance !== undefined ? registryAllowance >= REGISTRATION_FEE : false

  async function handleApproveUSDC() {
    setRegError('')
    try {
      const tx = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [REGISTRY_ADDRESS, REGISTRATION_FEE],
      })
      setApproveTxHash(tx)
    } catch (err: unknown) {
      console.error('Approval failed:', err)
      setRegError(err instanceof Error ? err.message : 'USDC approval failed')
    }
  }

  async function handleRegister() {
    if (!usernameInput) return
    setRegistering(true)
    setRegError('')
    try {
      const username = usernameInput.toLowerCase().trim().replace('@', '')
      const tx = await writeContractAsync({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'registerUsername',
        args: [username],
      })
      setRegTxHash(tx)
    } catch (err: unknown) {
      console.error('Registration failed:', err)
      const msg = err instanceof Error ? err.message : 'Registration failed'
      setRegError(
        msg.includes('already taken') 
          ? 'Username is already taken' 
          : msg.includes('has a username') 
          ? 'This wallet already has a username' 
          : 'Registration failed. Check gas and USDC balance.'
      )
      setRegistering(false)
    }
  }

  if (!isConnected) {
    return (
      <PageLayout>
        <div style={{ maxWidth: '480px', margin: '80px auto', padding: '0 16px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Connect your wallet to view settings.</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <main style={{ maxWidth: '560px', margin: '0 auto' }}>
        <Link href="/" style={{ color: 'var(--text-muted)', fontSize: '13px', textDecoration: 'none', display: 'block', marginBottom: '20px', fontWeight: 600 }}>
          ← Back to Dashboard
        </Link>

        <NetworkGuard>
          {/* Profile */}
          <div style={{ 
            background: 'var(--surface)', 
            border: '1px solid var(--border)', 
            borderRadius: '24px', 
            padding: '28px', 
            marginBottom: '20px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <User size={18} style={{ color: 'var(--accent)' }} />
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>Username</h2>
            </div>

            {currentUsername ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '16px',
                background: 'var(--surface-raised)', border: '1px solid var(--border)',
                borderRadius: '16px', padding: '16px 20px',
              }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #7c3aed, #9f5aff)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '18px', fontWeight: 900, color: 'white', flexShrink: 0,
                }}>
                  {(currentUsername as string)[0]?.toUpperCase()}
                </div>
                <div>
                  <p style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '16px' }}>@{currentUsername as string}</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px' }}>Registered on Arc Network</p>
                </div>
              </div>
            ) : (
              <>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px', lineHeight: 1.5 }}>
                  Register a unique **@username** so others can send you USDC without copy-pasting your address.
                  Creating a username requires a transaction of **1 USDC**.
                </p>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute', left: '16px', top: '50%',
                      transform: 'translateY(-50%)', color: 'var(--accent)', fontWeight: 800,
                    }}>@</span>
                    <input
                      type="text"
                      placeholder="yourname"
                      value={usernameInput}
                      onChange={e => setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      maxLength={30}
                      disabled={registering || waitingReg || waitingApprove}
                      style={{
                        width: '100%', background: 'var(--surface-raised)', border: '1px solid var(--border)',
                        borderRadius: '12px', padding: '14px 16px 14px 34px', color: 'var(--text-primary)',
                        fontSize: '15px', outline: 'none', boxSizing: 'border-box',
                      }}
                      onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                      onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                    />
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '6px' }}>
                    Lowercase letters, numbers, and underscores only
                  </p>
                </div>

                {regError && <p style={{ color: 'var(--red)', fontSize: '13px', marginBottom: '12px' }}>⚠️ {regError}</p>}

                {(waitingApprove || waitingReg || regSuccess) && (
                  <div style={{
                    background: 'var(--surface-raised)', border: '1px solid var(--border)',
                    borderRadius: '12px', padding: '14px', marginBottom: '16px',
                  }}>
                    <p style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={14} className="shimmer-rotate" />
                      <span>
                        {waitingApprove ? 'Waiting for USDC Approval...' : waitingReg ? 'Confirming on-chain...' : '✓ Username registered!'}
                      </span>
                    </p>
                    {(approveTxHash || regTxHash) && (
                      <a href={`${EXPLORER_URL}/tx/${approveTxHash || regTxHash}`} target="_blank" rel="noreferrer"
                        style={{ color: 'var(--accent)', fontSize: '11px', textDecoration: 'none', display: 'block', marginTop: '6px' }}>
                        View on ArcScan ↗
                      </a>
                    )}
                  </div>
                )}

                {!hasAllowance ? (
                  <button
                    disabled={!usernameInput || registering || waitingApprove || waitingReg}
                    onClick={handleApproveUSDC}
                    style={{
                      width: '100%',
                      background: usernameInput ? 'linear-gradient(135deg, #7c3aed, #9f5aff)' : 'var(--border)',
                      border: 'none', borderRadius: '12px', padding: '14px',
                      color: usernameInput ? 'white' : 'var(--text-secondary)',
                      fontSize: '15px', fontWeight: 800,
                      cursor: usernameInput ? 'pointer' : 'not-allowed',
                      boxShadow: usernameInput ? '0 4px 12px rgba(124, 58, 237, 0.2)' : 'none',
                    }}
                  >
                    Step 1: Approve 1 USDC Fee
                  </button>
                ) : (
                  <button
                    disabled={!usernameInput || registering || waitingApprove || waitingReg}
                    onClick={handleRegister}
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, #00d4a8, #00b896)',
                      border: 'none', borderRadius: '12px', padding: '14px',
                      color: 'white',
                      fontSize: '15px', fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(0, 212, 168, 0.25)',
                    }}
                  >
                    Step 2: Register Username (1 USDC)
                  </button>
                )}
              </>
            )}
          </div>

          {/* Wallet Info */}
          <div style={{ 
            background: 'var(--surface)', 
            border: '1px solid var(--border)', 
            borderRadius: '24px', 
            padding: '28px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <Shield size={18} style={{ color: 'var(--accent)' }} />
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>Wallet & Chain Info</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Row label="Address" value={address ?? ''} mono />
              <Row label="Network" value="Arc Testnet" />
              <Row label="Chain ID" value="5042002" />
              <Row label="RPC URL" value="rpc.testnet.arc.network" />
            </div>

            <a
              href={`${EXPLORER_URL}/address/${address}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'block', marginTop: '20px', textAlign: 'center',
                background: 'var(--surface-raised)', border: '1px solid var(--border)',
                borderRadius: '12px', padding: '12px',
                color: 'var(--accent)', fontSize: '13px', fontWeight: 700, textDecoration: 'none',
                transition: 'all 0.2s'
              }}
              onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              View Address on ArcScan ↗
            </a>
          </div>
        </NetworkGuard>
      </main>
    </PageLayout>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>{label}</span>
      <span style={{
        color: 'var(--text-primary)', fontSize: '12px', fontWeight: 700,
        fontFamily: mono ? 'monospace' : 'inherit',
        maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        textAlign: 'right',
      }}>
        {value}
      </span>
    </div>
  )
}
