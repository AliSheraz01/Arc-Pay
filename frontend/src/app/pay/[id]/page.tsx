'use client'

import { useState, use, useEffect } from 'react'
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits, formatUnits, isAddress } from 'viem'
import { Header } from '@/components/Header'
import { NetworkGuard } from '@/components/NetworkGuard'
import { USDC_ADDRESS, ROUTER_ADDRESS, EXPLORER_URL, BACKEND_URL } from '@/lib/constants'
import { USDC_ABI, ROUTER_ABI } from '@/lib/abi'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'

type PayPhase = 'idle' | 'approving' | 'sending' | 'success' | 'error'

export default function PayRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const id = resolvedParams.id

  const { address, isConnected } = useAccount()
  const [phase, setPhase] = useState<PayPhase>('idle')
  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | undefined>()
  const [sendTxHash, setSendTxHash] = useState<`0x${string}` | undefined>()
  const [txError, setTxError] = useState('')

  const { writeContractAsync } = useWriteContract()

  // 1. Fetch Payment Request details
  const { data: request, isLoading: requestLoading, error: requestError, refetch: refetchRequest } = useQuery({
    queryKey: ['paymentRequest', id],
    queryFn: async () => {
      const res = await fetch(`${BACKEND_URL}/api/request/${id}`)
      if (!res.ok) throw new Error('Payment request not found')
      return res.json() as Promise<{
        id: string
        fromAddress: string
        toAddress: string | null
        amount: string
        memo: string | null
        status: string
        createdAt: string
      }>
    },
    enabled: !!id,
    refetchInterval: 5000, // Poll request status from database
  })

  // 2. Fetch Requester profile (to get username)
  const { data: requesterProfile } = useQuery({
    queryKey: ['userProfile', request?.fromAddress],
    queryFn: async () => {
      if (!request?.fromAddress) return null
      try {
        const res = await fetch(`${BACKEND_URL}/api/users/${request.fromAddress}`)
        if (!res.ok) return null
        return res.json() as Promise<{ username: string | null }>
      } catch {
        return null
      }
    },
    enabled: !!request?.fromAddress,
  })

  // 3. Read USDC balance of payer
  const { data: usdcBalance, refetch: refetchBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  // 4. Read Router allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'allowance',
    args: address ? [address, ROUTER_ADDRESS] : undefined,
    query: { enabled: !!address },
  })

  const { isLoading: waitingApprove, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveTxHash })
  const { isLoading: waitingSend, isSuccess: sendSuccess } = useWaitForTransactionReceipt({ hash: sendTxHash })

  // Trigger refetches after tx completion
  useEffect(() => {
    if (approveSuccess) {
      refetchAllowance()
    }
  }, [approveSuccess, refetchAllowance])

  useEffect(() => {
    if (sendSuccess) {
      setPhase('success')
      refetchBalance()
      refetchRequest()
    }
  }, [sendSuccess, refetchBalance, refetchRequest])

  if (requestLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0f' }}>
        <Header />
        <div style={{ maxWidth: '480px', margin: '120px auto', padding: '0 16px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '16px' }} className="shimmer-rotate">🌀</div>
          <p style={{ color: '#8888aa', fontSize: '15px' }}>Loading payment request...</p>
        </div>
      </div>
    )
  }

  if (requestError || !request) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0f' }}>
        <Header />
        <div style={{ maxWidth: '480px', margin: '80px auto', padding: '0 16px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h1 style={{ color: '#ff4466', fontSize: '22px', fontWeight: 800, marginBottom: '8px' }}>Request Not Found</h1>
          <p style={{ color: '#8888aa', fontSize: '14px', marginBottom: '24px' }}>The payment request link is invalid or has expired.</p>
          <Link href="/" style={{ color: '#7c3aed', textDecoration: 'none', fontWeight: 700 }}>
            Go to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const parsedAmount = parseUnits(request.amount, 6)
  const balanceFormatted = usdcBalance ? parseFloat(formatUnits(usdcBalance, 6)) : 0
  const requestedAmountFormatted = parseFloat(request.amount).toFixed(2)
  const hasSufficientBalance = usdcBalance ? usdcBalance >= parsedAmount : false
  const hasSufficientAllowance = allowance ? allowance >= parsedAmount : false

  const requesterName = requesterProfile?.username ? `@${requesterProfile.username}` : `${request.fromAddress.slice(0, 8)}…${request.fromAddress.slice(-6)}`

  async function handlePay() {
    if (!request) return
    setTxError('')
    try {
      if (!hasSufficientAllowance) {
        setPhase('approving')
        const tx = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: 'approve',
          args: [ROUTER_ADDRESS, parsedAmount],
        })
        setApproveTxHash(tx)
      } else {
        setPhase('sending')
        const tx = await writeContractAsync({
          address: ROUTER_ADDRESS,
          abi: ROUTER_ABI,
          functionName: 'sendPayment',
          args: [request.fromAddress as `0x${string}`, parsedAmount, request.id],
        })
        setSendTxHash(tx)
      }
    } catch (err: unknown) {
      console.error('Payment flow failed:', err)
      setPhase('error')
      setTxError(err instanceof Error ? err.message : 'Transaction failed')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f' }}>
      <Header />

      {/* Glow Effects */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-200px', left: '50%', transform: 'translateX(-50%)', width: '600px', height: '600px', background: '#7c3aed15', borderRadius: '50%', filter: 'blur(100px)' }} />
        <div style={{ position: 'absolute', bottom: '-100px', right: '-100px', width: '400px', height: '400px', background: '#00d4a810', borderRadius: '50%', filter: 'blur(80px)' }} />
      </div>

      <main style={{ maxWidth: '480px', margin: '0 auto', padding: '24px 16px', position: 'relative', zIndex: 1 }}>
        <Link href="/" style={{ color: '#55556a', fontSize: '13px', textDecoration: 'none', display: 'block', marginBottom: '20px' }}>
          ← Back to Dashboard
        </Link>

        <NetworkGuard>
          {request.status === 'PAID' || phase === 'success' ? (
            <div style={{
              background: '#111118',
              border: '1px solid #00d4a830',
              borderRadius: '20px',
              padding: '40px 28px',
              textAlign: 'center',
              boxShadow: '0 0 40px #00d4a815',
            }}>
              <div style={{ fontSize: '56px', marginBottom: '16px' }}>✅</div>
              <h1 style={{ fontSize: '26px', fontWeight: 900, color: '#00d4a8', marginBottom: '8px' }}>Paid Successfully!</h1>
              <p style={{ color: '#8888aa', fontSize: '14px', marginBottom: '28px' }}>
                You paid {requestedAmountFormatted} USDC to {requesterName}
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
              <Link href="/" style={{ textDecoration: 'none' }}>
                <button style={{
                  width: '100%', background: 'linear-gradient(135deg, #7c3aed, #9f5aff)',
                  border: 'none', borderRadius: '12px', padding: '14px',
                  color: 'white', fontSize: '15px', fontWeight: 800, cursor: 'pointer',
                }}>
                  Return to Dashboard
                </button>
              </Link>
            </div>
          ) : request.status === 'CANCELLED' ? (
            <div style={{
              background: '#111118',
              border: '1px solid #ff446630',
              borderRadius: '20px',
              padding: '40px 28px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '56px', marginBottom: '16px' }}>❌</div>
              <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#ff4466', marginBottom: '8px' }}>Request Cancelled</h1>
              <p style={{ color: '#8888aa', fontSize: '14px', marginBottom: '28px' }}>This payment request was cancelled by the requester.</p>
              <Link href="/" style={{ textDecoration: 'none' }}>
                <button style={{
                  width: '100%', background: '#1a1a24',
                  border: '1px solid #2a2a3a', borderRadius: '12px', padding: '14px',
                  color: '#8888aa', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
                }}>
                  Go to Dashboard
                </button>
              </Link>
            </div>
          ) : (
            <div style={{ background: '#111118', border: '1px solid #2a2a3a', borderRadius: '20px', padding: '28px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#f0f0ff', marginBottom: '4px' }}>Payment Request</h1>
              <p style={{ color: '#55556a', fontSize: '13px', marginBottom: '28px' }}>Review and pay this invoice</p>

              {/* Request Card */}
              <div style={{ background: '#0a0a0f', borderRadius: '16px', padding: '24px', marginBottom: '24px', textAlign: 'center', border: '1px solid #2a2a3a' }}>
                <span style={{ fontSize: '44px', fontWeight: 900, color: '#f0f0ff', letterSpacing: '-0.02em' }}>
                  {requestedAmountFormatted}
                </span>
                <span style={{ fontSize: '18px', color: '#7c3aed', fontWeight: 700, marginLeft: '6px' }}>USDC</span>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px', textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid #1a1a24' }}>
                    <span style={{ color: '#55556a', fontSize: '13px' }}>To</span>
                    <span style={{ color: '#f0f0ff', fontSize: '13px', fontWeight: 600 }}>{requesterName}</span>
                  </div>
                  {request.memo && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid #1a1a24' }}>
                      <span style={{ color: '#55556a', fontSize: '13px' }}>Note</span>
                      <span style={{ color: '#8888aa', fontSize: '13px', fontStyle: 'italic' }}>"{request.memo}"</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#55556a', fontSize: '13px' }}>Network</span>
                    <span style={{ color: '#f0f0ff', fontSize: '13px', fontWeight: 600 }}>Arc Testnet</span>
                  </div>
                </div>
              </div>

              {/* Connected State Actions */}
              {!isConnected ? (
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                  <p style={{ color: '#8888aa', fontSize: '14px', marginBottom: '16px' }}>Connect your wallet to make payment</p>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <span style={{ color: '#55556a', fontSize: '13px' }}>Your Balance:</span>
                    <span style={{ color: hasSufficientBalance ? '#00d4a8' : '#ff4466', fontSize: '14px', fontWeight: 700 }}>
                      {usdcBalance ? parseFloat(formatUnits(usdcBalance, 6)).toFixed(2) : '0.00'} USDC
                    </span>
                  </div>

                  {/* Transaction statuses */}
                  {(phase === 'approving' || waitingApprove) && (
                    <div style={{ background: '#7c3aed15', border: '1px solid #7c3aed30', borderRadius: '12px', padding: '14px', marginBottom: '16px', textAlign: 'center' }}>
                      <p style={{ color: '#9f5aff', fontSize: '14px', fontWeight: 600 }}>
                        {waitingApprove ? '⏳ Confirming USDC spend limit...' : '📡 Requesting token approval...'}
                      </p>
                      {approveTxHash && (
                        <a href={`${EXPLORER_URL}/tx/${approveTxHash}`} target="_blank" rel="noreferrer" style={{ color: '#7c3aed', fontSize: '11px', textDecoration: 'none', display: 'block', marginTop: '4px' }}>
                          Track on ArcScan ↗
                        </a>
                      )}
                    </div>
                  )}

                  {(phase === 'sending' || waitingSend) && (
                    <div style={{ background: '#00d4a815', border: '1px solid #00d4a830', borderRadius: '12px', padding: '14px', marginBottom: '16px', textAlign: 'center' }}>
                      <p style={{ color: '#00b896', fontSize: '14px', fontWeight: 600 }}>
                        {waitingSend ? '⏳ Verifying transfer on Arc...' : '📡 Sending USDC...'}
                      </p>
                      {sendTxHash && (
                        <a href={`${EXPLORER_URL}/tx/${sendTxHash}`} target="_blank" rel="noreferrer" style={{ color: '#7c3aed', fontSize: '11px', textDecoration: 'none', display: 'block', marginTop: '4px' }}>
                          Track on ArcScan ↗
                        </a>
                      )}
                    </div>
                  )}

                  {txError && (
                    <div style={{ background: '#ff446615', border: '1px solid #ff446630', borderRadius: '12px', padding: '14px', marginBottom: '16px', wordBreak: 'break-word' }}>
                      <p style={{ color: '#ff4466', fontSize: '13px', fontWeight: 600 }}>✗ {txError.slice(0, 150)}...</p>
                    </div>
                  )}

                  {!hasSufficientBalance ? (
                    <button
                      disabled
                      style={{
                        width: '100%', background: '#2a2a3a', border: 'none',
                        borderRadius: '14px', padding: '16px', color: '#55556a',
                        fontSize: '16px', fontWeight: 800, cursor: 'not-allowed',
                      }}
                    >
                      Insufficient USDC Balance
                    </button>
                  ) : (
                    <button
                      disabled={phase === 'approving' || phase === 'sending' || waitingApprove || waitingSend}
                      onClick={handlePay}
                      style={{
                        width: '100%',
                        background: 'linear-gradient(135deg, #7c3aed, #9f5aff)',
                        border: 'none', borderRadius: '14px', padding: '16px',
                        color: 'white', fontSize: '16px', fontWeight: 800,
                        cursor: 'pointer', boxShadow: '0 0 30px #7c3aed40',
                        transition: 'all 0.2s', letterSpacing: '0.02em',
                      }}
                    >
                      {waitingApprove
                        ? 'Confirming approval...'
                        : waitingSend
                        ? 'Broadcasting payment...'
                        : !hasSufficientAllowance
                        ? 'Step 1: Approve USDC'
                        : 'Confirm & Pay Request'}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </NetworkGuard>
      </main>
    </div>
  )
}
