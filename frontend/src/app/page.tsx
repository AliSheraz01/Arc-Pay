'use client'

import { useState, useEffect } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi'
import { PageLayout } from '@/components/PageLayout'
import { NetworkGuard } from '@/components/NetworkGuard'
import { 
  USDC_ADDRESS, 
  REGISTRY_ADDRESS, 
  ROUTER_ADDRESS, 
  EXPLORER_URL, 
  ARC_CHAIN_ID, 
  BACKEND_URL 
} from '@/lib/constants'
import { USDC_ABI, REGISTRY_ABI } from '@/lib/abi'
import Link from 'next/link'
import { formatUnits, parseUnits } from 'viem'
import { useQuery } from '@tanstack/react-query'
import { 
  MdSend, 
  MdCallReceived, 
  MdVisibility, 
  MdVisibilityOff, 
  MdPerson, 
  MdQrCode, 
  MdLink, 
  MdMonetizationOn, 
  MdTimeline, 
  MdMenuBook, 
  MdOpenInNew,
  MdChevronRight,
  MdCheckCircle,
  MdAccessTime,
  MdCallMade
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

export default function DashboardPage() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const isCorrectNetwork = chainId === ARC_CHAIN_ID

  const [hideBalance, setHideBalance] = useState(false)
  const [usernameInput, setUsernameInput] = useState('')
  const [registering, setRegistering] = useState(false)
  const [regError, setRegError] = useState('')
  const [regTxHash, setRegTxHash] = useState<`0x${string}` | undefined>()
  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | undefined>()

  const { writeContractAsync } = useWriteContract()

  // 1. Read USDC Balance of user
  const { data: usdcBalance, isLoading: balanceLoading, refetch: refetchBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && isCorrectNetwork, refetchInterval: 5000 },
  })

  // 2. Read current username registered to address
  const { data: myUsername, refetch: refetchUsername } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'getMyUsername',
    account: address,
    query: { enabled: !!address && isCorrectNetwork },
  })

  // 3. Read USDC Allowance for Registry
  const { data: registryAllowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'allowance',
    args: address ? [address, REGISTRY_ADDRESS] : undefined,
    query: { enabled: !!address && isCorrectNetwork, refetchInterval: 5000 },
  })

  // 4. Fetch transactions
  const { data: transactions, isLoading: txsLoading, refetch: refetchTxs } = useQuery({
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

  const [approvedInSession, setApprovedInSession] = useState(false)

  const { isLoading: waitingApprove, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveTxHash })
  const { isLoading: waitingReg, isSuccess: regSuccess } = useWaitForTransactionReceipt({ hash: regTxHash })

  // Reset session approval if username input changes
  useEffect(() => {
    setApprovedInSession(false)
  }, [usernameInput])

  // Trigger refetches after tx completion
  useEffect(() => {
    if (approveSuccess) {
      refetchAllowance()
      setApprovedInSession(true)
    }
  }, [approveSuccess, refetchAllowance])

  useEffect(() => {
    if (regSuccess) {
      setRegistering(false)
      setUsernameInput('')
      refetchUsername()
      refetchBalance()
      refetchTxs()
    }
  }, [regSuccess, refetchUsername, refetchBalance, refetchTxs])

  const formattedBalance = usdcBalance ? parseFloat(formatUnits(usdcBalance, 6)).toFixed(2) : '0.00'
  const REGISTRATION_FEE = BigInt(1000000) // 1 USDC (6 decimals)
  const hasAllowance = (registryAllowance !== undefined ? registryAllowance >= REGISTRATION_FEE : false) || approvedInSession
  const hasEnoughBalance = usdcBalance !== undefined ? (usdcBalance as bigint) >= REGISTRATION_FEE : false

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
      console.error('USDC approval failed:', err)
      setRegError(err instanceof Error ? err.message : 'USDC approval failed')
    }
  }

  async function handleRegisterUsername() {
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
      console.error('Username registration failed:', err)
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

  return (
    <PageLayout>
      <NetworkGuard>
        {!isConnected ? (
          <div style={{ maxWidth: '600px', margin: '40px auto', textAlign: 'center', padding: '0 16px' }}>
            {/* Hero badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'var(--accent-glow)', border: '1px solid var(--border-accent)',
              borderRadius: '100px', padding: '6px 14px', marginBottom: '28px',
            }}>
              <span style={{ color: 'var(--accent)', fontSize: '12px', fontWeight: 800, letterSpacing: '0.05em' }}>
                ⚡ POWERED BY ARC NETWORK
              </span>
            </div>

            <h1 style={{
              fontSize: '44px', fontWeight: 900,
              background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--accent-bright) 50%, var(--accent) 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '16px',
            }}>
              Send Money at the Speed of Web3
            </h1>

            <p style={{ color: 'var(--text-secondary)', fontSize: '16px', lineHeight: 1.6, marginBottom: '36px' }}>
              Instant USDC transfers on Arc Network. Zero friction, near-zero fees, and real-time finality.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '40px', textAlign: 'left' }}>
              {[
                { icon: '⚡', label: 'Instant', desc: 'Sub-second finality' },
                { icon: '💸', label: 'Cheap', desc: 'Near-zero gas fees' },
                { icon: '🔒', label: 'Secure', desc: 'Non-custodial wallet' },
                { icon: '📱', label: 'Simple', desc: 'Send by @username' },
              ].map(f => (
                <div key={f.label} style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '16px',
                  padding: '16px',
                }}>
                  <div style={{ fontSize: '24px', marginBottom: '6px' }}>{f.icon}</div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '14px' }}>{f.label}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{f.desc}</div>
                </div>
              ))}
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              Connect your wallet at the top right to access the dashboard
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
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '24px',
                padding: '32px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.015)'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', zIndex: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Total Balance
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

                  <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, marginBottom: '24px', display: 'block' }}>
                    {balanceLoading ? '...' : hideBalance ? '$••••••' : `$${formattedBalance} USD`}
                  </span>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <Link href="/send" style={{ textDecoration: 'none' }}>
                      <button style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        background: 'var(--accent)',
                        border: 'none', borderRadius: '16px', padding: '12px 28px',
                        color: 'white', fontSize: '14px', fontWeight: 800, cursor: 'pointer',
                        boxShadow: '0 4px 14px rgba(16, 53, 246, 0.2)', transition: 'all 0.2s',
                      }}
                        onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                        onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                      >
                        <MdSend size={18} /> Send
                      </button>
                    </Link>
                    <Link href="/receive?tab=qr" style={{ textDecoration: 'none' }}>
                      <button style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        background: 'transparent', border: '1px solid var(--border)',
                        borderRadius: '16px', padding: '12px 24px',
                        color: 'var(--accent)', fontSize: '14px', fontWeight: 800, cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                        onMouseOver={e => e.currentTarget.style.background = 'var(--surface-raised)'}
                        onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <MdQrCode size={18} /> Receive
                      </button>
                    </Link>
                  </div>
                </div>

                {/* Radar Concentric Circles Graphic */}
                <div style={{
                  width: '140px',
                  height: '140px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  zIndex: 2,
                  marginRight: '16px',
                }}>
                  {/* Faint circles */}
                  <div style={{ position: 'absolute', width: '130px', height: '130px', borderRadius: '50%', border: '1px dashed rgba(16, 53, 246, 0.15)' }} />
                  <div style={{ position: 'absolute', width: '100px', height: '100px', borderRadius: '50%', border: '1px solid rgba(16, 53, 246, 0.08)' }} />
                  <div style={{ position: 'absolute', width: '70px', height: '70px', borderRadius: '50%', border: '1px solid rgba(16, 53, 246, 0.1)' }} />
                  {/* Center Logo Bubble */}
                  <div style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 16px rgba(16, 53, 246, 0.3)'
                  }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4 19A8 8 0 0 1 20 19" stroke="white" strokeWidth="4.5" strokeLinecap="round" fill="none" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Profile Registration / Status Section */}
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '24px',
                padding: '28px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.015)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <MdPerson size={20} style={{ color: 'var(--accent)' }} />
                  <h3 style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '15px' }}>My Profile</h3>
                </div>

                {myUsername ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--surface-raised)',
                    border: '1px solid var(--border)',
                    borderRadius: '16px',
                    padding: '16px 20px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{
                        width: '48px', height: '48px', borderRadius: '50%',
                        background: 'var(--accent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '20px', fontWeight: 900, color: 'white'
                      }}>
                        {(myUsername as string)[0]?.toUpperCase()}
                      </div>
                      <div>
                        <h4 style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '18px' }}>@{myUsername as string}</h4>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px' }}>
                          Registered on Arc Chain
                        </p>
                      </div>
                    </div>
                    <span style={{
                      background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)',
                      color: 'var(--green)', borderRadius: '20px', padding: '6px 14px', fontSize: '12px', fontWeight: 700
                    }}>
                      Active
                    </span>
                  </div>
                ) : (
                  <div>
                    <div style={{
                      background: 'var(--accent-glow)', border: '1px solid var(--border-accent)',
                      borderRadius: '12px', padding: '12px 16px', marginBottom: '16px',
                    }}>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.5 }}>
                        Your current balance: <strong style={{ color: hasEnoughBalance ? 'var(--green)' : 'var(--red)' }}>{formattedBalance} USDC</strong>
                        {!hasEnoughBalance && <><br /><span style={{ color: 'var(--red)', fontWeight: 'bold' }}>⚠️ Insufficient USDC balance. You need at least 1 USDC to register.</span></>}
                      </p>
                    </div>

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
                          disabled={registering || waitingReg || waitingApprove}
                          style={{
                            width: '100%', background: 'var(--surface-raised)', border: '1px solid var(--border)',
                            borderRadius: '12px', padding: '14px 16px 14px 34px', color: 'var(--text-primary)',
                            fontSize: '15px', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box'
                          }}
                          onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                          onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                        />
                      </div>

                      {regError && (
                        <div style={{ color: 'var(--red)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          ⚠️ <span>{regError}</span>
                        </div>
                      )}

                      {(waitingApprove || waitingReg || regSuccess) && (
                        <div style={{
                          background: 'var(--surface-raised)', border: '1px solid var(--border)',
                          borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', fontSize: '13px', fontWeight: 700 }}>
                            <MdAccessTime size={18} className="shimmer-rotate" />
                            <span>
                              {waitingApprove ? 'Waiting for USDC Approval...' : waitingReg ? 'Registering username on Arc...' : 'Successfully Registered!'}
                            </span>
                          </div>
                          {(approveTxHash || regTxHash) && (
                            <a 
                              href={`${EXPLORER_URL}/tx/${approveTxHash || regTxHash}`} 
                              target="_blank" 
                              rel="noreferrer"
                              style={{ color: 'var(--accent)', fontSize: '11px', textDecoration: 'none' }}
                            >
                              Track on ArcScan ↗
                            </a>
                          )}
                        </div>
                      )}

                      {!hasAllowance ? (
                        <button
                          disabled={!usernameInput || registering || waitingApprove || waitingReg || !hasEnoughBalance}
                          onClick={handleApproveUSDC}
                          style={{
                            width: '100%',
                            background: (usernameInput && hasEnoughBalance) ? 'linear-gradient(135deg, #1035f6, #3b82f6)' : 'var(--border)',
                            border: 'none', borderRadius: '12px', padding: '14px 16px',
                            color: (usernameInput && hasEnoughBalance) ? 'white' : 'var(--text-secondary)',
                            fontSize: '15px', fontWeight: 800, cursor: (usernameInput && hasEnoughBalance) ? 'pointer' : 'not-allowed',
                            boxShadow: (usernameInput && hasEnoughBalance) ? '0 4px 12px rgba(16, 53, 246, 0.2)' : 'none',
                          }}
                        >
                          Step 1: Approve 1 USDC Fee
                        </button>
                      ) : (
                        <button
                          disabled={!usernameInput || registering || waitingApprove || waitingReg || !hasEnoughBalance}
                          onClick={handleRegisterUsername}
                          style={{
                            width: '100%',
                            background: (usernameInput && hasEnoughBalance) ? 'linear-gradient(135deg, #00d4a8, #00b896)' : 'var(--border)',
                            border: 'none', borderRadius: '12px', padding: '14px 16px',
                            color: (usernameInput && hasEnoughBalance) ? 'white' : 'var(--text-secondary)',
                            fontSize: '15px', fontWeight: 800, cursor: (usernameInput && hasEnoughBalance) ? 'pointer' : 'not-allowed',
                            boxShadow: (usernameInput && hasEnoughBalance) ? '0 4px 12px rgba(0, 212, 168, 0.25)' : 'none',
                          }}
                        >
                          Step 2: Register Username (1 USDC)
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Recent Transactions */}
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '24px',
                padding: '28px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.015)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '15px' }}>Recent Transactions</h3>
                  <Link href="/history" style={{ color: 'var(--accent)', fontSize: '13px', textDecoration: 'none', fontWeight: 700 }}>
                    View all
                  </Link>
                </div>

                {txsLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[1, 2, 3].map(i => (
                      <div key={i} style={{ height: '62px', borderRadius: '14px', background: 'var(--surface-raised)' }} className="shimmer" />
                    ))}
                  </div>
                ) : !transactions || transactions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', border: '1px dashed var(--border)', borderRadius: '16px' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>🌀</div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No transactions yet</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>Make a payment or request funds to get started</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {transactions.slice(0, 4).map(tx => {
                      const isSent = tx.fromAddress.toLowerCase() === address?.toLowerCase()
                      const rawAmt = tx.amount ? parseInt(tx.amount) : 0
                      const amountFormatted = !isNaN(rawAmt) ? (rawAmt / 1e6).toFixed(2) : '0.00'
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
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                            background: 'var(--surface)', border: '1px solid var(--border)',
                            borderRadius: '16px', padding: '14px 16px', transition: 'all 0.2s',
                          }}
                            onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                            onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
                          >
                            {/* Icon */}
                            <div style={{
                              width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                              background: isSent ? 'rgba(16, 53, 246, 0.08)' : 'rgba(0, 212, 168, 0.08)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: isSent ? 'var(--accent)' : 'var(--green)',
                            }}>
                              {isSent ? <MdCallMade size={20} /> : <MdCallReceived size={20} />}
                            </div>

                            {/* Details */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {isSent ? 'Sent to' : 'Received from'} {counterparty.slice(0, 6)}…{counterparty.slice(-4)}
                              </div>
                              <div style={{ color: 'var(--text-secondary)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                <span>{tx.memo || 'USDC Transfer'}</span>
                              </div>
                            </div>

                            {/* Amount & Status */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                              <div style={{ textAlign: 'right' }}>
                                <span style={{
                                  fontWeight: 800, fontSize: '14px',
                                  color: 'var(--text-primary)',
                                }}>
                                  {isSent ? '-' : '+'}{amountFormatted}
                                </span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '10px', marginLeft: '4px', fontWeight: 600 }}>USDC</span>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '10px', marginTop: '2px' }}>2m ago</div>
                              </div>
                              <span style={{
                                background: 'rgba(16, 185, 129, 0.1)',
                                border: '1px solid rgba(16, 185, 129, 0.2)',
                                color: 'var(--green)',
                                borderRadius: '20px',
                                padding: '4px 10px',
                                fontSize: '11px',
                                fontWeight: 700,
                              }}>
                                Completed
                              </span>
                            </div>
                          </div>
                        </a>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Quick Actions */}
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '24px',
                padding: '24px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.015)'
              }}>
                <h3 style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '15px', marginBottom: '16px' }}>Quick Actions</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <QuickActionRow href="/send" icon={MdSend} label="Send to @username" />
                  <QuickActionRow href="/receive?tab=qr" icon={MdQrCode} label="Scan QR Code" />
                  <QuickActionRow href="/receive?tab=request" icon={MdLink} label="Create Payment Link" />
                  <QuickActionRow href="/receive?tab=request" icon={MdMonetizationOn} label="Request Payment" />
                </div>
              </div>

              {/* Arc Network Info */}
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '24px',
                padding: '24px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.015)'
              }}>
                <h3 style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '15px', marginBottom: '16px' }}>Arc Network</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <NetworkRow label="Network Status" value={<><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)', display: 'inline-block', marginRight: '6px' }} />Connected</>} />
                  <NetworkRow label="Chain ID" value={chainId ? chainId.toString() : "5042002"} />
                  <NetworkRow label="RPC" value="arc-testnet.rpc.com" />
                </div>
              </div>

              {/* Get Started Links */}
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '24px',
                padding: '24px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.015)'
              }}>
                <h3 style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '15px', marginBottom: '16px' }}>Get Started</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <HelpRow href="https://www.arc.network/" label="Learn about Arc" />
                </div>
              </div>
            </div>
          </div>
        )}
      </NetworkGuard>
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
      }}
        onMouseOver={e => {
          e.currentTarget.style.borderColor = 'var(--accent)'
          e.currentTarget.style.transform = 'translateX(2px)'
        }}
        onMouseOut={e => {
          e.currentTarget.style.borderColor = 'var(--border)'
          e.currentTarget.style.transform = 'translateX(0)'
        }}
      >
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
      <span style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700 }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: 800 }}>{value}</span>
    </div>
  )
}

function HelpRow({ href, label }: { href: string; label: string }) {
  return (
    <a 
      href={href} 
      target="_blank" 
      rel="noreferrer" 
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px', background: 'var(--surface-raised)', border: '1px solid var(--border)',
        borderRadius: '12px', textDecoration: 'none', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 700,
        transition: 'all 0.2s'
      }}
      onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent)'}
      onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <span>{label}</span>
      <MdOpenInNew size={18} style={{ color: 'var(--text-muted)' }} />
    </a>
  )
}
