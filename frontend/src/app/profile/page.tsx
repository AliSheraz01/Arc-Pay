'use client'

import { useState, useEffect } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { PageLayout } from '@/components/PageLayout'
import { NetworkGuard } from '@/components/NetworkGuard'
import {
  USDC_ADDRESS,
  REGISTRY_ADDRESS,
  EXPLORER_URL,
  ARC_CHAIN_ID,
  BACKEND_URL,
} from '@/lib/constants'
import { USDC_ABI, REGISTRY_ABI } from '@/lib/abi'
import {
  MdPerson,
  MdCheckCircle,
  MdContentCopy,
  MdOpenInNew,
  MdAutorenew,
  MdErrorOutline,
  MdAutoAwesome,
  MdVerifiedUser,
  MdMonetizationOn,
  MdAlternateEmail,
  MdTag,
  MdArrowForward,
} from 'react-icons/md'
import { useQuery } from '@tanstack/react-query'

const REGISTRATION_FEE = parseUnits('1', 6) // 1 USDC

export default function ProfilePage() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const isCorrectNetwork = chainId === ARC_CHAIN_ID

  const [usernameInput, setUsernameInput] = useState('')
  const [approvedInSession, setApprovedInSession] = useState(false)
  const [step, setStep] = useState<'idle' | 'approving' | 'registering' | 'done'>('idle')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | undefined>()
  const [regTxHash, setRegTxHash] = useState<`0x${string}` | undefined>()

  const { writeContractAsync } = useWriteContract()

  // Read current username
  const { data: myUsername, refetch: refetchUsername } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'getMyUsername',
    account: address,
    query: { enabled: !!address && isCorrectNetwork },
  })

  // Read USDC balance
  const { data: usdcBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && isCorrectNetwork, refetchInterval: 5000 },
  })

  // Read current allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'allowance',
    args: address ? [address, REGISTRY_ADDRESS] : undefined,
    query: { enabled: !!address && isCorrectNetwork },
  })

  // Wait for approve tx
  const { isSuccess: approveSuccess } = useWaitForTransactionReceipt({
    hash: approveTxHash,
    query: { enabled: !!approveTxHash },
  })

  // Wait for register tx
  const { data: regReceipt } = useWaitForTransactionReceipt({
    hash: regTxHash,
    query: { enabled: !!regTxHash },
  })

  // Reset approvedInSession if username input changes
  useEffect(() => {
    setApprovedInSession(false)
  }, [usernameInput])

  // When approve succeeds, refetch allowance and reset step to idle
  useEffect(() => {
    if (approveSuccess) {
      refetchAllowance()
      setApprovedInSession(true)
      setStep('idle')
    }
  }, [approveSuccess, refetchAllowance])

  // When register receipt lands, mark done
  useEffect(() => {
    if (regReceipt && step === 'registering') {
      setStep('done')
      refetchUsername()
    }
  }, [regReceipt, step, refetchUsername])

  // Transaction history for stats
  const { data: txData } = useQuery({
    queryKey: ['txHistory', address],
    queryFn: async () => {
      if (!address) return { sent: 0, received: 0 }
      const res = await fetch(`${BACKEND_URL}/api/transactions?address=${address}&limit=100`)
      if (!res.ok) return { sent: 0, received: 0 }
      const data = await res.json()
      const txs: { fromAddress: string; toAddress: string; amount: string }[] = data.transactions ?? []
      const sent = txs.filter(t => t.fromAddress.toLowerCase() === address.toLowerCase())
      const received = txs.filter(t => t.toAddress.toLowerCase() === address.toLowerCase())
      const totalSent = sent.reduce((s, t) => s + parseFloat(t.amount), 0)
      const totalReceived = received.reduce((s, t) => s + parseFloat(t.amount), 0)
      return { sent: sent.length, received: received.length, totalSent, totalReceived }
    },
    enabled: !!address,
    refetchInterval: 15000,
  })

  const formattedBalance = usdcBalance !== undefined ? parseFloat(formatUnits(usdcBalance as bigint, 6)).toFixed(2) : '—'
  const hasEnoughBalance = usdcBalance !== undefined && (usdcBalance as bigint) >= REGISTRATION_FEE
  const alreadyApproved = (allowance !== undefined && (allowance as bigint) >= REGISTRATION_FEE) || approvedInSession
  const alreadyRegistered = !!(myUsername && (myUsername as string).length > 0)

  const validateUsername = (u: string) => {
    if (!u) return 'Username is required'
    if (u.length < 3) return 'At least 3 characters'
    if (u.length > 32) return 'Max 32 characters'
    if (!/^[a-zA-Z0-9_]+$/.test(u)) return 'Only letters, numbers, underscores'
    return ''
  }

  const handleRegister = async () => {
    setStep('registering')
    setError('')
    try {
      const hash = await writeContractAsync({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'registerUsername',
        args: [usernameInput.toLowerCase().trim().replace('@', '')],
      })
      setRegTxHash(hash)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg.includes('user rejected') ? 'Transaction rejected.' : `Registration failed: ${msg.slice(0, 80)}`)
      setStep('idle')
    }
  }

  const handleSubmit = async () => {
    const validationError = validateUsername(usernameInput)
    if (validationError) { setError(validationError); return }
    setError('')

    if (!hasEnoughBalance) {
      setError('Insufficient USDC balance. You need 1 USDC to register.')
      return
    }

    if (alreadyApproved) {
      await handleRegister()
      return
    }

    // Need to approve first
    setStep('approving')
    try {
      const hash = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [REGISTRY_ADDRESS, REGISTRATION_FEE],
      })
      setApproveTxHash(hash)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg.includes('user rejected') ? 'Transaction rejected.' : `Approval failed: ${msg.slice(0, 80)}`)
      setStep('idle')
    }
  }

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const shortAddr = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`

  return (
    <PageLayout>
      <NetworkGuard>
        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '0 4px' }}>

          {/* Header */}
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{
              fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)',
              letterSpacing: '-0.03em', marginBottom: '8px',
            }}>
              Your Profile
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
              Manage your Arc identity and view account stats.
            </p>
          </div>

          {/* Profile Card */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(0,212,168,0.08) 100%)',
            border: '1px solid var(--border-accent)',
            borderRadius: '24px',
            padding: '28px',
            marginBottom: '24px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Decorative blur */}
            <div style={{
              position: 'absolute', top: '-40px', right: '-40px',
              width: '160px', height: '160px',
              background: 'radial-gradient(circle, #7c3aed40 0%, transparent 70%)',
              borderRadius: '50%', pointerEvents: 'none',
            }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
              {/* Avatar */}
              <div style={{
                width: '72px', height: '72px',
                background: 'linear-gradient(135deg, #7c3aed, #00d4a8)',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '28px',
                flexShrink: 0,
                boxShadow: '0 0 24px #7c3aed50',
              }}>
                {alreadyRegistered ? (myUsername as string)[0].toUpperCase() : '👤'}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                {alreadyRegistered ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)' }}>
                        @{myUsername as string}
                      </span>
                      <MdVerifiedUser size={18} style={{ color: '#00d4a8' }} />
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Verified Arc Identity</p>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      No Username Yet
                    </span>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
                      Register below to claim your Arc identity
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Wallet Address */}
            {address && (
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '14px', padding: '14px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: '12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <MdTag size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                  <span style={{
                    fontFamily: 'monospace', fontSize: '14px',
                    color: 'var(--text-primary)', fontWeight: 600,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {shortAddr(address)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button
                    onClick={copyAddress}
                    title="Copy address"
                    style={{
                      background: 'var(--surface-raised)', border: '1px solid var(--border)',
                      borderRadius: '8px', padding: '6px 10px', cursor: 'pointer',
                      color: copied ? '#00d4a8' : 'var(--text-secondary)',
                      fontSize: '12px', fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: '4px',
                      transition: 'all 0.2s',
                    }}
                  >
                    <MdContentCopy size={13} />
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <a
                    href={`${EXPLORER_URL}/address/${address}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: 'var(--surface-raised)', border: '1px solid var(--border)',
                      borderRadius: '8px', padding: '6px 10px', cursor: 'pointer',
                      color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: '4px',
                      textDecoration: 'none', transition: 'all 0.2s',
                    }}
                  >
                    <MdOpenInNew size={13} />
                    Explorer
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Stats Row */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px', marginBottom: '24px',
          }}>
            {[
              { label: 'USDC Balance', value: `$${formattedBalance}`, icon: <MdMonetizationOn size={18} style={{ color: '#00d4a8' }} /> },
              { label: 'Sent', value: txData ? `${txData.sent} txs` : '—', icon: <MdArrowForward size={18} style={{ color: '#7c3aed' }} /> },
              { label: 'Received', value: txData ? `${txData.received} txs` : '—', icon: <MdArrowForward size={18} style={{ color: '#f59e0b', transform: 'rotate(180deg)' }} /> },
            ].map(stat => (
              <div key={stat.label} style={{
                background: 'var(--surface-raised)', border: '1px solid var(--border)',
                borderRadius: '16px', padding: '16px', textAlign: 'center',
              }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                  {stat.icon}
                </div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* Username Registration Section */}
          <div style={{
            background: 'var(--surface-raised)', border: '1px solid var(--border)',
            borderRadius: '24px', padding: '28px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{
                width: '40px', height: '40px',
                background: 'var(--accent-glow)', border: '1px solid var(--border-accent)',
                borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <MdAlternateEmail size={20} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <h2 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '2px' }}>
                  Arc Username
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  One-time registration · 1 USDC fee
                </p>
              </div>
            </div>

            {alreadyRegistered ? (
              /* Already registered */
              <div style={{
                background: 'rgba(0,212,168,0.08)', border: '1px solid rgba(0,212,168,0.3)',
                borderRadius: '16px', padding: '20px',
                display: 'flex', alignItems: 'center', gap: '14px',
              }}>
                <MdCheckCircle size={28} style={{ color: '#00d4a8', flexShrink: 0 }} />
                <div>
                  <p style={{ color: '#00d4a8', fontWeight: 800, fontSize: '16px' }}>
                    @{myUsername as string}
                  </p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
                    Your username is registered on-chain. Others can pay you using @{myUsername as string}.
                  </p>
                </div>
              </div>
            ) : step === 'done' ? (
              /* Just registered */
              <div style={{
                background: 'rgba(0,212,168,0.08)', border: '1px solid rgba(0,212,168,0.3)',
                borderRadius: '16px', padding: '20px',
                display: 'flex', alignItems: 'center', gap: '14px',
              }}>
                <MdAutoAwesome size={28} style={{ color: '#00d4a8', flexShrink: 0 }} />
                <div>
                  <p style={{ color: '#00d4a8', fontWeight: 800, fontSize: '16px' }}>
                    🎉 @{usernameInput.toLowerCase().trim()} registered!
                  </p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
                    Your Arc identity is live. Share it with anyone to receive payments.
                  </p>
                  {regTxHash && (
                    <a
                      href={`${EXPLORER_URL}/tx/${regTxHash}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--accent)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px', textDecoration: 'none' }}
                    >
                      View transaction <MdOpenInNew size={12} />
                    </a>
                  )}
                </div>
              </div>
            ) : (
              /* Registration form */
              <>
                {/* Info banner */}
                <div style={{
                  background: 'var(--accent-glow)', border: '1px solid var(--border-accent)',
                  borderRadius: '12px', padding: '12px 16px', marginBottom: '20px',
                  display: 'flex', gap: '10px', alignItems: 'flex-start',
                }}>
                  <MdErrorOutline size={16} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '1px' }} />
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.5 }}>
                    Registering a username costs <strong style={{ color: 'var(--text-primary)' }}>1 USDC</strong> paid on-chain.
                    You will be asked to approve USDC spending first, then confirm the registration.
                    Your current balance: <strong style={{ color: hasEnoughBalance ? '#00d4a8' : '#ef4444' }}>${formattedBalance} USDC</strong>
                  </p>
                </div>

                {/* Input */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    Choose your username
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)',
                      color: 'var(--accent)', fontWeight: 800, fontSize: '16px', pointerEvents: 'none',
                    }}>@</span>
                    <input
                      type="text"
                      value={usernameInput}
                      onChange={e => { setUsernameInput(e.target.value); setError('') }}
                      placeholder="yourname"
                      maxLength={32}
                      disabled={step !== 'idle'}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        background: 'var(--surface)', border: `1px solid ${error ? '#ef4444' : 'var(--border)'}`,
                        borderRadius: '14px', padding: '14px 16px 14px 36px',
                        color: 'var(--text-primary)', fontSize: '16px', fontWeight: 600,
                        outline: 'none', transition: 'border-color 0.2s',
                        fontFamily: 'monospace',
                      }}
                      onFocus={e => { if (!error) e.target.style.borderColor = 'var(--accent)' }}
                      onBlur={e => { if (!error) e.target.style.borderColor = 'var(--border)' }}
                    />
                  </div>
                  {error && (
                    <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '6px', fontWeight: 600 }}>
                      {error}
                    </p>
                  )}
                  <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '6px' }}>
                    3–32 characters · letters, numbers, underscores only · lowercase
                  </p>
                </div>

                {/* Steps indicator */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  marginBottom: '20px', padding: '12px 16px',
                  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{
                      width: '22px', height: '22px', borderRadius: '50%',
                      background: step === 'approving' ? 'var(--accent)' : step === 'registering' ? '#00d4a8' : 'var(--surface-raised)',
                      border: '2px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: 800, color: 'white',
                      transition: 'all 0.3s',
                    }}>
                      {step === 'registering' ? '✓' : '1'}
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: step === 'approving' ? 'var(--accent)' : 'var(--text-secondary)' }}>
                      Approve USDC
                    </span>
                  </div>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{
                      width: '22px', height: '22px', borderRadius: '50%',
                      background: step === 'registering' ? 'var(--accent)' : 'var(--surface-raised)',
                      border: '2px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: 800, color: 'white',
                      transition: 'all 0.3s',
                    }}>
                      2
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: step === 'registering' ? 'var(--accent)' : 'var(--text-secondary)' }}>
                      Register
                    </span>
                  </div>
                </div>

                {/* Submit button */}
                <button
                  onClick={handleSubmit}
                  disabled={step !== 'idle' || !usernameInput}
                  style={{
                    width: '100%',
                    background: step !== 'idle' || !usernameInput
                      ? 'var(--surface-raised)'
                      : 'linear-gradient(135deg, #7c3aed, #9f5aff)',
                    border: '1px solid var(--border)',
                    borderRadius: '16px',
                    padding: '16px',
                    color: step !== 'idle' || !usernameInput ? 'var(--text-secondary)' : 'white',
                    fontSize: '16px',
                    fontWeight: 800,
                    cursor: step !== 'idle' || !usernameInput ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    transition: 'all 0.2s',
                    boxShadow: step !== 'idle' || !usernameInput ? 'none' : '0 4px 20px #7c3aed40',
                  }}
                >
                  {step === 'approving' ? (
                    <><MdAutorenew size={18} style={{ animation: 'spin 1s linear infinite' }} /> Approving USDC…</>
                  ) : step === 'registering' ? (
                    <><MdAutorenew size={18} style={{ animation: 'spin 1s linear infinite' }} /> Registering on-chain…</>
                  ) : !alreadyApproved ? (
                    <><MdPerson size={18} /> Step 1: Approve 1 USDC Fee</>
                  ) : (
                    <><MdPerson size={18} /> Step 2: Register @{usernameInput.replace('@', '') || 'username'} · 1 USDC</>
                  )}
                </button>

                {/* Tx links */}
                {approveTxHash && (
                  <a href={`${EXPLORER_URL}/tx/${approveTxHash}`} target="_blank" rel="noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent)', fontSize: '12px', marginTop: '10px', textDecoration: 'none' }}>
                    <MdOpenInNew size={12} /> View approve tx
                  </a>
                )}
              </>
            )}
          </div>

          {/* Lookup section */}
          <div style={{
            background: 'var(--surface-raised)', border: '1px solid var(--border)',
            borderRadius: '24px', padding: '24px', marginTop: '20px',
          }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Lookup Username
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
              Resolve any Arc username to a wallet address.
            </p>
            <LookupForm />
          </div>
        </div>

        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </NetworkGuard>
    </PageLayout>
  )
}

function LookupForm() {
  const chainId = useChainId()
  const isCorrectNetwork = chainId === ARC_CHAIN_ID
  const [lookup, setLookup] = useState('')
  const [resolved, setResolved] = useState<string | null>(null)
  const [lookupError, setLookupError] = useState('')
  const [looking, setLooking] = useState(false)

  const { refetch: doLookup } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'resolveUsername',
    args: [lookup.toLowerCase().trim()],
    query: { enabled: false },
  })

  const handleLookup = async () => {
    if (!lookup.trim()) return
    setLooking(true)
    setResolved(null)
    setLookupError('')
    try {
      const result = await doLookup()
      const addr = result.data as string
      if (!addr || addr === '0x0000000000000000000000000000000000000000') {
        setLookupError('Username not found.')
      } else {
        setResolved(addr)
      }
    } catch {
      setLookupError('Lookup failed. Check your connection.')
    } finally {
      setLooking(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <span style={{
            position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
            color: 'var(--accent)', fontWeight: 800, fontSize: '15px', pointerEvents: 'none',
          }}>@</span>
          <input
            type="text"
            value={lookup}
            onChange={e => { setLookup(e.target.value); setLookupError(''); setResolved(null) }}
            onKeyDown={e => e.key === 'Enter' && handleLookup()}
            placeholder="username"
            disabled={!isCorrectNetwork}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '12px', padding: '12px 14px 12px 32px',
              color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600,
              outline: 'none', fontFamily: 'monospace',
            }}
          />
        </div>
        <button
          onClick={handleLookup}
          disabled={!lookup.trim() || looking || !isCorrectNetwork}
          style={{
            background: lookup.trim() && !looking && isCorrectNetwork
              ? 'linear-gradient(135deg, #7c3aed, #9f5aff)'
              : 'var(--surface-raised)',
            border: '1px solid var(--border)',
            borderRadius: '12px', padding: '12px 20px',
            color: lookup.trim() && !looking && isCorrectNetwork ? 'white' : 'var(--text-secondary)',
            fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
            transition: 'all 0.2s',
          }}
        >
          {looking ? 'Looking…' : 'Lookup'}
        </button>
      </div>

      {resolved && (
        <div style={{
          marginTop: '12px', background: 'rgba(0,212,168,0.08)',
          border: '1px solid rgba(0,212,168,0.3)', borderRadius: '12px', padding: '14px 16px',
        }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '4px', fontWeight: 600 }}>Resolved address</p>
          <p style={{ fontFamily: 'monospace', fontSize: '14px', color: '#00d4a8', wordBreak: 'break-all' }}>
            {resolved}
          </p>
        </div>
      )}
      {lookupError && (
        <p style={{ color: '#ef4444', fontSize: '13px', marginTop: '10px', fontWeight: 600 }}>
          {lookupError}
        </p>
      )}
    </div>
  )
}
