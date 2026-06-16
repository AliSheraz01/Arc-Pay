'use client'

import { useState, useCallback, useEffect, Suspense } from 'react'
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits, isAddress, createPublicClient, http } from 'viem'
import { PageLayout } from '@/components/PageLayout'
import { NetworkGuard } from '@/components/NetworkGuard'
import { USDC_ADDRESS, ROUTER_ADDRESS, REGISTRY_ADDRESS, EXPLORER_URL, BACKEND_URL, arcTestnet } from '@/lib/constants'
import { USDC_ABI, ROUTER_ABI, REGISTRY_ABI } from '@/lib/abi'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { MdArrowBack, MdAccessTime, MdCheckCircle, MdSearch, MdErrorOutline } from 'react-icons/md'

type Step = 'form' | 'confirm' | 'success'

function SendForm() {
  const { address, isConnected } = useAccount()
  const searchParams = useSearchParams()

  const [step, setStep] = useState<Step>('form')
  const [recipient, setRecipient] = useState(() => searchParams.get('to') || '')
  const [resolvedAddress, setResolvedAddress] = useState<`0x${string}` | null>(null)
  const [amount, setAmount] = useState(() => searchParams.get('amount') || '')
  const [memo, setMemo] = useState(() => searchParams.get('memo') || '')
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

  // Resolve username to address (backend first, then on-chain fallback)
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
      // 1. Try backend API first
      const res = await fetch(`${BACKEND_URL}/api/resolve/${username}`)
      if (res.ok) {
        const data = await res.json()
        if (data.address) {
          setResolvedAddress(data.address as `0x${string}`)
          return
        }
      }
      throw new Error('backend failed')
    } catch {
      // 2. Fallback: query on-chain registry contract directly
      try {
        const client = createPublicClient({
          chain: arcTestnet,
          transport: http('https://rpc.testnet.arc.network'),
        })
        const resolved = await client.readContract({
          address: REGISTRY_ADDRESS,
          abi: REGISTRY_ABI,
          functionName: 'resolveUsername',
          args: [username.toLowerCase()],
        }) as `0x${string}`

        if (resolved && resolved !== '0x0000000000000000000000000000000000000000') {
          setResolvedAddress(resolved)
          return
        }
      } catch (onChainErr) {
        console.error('On-chain resolve failed:', onChainErr)
      }
      setResolveError(`Could not find user "@${username}"`)
    } finally {
      setResolving(false)
    }
  }, [])

  // Auto-resolve on mount if query param is set
  useEffect(() => {
    const initialTo = searchParams.get('to')
    if (initialTo) {
      resolveRecipient(initialTo)
    }
  }, [searchParams, resolveRecipient])

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
      <PageLayout>
        <div style={{ maxWidth: '480px', margin: '80px auto', padding: '0 16px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Connect your wallet to send payments.</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <main style={{ maxWidth: '480px', margin: '0 auto' }}>
        <Link href="/" style={{ color: 'var(--text-muted)', fontSize: '13px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px', fontWeight: 600 }}>
          <MdArrowBack size={20} /> Back to Dashboard
        </Link>

        <NetworkGuard>
          {step === 'form' && (
            <div style={{ 
              background: 'var(--surface)', 
              border: '1px solid var(--border)', 
              borderRadius: '24px', 
              padding: '28px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
            }}>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>Send USDC</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '28px' }}>Balance: {balanceFormatted} USDC</p>

              {/* Recipient */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                  To
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="@username or 0x address"
                    value={recipient}
                    onChange={e => {
                      setRecipient(e.target.value)
                      resolveRecipient(e.target.value)
                    }}
                    style={{
                      width: '100%', background: 'var(--surface-raised)', border: '1px solid var(--border)',
                      borderRadius: '12px', padding: '14px 16px', color: 'var(--text-primary)',
                      fontSize: '15px', outline: 'none', boxSizing: 'border-box',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                    onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  />
                </div>
                {resolving && <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}><MdSearch size={12} className="shimmer-rotate" /> Resolving username...</p>}
                {resolvedAddress && !resolveError && (
                  <p style={{ color: 'var(--green)', fontSize: '12px', marginTop: '6px', fontFamily: 'monospace', fontWeight: 600 }}>
                    ✓ Resolved: {resolvedAddress.slice(0, 10)}…{resolvedAddress.slice(-8)}
                  </p>
                )}
                {resolveError && (
                  <p style={{ color: 'var(--red)', fontSize: '12px', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                    <MdErrorOutline size={12} /> {resolveError}
                  </p>
                )}
              </div>

              {/* Amount */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                  Amount
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    style={{
                      width: '100%', background: 'var(--surface-raised)', border: '1px solid var(--border)',
                      borderRadius: '12px', padding: '14px 70px 14px 16px', color: 'var(--text-primary)',
                      fontSize: '15px', outline: 'none', boxSizing: 'border-box',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                    onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  />
                  <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--accent)', fontWeight: 800, fontSize: '14px' }}>
                    USDC
                  </span>
                </div>
              </div>

              {/* Note */}
              <div style={{ marginBottom: '28px' }}>
                <label style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                  Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="What is this for?"
                  value={memo}
                  onChange={e => setMemo(e.target.value)}
                  style={{
                    width: '100%', background: 'var(--surface-raised)', border: '1px solid var(--border)',
                    borderRadius: '12px', padding: '14px 16px', color: 'var(--text-primary)',
                    fontSize: '15px', outline: 'none', boxSizing: 'border-box',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                />
              </div>

              <button
                disabled={!resolvedAddress || !isValidAmount}
                onClick={() => setStep('confirm')}
                style={{
                  width: '100%',
                  background: resolvedAddress && isValidAmount ? 'linear-gradient(135deg, #1035f6, #3b82f6)' : 'var(--border)',
                  border: 'none', borderRadius: '12px', padding: '16px',
                  color: resolvedAddress && isValidAmount ? 'white' : 'var(--text-secondary)',
                  fontSize: '15px', fontWeight: 800,
                  cursor: resolvedAddress && isValidAmount ? 'pointer' : 'not-allowed',
                  boxShadow: resolvedAddress && isValidAmount ? '0 4px 16px rgba(16, 53, 246, 0.25)' : 'none',
                }}
              >
                Continue
              </button>
            </div>
          )}

          {step === 'confirm' && (
            <div style={{ 
              background: 'var(--surface)', 
              border: '1px solid var(--border)', 
              borderRadius: '24px', 
              padding: '28px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
            }}>
              <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '24px' }}>Confirm Payment</h1>

              <div style={{
                background: 'var(--surface-raised)', border: '1px solid var(--border)',
                borderRadius: '16px', padding: '24px', marginBottom: '24px', textAlign: 'center'
              }}>
                <span style={{ fontSize: '42px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                  {parseFloat(amount).toFixed(2)}
                </span>
                <span style={{ fontSize: '16px', color: 'var(--accent)', fontWeight: 800, marginLeft: '6px' }}>USDC</span>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px', textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>Recipient</span>
                    <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 700, fontFamily: 'monospace' }}>
                      {recipient.startsWith('@') ? recipient : `${resolvedAddress?.slice(0, 8)}…${resolvedAddress?.slice(-6)}`}
                    </span>
                  </div>
                  {memo && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>Note</span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontStyle: 'italic' }}>"{memo}"</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>Network</span>
                    <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 700 }}>Arc Testnet</span>
                  </div>
                </div>
              </div>

              {/* Loader alerts */}
              {phase === 'approving' && (
                <div style={{ background: 'var(--accent-glow)', border: '1px solid var(--border-accent)', borderRadius: '12px', padding: '14px', marginBottom: '16px', textAlign: 'center' }}>
                  <p style={{ color: 'var(--accent-bright)', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <MdAccessTime size={14} className="shimmer-rotate" />
                    <span>{waitingApprove ? 'Waiting for USDC spend limit approval...' : 'Approving USDC Router spend limit...'}</span>
                  </p>
                </div>
              )}

              {phase === 'sending' && (
                <div style={{ background: 'rgba(0, 212, 168, 0.08)', border: '1px solid rgba(0, 212, 168, 0.2)', borderRadius: '12px', padding: '14px', marginBottom: '16px', textAlign: 'center' }}>
                  <p style={{ color: 'var(--green)', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <MdAccessTime size={14} className="shimmer-rotate" />
                    <span>{waitingSend ? 'Confirming payment on Arc...' : 'Submitting payment transaction...'}</span>
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  disabled={phase !== 'idle'}
                  onClick={() => setStep('form')}
                  style={{
                    flex: 1, background: 'transparent', border: '1px solid var(--border)',
                    borderRadius: '12px', padding: '14px', color: 'var(--text-primary)',
                    fontSize: '15px', fontWeight: 800, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  disabled={phase !== 'idle'}
                  onClick={handleSend}
                  style={{
                    flex: 1, background: 'linear-gradient(135deg, #1035f6, #3b82f6)', border: 'none',
                    borderRadius: '12px', padding: '14px', color: 'white',
                    fontSize: '15px', fontWeight: 800, cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(16, 53, 246, 0.25)',
                  }}
                >
                  Confirm & Send
                </button>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div style={{ 
              background: 'var(--surface)', 
              border: '1px solid var(--border)', 
              borderRadius: '24px', 
              padding: '40px 28px', 
              textAlign: 'center',
              boxShadow: '0 4px 30px rgba(0, 212, 168, 0.05)'
            }}>
              <div style={{ fontSize: '56px', marginBottom: '16px' }}>🎉</div>
              <h1 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--green)', marginBottom: '8px' }}>Payment Sent!</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
                You successfully sent {parseFloat(amount).toFixed(2)} USDC to {recipient}
              </p>

              {sendTxHash && (
                <a
                  href={`${EXPLORER_URL}/tx/${sendTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'block', color: 'var(--accent)', fontSize: '13px', marginBottom: '32px', textDecoration: 'none', fontWeight: 700 }}
                >
                  View on ArcScan ↗
                </a>
              )}

              <Link href="/" style={{ textDecoration: 'none' }}>
                <button style={{
                  width: '100%', background: 'linear-gradient(135deg, #1035f6, #3b82f6)',
                  border: 'none', borderRadius: '12px', padding: '16px',
                  color: 'white', fontSize: '15px', fontWeight: 800, cursor: 'pointer',
                }}>
                  Return to Dashboard
                </button>
              </Link>
            </div>
          )}
        </NetworkGuard>
      </main>
    </PageLayout>
  )
}

export default function SendPage() {
  return (
    <Suspense fallback={
      <PageLayout>
        <div style={{ maxWidth: '480px', margin: '80px auto', padding: '0 16px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
        </div>
      </PageLayout>
    }>
      <SendForm />
    </Suspense>
  )
}
