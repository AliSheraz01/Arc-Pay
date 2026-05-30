'use client'

import { useState, useCallback } from 'react'
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits, isAddress } from 'viem'
import { Header } from '@/components/Header'
import { NetworkGuard } from '@/components/NetworkGuard'
import { USDC_ADDRESS, ROUTER_ADDRESS, REGISTRY_ADDRESS, EXPLORER_URL, BACKEND_URL } from '@/lib/constants'
import { USDC_ABI, ROUTER_ABI } from '@/lib/abi'
import Link from 'next/link'

type Step = 'form' | 'confirm' | 'success'

export default function SendPage() {
  const { address, isConnected } = useAccount()
  const [step, setStep] = useState<Step>('form')
  const [recipient, setRecipient] = useState('')
  const [resolvedAddress, setResolvedAddress] = useState<`0x${string}` | null>(null)
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [resolving, setResolving] = useState(false)
  const [resolveError, setResolveError] = useState('')
  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | undefined>()
  const [sendTxHash, setSendTxHash] = useState<`0x${string}` | undefined>()
  const [phase, setPhase] = useState<'idle' | 'approving' | 'sending'>('idle')

  const { writeContractAsync } = useWriteContract()

  const { data: usdcBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  const { isLoading: waitingApprove } = useWaitForTransactionReceipt({ hash: approveTxHash })
  const { isLoading: waitingSend } = useWaitForTransactionReceipt({ hash: sendTxHash })

  const balanceFormatted = usdcBalance ? parseFloat((Number(usdcBalance) / 1e6).toString()).toFixed(2) : '0.00'
  const amountNum = parseFloat(amount || '0')
  const isValidAmount = !isNaN(amountNum) && amountNum > 0 && amountNum <= parseFloat(balanceFormatted)

  // Resolve username to address
  const resolveRecipient = useCallback(async (value: string) => {
    setResolveError('')
    setResolvedAddress(null)

    if (!value) return

    // Check if it's already an address
    if (isAddress(value)) {
      setResolvedAddress(value as `0x${string}`)
      return
    }

    // Strip @ for username lookup
    const username = value.startsWith('@') ? value.slice(1) : value
    if (!username) return

    setResolving(true)
    try {
      const res = await fetch(`${BACKEND_URL}/api/resolve/${username}`)
      if (!res.ok) throw new Error('not found')
      const data = await res.json()
      setResolvedAddress(data.address as `0x${string}`)
    } catch {
      setResolveError(`Could not find user "${value}"`)
    } finally {
      setResolving(false)
    }
  }, [])

  async function handleSend() {
    if (!resolvedAddress || !isValidAmount) return
    setPhase('approving')

    try {
      const parsedAmount = parseUnits(amount, 6)

      // 1. Approve Router to spend USDC
      const approveTx = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [ROUTER_ADDRESS, parsedAmount],
      })
      setApproveTxHash(approveTx)

      // Wait briefly for approval
      await new Promise(r => setTimeout(r, 3000))

      setPhase('sending')

      // 2. Send via Router contract
      const sendTx = await writeContractAsync({
        address: ROUTER_ADDRESS,
        abi: ROUTER_ABI,
        functionName: 'sendPayment',
        args: [resolvedAddress, parsedAmount, memo],
      })
      setSendTxHash(sendTx)
      setStep('success')
    } catch (err) {
      console.error('Payment failed:', err)
      setPhase('idle')
    }
  }

  if (!isConnected) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0f' }}>
        <Header />
        <div style={{ maxWidth: '480px', margin: '80px auto', padding: '0 16px', textAlign: 'center' }}>
          <p style={{ color: '#8888aa' }}>Connect your wallet to send payments.</p>
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
          {step === 'form' && (
            <div style={{ background: '#111118', border: '1px solid #2a2a3a', borderRadius: '20px', padding: '28px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#f0f0ff', marginBottom: '4px' }}>Send USDC</h1>
              <p style={{ color: '#55556a', fontSize: '13px', marginBottom: '28px' }}>Balance: {balanceFormatted} USDC</p>

              {/* Recipient */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ color: '#8888aa', fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                  To
                </label>
                <input
                  type="text"
                  placeholder="@username or 0x address"
                  value={recipient}
                  onChange={e => {
                    setRecipient(e.target.value)
                    resolveRecipient(e.target.value)
                  }}
                  style={{
                    width: '100%', background: '#0a0a0f', border: '1px solid #2a2a3a',
                    borderRadius: '12px', padding: '14px 16px', color: '#f0f0ff',
                    fontSize: '15px', outline: 'none', boxSizing: 'border-box',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = '#7c3aed'}
                  onBlur={e => e.currentTarget.style.borderColor = '#2a2a3a'}
                />
                {resolving && <p style={{ color: '#55556a', fontSize: '12px', marginTop: '6px' }}>🔍 Resolving...</p>}
                {resolvedAddress && !resolveError && (
                  <p style={{ color: '#00d4a8', fontSize: '12px', marginTop: '6px', fontFamily: 'monospace' }}>
                    ✓ {resolvedAddress.slice(0, 10)}…{resolvedAddress.slice(-8)}
                  </p>
                )}
                {resolveError && <p style={{ color: '#ff4466', fontSize: '12px', marginTop: '6px' }}>✗ {resolveError}</p>}
              </div>

              {/* Amount */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ color: '#8888aa', fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                  Amount (USDC)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    min="0"
                    step="0.01"
                    style={{
                      width: '100%', background: '#0a0a0f', border: '1px solid #2a2a3a',
                      borderRadius: '12px', padding: '14px 60px 14px 16px', color: '#f0f0ff',
                      fontSize: '20px', fontWeight: 700, outline: 'none', boxSizing: 'border-box',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = '#7c3aed'}
                    onBlur={e => e.currentTarget.style.borderColor = '#2a2a3a'}
                  />
                  <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#7c3aed', fontWeight: 700, fontSize: '14px' }}>
                    USDC
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  {['10', '25', '50', '100'].map(p => (
                    <button key={p}
                      onClick={() => setAmount(p)}
                      style={{
                        background: '#1a1a24', border: '1px solid #2a2a3a', color: '#8888aa',
                        borderRadius: '8px', padding: '5px 12px', fontSize: '12px', cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseOver={e => { e.currentTarget.style.borderColor = '#7c3aed'; e.currentTarget.style.color = '#9f5aff' }}
                      onMouseOut={e => { e.currentTarget.style.borderColor = '#2a2a3a'; e.currentTarget.style.color = '#8888aa' }}
                    >
                      ${p}
                    </button>
                  ))}
                  <button
                    onClick={() => setAmount(balanceFormatted)}
                    style={{
                      background: '#1a1a24', border: '1px solid #2a2a3a', color: '#8888aa',
                      borderRadius: '8px', padding: '5px 12px', fontSize: '12px', cursor: 'pointer',
                    }}
                  >
                    Max
                  </button>
                </div>
              </div>

              {/* Memo */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ color: '#8888aa', fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                  Memo (optional)
                </label>
                <input
                  type="text"
                  placeholder="What's it for?"
                  value={memo}
                  onChange={e => setMemo(e.target.value)}
                  maxLength={100}
                  style={{
                    width: '100%', background: '#0a0a0f', border: '1px solid #2a2a3a',
                    borderRadius: '12px', padding: '14px 16px', color: '#f0f0ff',
                    fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = '#7c3aed'}
                  onBlur={e => e.currentTarget.style.borderColor = '#2a2a3a'}
                />
              </div>

              <button
                disabled={!resolvedAddress || !isValidAmount}
                onClick={() => setStep('confirm')}
                style={{
                  width: '100%',
                  background: (resolvedAddress && isValidAmount) ? 'linear-gradient(135deg, #7c3aed, #9f5aff)' : '#2a2a3a',
                  border: 'none', borderRadius: '14px', padding: '16px',
                  color: (resolvedAddress && isValidAmount) ? 'white' : '#55556a',
                  fontSize: '16px', fontWeight: 800, cursor: (resolvedAddress && isValidAmount) ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s', letterSpacing: '0.02em',
                  boxShadow: (resolvedAddress && isValidAmount) ? '0 0 30px #7c3aed40' : 'none',
                }}
              >
                Review Payment →
              </button>
            </div>
          )}

          {step === 'confirm' && (
            <div style={{ background: '#111118', border: '1px solid #2a2a3a', borderRadius: '20px', padding: '28px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#f0f0ff', marginBottom: '24px' }}>Confirm Payment</h1>

              <div style={{ background: '#0a0a0f', borderRadius: '14px', padding: '20px', marginBottom: '24px' }}>
                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                  <span style={{ fontSize: '40px', fontWeight: 900, color: '#f0f0ff' }}>{amount}</span>
                  <span style={{ fontSize: '18px', color: '#7c3aed', fontWeight: 700, marginLeft: '8px' }}>USDC</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <InfoRow label="To" value={`${resolvedAddress?.slice(0, 8)}…${resolvedAddress?.slice(-6)}`} />
                  {recipient.startsWith('@') && <InfoRow label="Username" value={recipient} />}
                  {memo && <InfoRow label="Memo" value={memo} />}
                  <InfoRow label="Network" value="Arc Testnet" />
                </div>
              </div>

              {phase !== 'idle' && (
                <div style={{ background: '#7c3aed15', border: '1px solid #7c3aed30', borderRadius: '12px', padding: '14px', marginBottom: '16px', textAlign: 'center' }}>
                  <p style={{ color: '#9f5aff', fontSize: '14px', fontWeight: 600 }}>
                    {phase === 'approving' ? '⏳ Approving USDC spend...' : '📡 Broadcasting payment...'}
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => { setStep('form'); setPhase('idle') }}
                  disabled={phase !== 'idle'}
                  style={{
                    flex: 1, background: '#1a1a24', border: '1px solid #2a2a3a',
                    borderRadius: '12px', padding: '14px', color: '#8888aa',
                    fontSize: '15px', fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Back
                </button>
                <button
                  onClick={handleSend}
                  disabled={phase !== 'idle'}
                  style={{
                    flex: 2,
                    background: phase !== 'idle' ? '#2a2a3a' : 'linear-gradient(135deg, #7c3aed, #9f5aff)',
                    border: 'none', borderRadius: '12px', padding: '14px',
                    color: phase !== 'idle' ? '#55556a' : 'white',
                    fontSize: '15px', fontWeight: 800, cursor: phase !== 'idle' ? 'not-allowed' : 'pointer',
                    boxShadow: phase === 'idle' ? '0 0 30px #7c3aed40' : 'none',
                  }}
                >
                  {phase === 'idle' ? 'Confirm & Send' : 'Processing...'}
                </button>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div style={{ background: '#111118', border: '1px solid #00d4a830', borderRadius: '20px', padding: '40px 28px', textAlign: 'center', boxShadow: '0 0 40px #00d4a815' }}>
              <div style={{ fontSize: '56px', marginBottom: '16px' }}>✅</div>
              <h1 style={{ fontSize: '26px', fontWeight: 900, color: '#00d4a8', marginBottom: '8px' }}>Payment Sent!</h1>
              <p style={{ color: '#8888aa', fontSize: '14px', marginBottom: '28px' }}>
                {amount} USDC sent successfully on Arc Network
              </p>
              {sendTxHash && (
                <a
                  href={`${EXPLORER_URL}/tx/${sendTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'block', color: '#7c3aed', fontSize: '13px', marginBottom: '28px', textDecoration: 'none' }}
                >
                  View on ArcScan ↗
                </a>
              )}
              <button
                onClick={() => { setStep('form'); setRecipient(''); setAmount(''); setMemo(''); setResolvedAddress(null); setPhase('idle') }}
                style={{
                  width: '100%', background: 'linear-gradient(135deg, #7c3aed, #9f5aff)',
                  border: 'none', borderRadius: '12px', padding: '14px',
                  color: 'white', fontSize: '15px', fontWeight: 800, cursor: 'pointer',
                }}
              >
                Send Another
              </button>
            </div>
          )}
        </NetworkGuard>
      </main>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1a1a24' }}>
      <span style={{ color: '#55556a', fontSize: '13px' }}>{label}</span>
      <span style={{ color: '#f0f0ff', fontSize: '13px', fontWeight: 600, fontFamily: value.startsWith('0x') ? 'monospace' : 'inherit' }}>{value}</span>
    </div>
  )
}
