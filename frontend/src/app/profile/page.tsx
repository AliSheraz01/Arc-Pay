'use client'

import { useState, useEffect, useMemo } from 'react'
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
  MdTimeline,
  MdTrendingUp,
  MdDateRange,
  MdFlashOn,
  MdAccountBalanceWallet,
  MdSwapHoriz,
} from 'react-icons/md'
import { useQuery } from '@tanstack/react-query'
import styles from './ProfileAnalyzer.module.css'

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

  useEffect(() => {
    setApprovedInSession(false)
  }, [usernameInput])

  useEffect(() => {
    if (approveSuccess) {
      refetchAllowance()
      setApprovedInSession(true)
      setStep('idle')
    }
  }, [approveSuccess, refetchAllowance])

  useEffect(() => {
    if (regReceipt && step === 'registering') {
      setStep('done')
      refetchUsername()
    }
  }, [regReceipt, step, refetchUsername])

  // Transaction history for analytics
  const { data: rawTxData } = useQuery({
    queryKey: ['txHistoryRaw', address],
    queryFn: async () => {
      if (!address) return []
      const res = await fetch(`${BACKEND_URL}/api/transactions/${address}`)
      if (!res.ok) return []
      return await res.json()
    },
    enabled: !!address,
    refetchInterval: 15000,
  })

  // Analytics Calculations
  const analytics = useMemo(() => {
    const txs = Array.isArray(rawTxData) ? rawTxData : []
    
    // Base stats
    const sent = txs.filter((t: any) => t.fromAddress.toLowerCase() === address?.toLowerCase())
    const received = txs.filter((t: any) => t.toAddress.toLowerCase() === address?.toLowerCase())
    
    let firstDate: Date | null = null
    let lastDate: Date | null = null
    
    if (txs.length > 0) {
      // Sort ascending to find first/last
      const sorted = [...txs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      firstDate = new Date(sorted[0].timestamp)
      lastDate = new Date(sorted[sorted.length - 1].timestamp)
    }

    // Heatmap data (last 16 weeks)
    const weeks = 16
    const days = weeks * 7
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const counts: Record<string, number> = {}
    txs.forEach((tx: any) => {
      const d = new Date(tx.timestamp)
      d.setHours(0, 0, 0, 0)
      counts[d.toISOString()] = (counts[d.toISOString()] || 0) + 1
    })

    const heatmapArray = []
    let activeDaysCount = 0
    let currentStreak = 0
    let maxStreak = 0

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = d.toISOString()
      const count = counts[key] || 0
      
      let level = 0
      if (count > 0) {
        level = 1
        if (count > 2) level = 2
        if (count > 5) level = 3
        if (count > 10) level = 4
        if (count > 20) level = 5
        
        activeDaysCount++
        currentStreak++
        if (currentStreak > maxStreak) maxStreak = currentStreak
      } else {
        currentStreak = 0
      }
      
      heatmapArray.push({ date: d, count, level })
    }

    const weeksData = []
    for (let i = 0; i < heatmapArray.length; i += 7) {
      weeksData.push(heatmapArray.slice(i, i + 7))
    }

    // Calculate Wallet Age
    let walletAge = 'New Wallet'
    if (firstDate) {
      const diffTime = Math.abs(today.getTime() - firstDate.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      if (diffDays < 30) walletAge = `${diffDays} Days`
      else walletAge = `${Math.floor(diffDays / 30)} Months`
    }

    // Calculate Reputation Score (0 - 99)
    // Formula: Baseline + active days bonus + tx volume bonus + verification bonus
    let repScore = 15 // Base score
    if (txs.length > 0) repScore += 10
    repScore += Math.min(30, activeDaysCount * 2)
    repScore += Math.min(20, txs.length)
    if (myUsername && (myUsername as string).length > 0) repScore += 24 // Verified bonus
    
    repScore = Math.min(99, Math.floor(repScore))

    return {
      totalTxs: txs.length,
      sentCount: sent.length,
      receivedCount: received.length,
      firstDate,
      lastDate,
      walletAge,
      activeDays: activeDaysCount,
      longestStreak: maxStreak,
      heatmap: weeksData,
      reputationScore: repScore
    }
  }, [rawTxData, address, myUsername])

  const formattedBalance = usdcBalance !== undefined ? parseFloat(formatUnits(usdcBalance as bigint, 6)).toFixed(2) : '—'
  const hasEnoughBalance = usdcBalance !== undefined && (usdcBalance as bigint) >= REGISTRATION_FEE
  const alreadyApproved = (allowance !== undefined && (allowance as bigint) >= REGISTRATION_FEE) || approvedInSession
  const alreadyRegistered = !!(myUsername && (myUsername as string).length > 0)

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
    if (!usernameInput) { setError('Username is required'); return }
    if (usernameInput.length < 3) { setError('At least 3 characters'); return }
    setError('')

    if (!hasEnoughBalance) {
      setError('Insufficient USDC balance. You need 1 USDC to register.')
      return
    }

    if (alreadyApproved) {
      await handleRegister()
      return
    }

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
  const formatDate = (d: Date | null) => {
    if (!d) return '—'
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <PageLayout>
      <NetworkGuard>
        <div className={styles.container}>
          
          <div className={styles.header}>
            <h1 className={styles.title}>Profile Analyzer</h1>
            <p className={styles.subtitle}>Deep insights into your on-chain payment activity and reputation.</p>
          </div>

          {/* Profile Overview */}
          <div className={styles.profileGrid}>
            <div className={styles.card}>
              <div className={styles.avatarArea}>
                <div className={styles.avatar}>
                  {alreadyRegistered ? (myUsername as string)[0].toUpperCase() : '👤'}
                  <div className={styles.badge} title="Arc Testnet">
                    <MdVerifiedUser size={14} />
                  </div>
                </div>
                <div className={styles.profileInfo}>
                  <h2>
                    {alreadyRegistered ? `@${myUsername}` : 'Unregistered Wallet'}
                    {alreadyRegistered && <MdVerifiedUser size={20} color="#00d4a8" />}
                  </h2>
                  {address && (
                    <p>
                      <MdTag size={14} /> {shortAddr(address)}
                      <button onClick={copyAddress} style={{ background:'none', border:'none', cursor:'pointer', color: copied ? '#00d4a8' : '#6b7280' }}>
                        <MdContentCopy size={14} />
                      </button>
                    </p>
                  )}
                  <div style={{ marginTop: '12px', display: 'flex', gap: '16px' }}>
                    <span style={{ fontSize: '13px', color: '#6b7280' }}><strong>{analytics.walletAge}</strong> Age</span>
                    <span style={{ fontSize: '13px', color: '#6b7280' }}><strong>{analytics.reputationScore > 50 ? 'High' : 'Normal'}</strong> Activity</span>
                  </div>
                </div>
              </div>

              {!alreadyRegistered && (
                <div className={styles.regBanner}>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>Claim your Arc Identity</h4>
                    <p style={{ fontSize: '12px', color: '#6b7280' }}>Required 1 USDC fee to register a username.</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input 
                      type="text" 
                      placeholder="@username" 
                      value={usernameInput}
                      onChange={e => setUsernameInput(e.target.value)}
                      disabled={step !== 'idle'}
                    />
                    <button onClick={handleSubmit} disabled={step !== 'idle' || !usernameInput}>
                      {step === 'approving' ? 'Approving...' : step === 'registering' ? 'Registering...' : 'Register'}
                    </button>
                  </div>
                </div>
              )}
              {error && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '12px', fontWeight: 600 }}>{error}</p>}
            </div>

            <div className={styles.card} style={{ padding: 0 }}>
              <div className={styles.reputationScore}>
                <div className={styles.scoreValue}>{analytics.reputationScore}</div>
                <div className={styles.scoreLabel}>Reputation Score</div>
                <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#6b7280' }}>
                  <MdTrendingUp size={16} color="#00d4a8" />
                  Top {100 - analytics.reputationScore}% of wallets
                </div>
              </div>
            </div>
          </div>

          {/* Analytics Cards Grid */}
          <div className={styles.analyticsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <div className={`${styles.statIcon} ${styles.purple}`}><MdSwapHoriz size={20} /></div>
                <div className={styles.statTitle}>Total Transactions</div>
              </div>
              <div className={styles.statValue}>{analytics.totalTxs}</div>
            </div>
            
            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <div className={`${styles.statIcon} ${styles.teal}`}><MdAccountBalanceWallet size={20} /></div>
                <div className={styles.statTitle}>USDC Balance</div>
              </div>
              <div className={styles.statValue}>${formattedBalance}</div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <div className={`${styles.statIcon} ${styles.orange}`}><MdFlashOn size={20} /></div>
                <div className={styles.statTitle}>Longest Streak</div>
              </div>
              <div className={styles.statValue}>{analytics.longestStreak} <span style={{ fontSize: '14px', color: '#6b7280' }}>days</span></div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <div className={`${styles.statIcon} ${styles.pink}`}><MdTimeline size={20} /></div>
                <div className={styles.statTitle}>Active Days</div>
              </div>
              <div className={styles.statValue}>{analytics.activeDays}</div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <div className={`${styles.statIcon} ${styles.indigo}`}><MdDateRange size={20} /></div>
                <div className={styles.statTitle}>First Activity</div>
              </div>
              <div className={styles.statValue} style={{ fontSize: '18px' }}>{formatDate(analytics.firstDate)}</div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <div className={`${styles.statIcon} ${styles.blue}`}><MdDateRange size={20} /></div>
                <div className={styles.statTitle}>Last Activity</div>
              </div>
              <div className={styles.statValue} style={{ fontSize: '18px' }}>{formatDate(analytics.lastDate)}</div>
            </div>
          </div>

          {/* Activity Heatmap */}
          <div className={styles.card} style={{ marginBottom: '24px' }}>
            <h3 className={styles.sectionTitle}><MdTimeline size={24} color="#7c3aed" /> Transaction Activity Heatmap</h3>
            <div className={styles.heatmapContainer}>
              <div className={styles.heatmapGrid}>
                {/* Days of week column */}
                <div className={styles.daysColumn}>
                  <span>Mon</span>
                  <span>Wed</span>
                  <span>Fri</span>
                </div>
                {/* Weeks */}
                {analytics.heatmap.map((week, i) => (
                  <div key={i} className={styles.weekColumn}>
                    {week.map((day, j) => (
                      <div 
                        key={j} 
                        className={`${styles.dayCell} ${styles['level' + day.level]}`}
                        title={`${day.date.toDateString()}: ${day.count} transactions`}
                      />
                    ))}
                  </div>
                ))}
              </div>
              <div className={styles.legend}>
                Less
                <div className={`${styles.dayCell} ${styles.level0}`}></div>
                <div className={`${styles.dayCell} ${styles.level1}`}></div>
                <div className={`${styles.dayCell} ${styles.level2}`}></div>
                <div className={`${styles.dayCell} ${styles.level3}`}></div>
                <div className={`${styles.dayCell} ${styles.level4}`}></div>
                <div className={`${styles.dayCell} ${styles.level5}`}></div>
                More
              </div>
            </div>
          </div>

          {/* Payment Behavior Insights & Lookup */}
          <div className={styles.profileGrid} style={{ marginBottom: 0 }}>
            <div className={styles.card}>
              <h3 className={styles.sectionTitle}><MdAutoAwesome size={24} color="#00d4a8" /> Payment Behavior Insights</h3>
              <div className={styles.insightList}>
                <div className={styles.insightItem}>
                  <div className={styles.insightLabel}>
                    <div className={`${styles.statIcon} ${styles.purple}`} style={{ width: 28, height: 28 }}><MdArrowForward size={16} /></div>
                    Payments Sent vs Received
                  </div>
                  <div className={styles.insightValue}>
                    {analytics.sentCount} / {analytics.receivedCount}
                  </div>
                </div>
                <div className={styles.insightItem}>
                  <div className={styles.insightLabel}>
                    <div className={`${styles.statIcon} ${styles.teal}`} style={{ width: 28, height: 28 }}><MdTrendingUp size={16} /></div>
                    Average Transaction Frequency
                  </div>
                  <div className={styles.insightValue}>
                    {analytics.totalTxs > 0 ? (analytics.totalTxs / Math.max(1, analytics.activeDays)).toFixed(1) : 0} <span style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280' }}>/ active day</span>
                  </div>
                </div>
                <div className={styles.insightItem}>
                  <div className={styles.insightLabel}>
                    <div className={`${styles.statIcon} ${styles.orange}`} style={{ width: 28, height: 28 }}><MdFlashOn size={16} /></div>
                    Payment Consistency
                  </div>
                  <div className={styles.insightValue}>
                    {analytics.activeDays > 10 ? 'High' : analytics.activeDays > 3 ? 'Medium' : 'Low'}
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.card}>
              <h3 className={styles.sectionTitle}><MdAlternateEmail size={24} color="#3b82f6" /> Arc Directory</h3>
              <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '16px' }}>
                Lookup any Arc username to resolve its wallet address securely on-chain.
              </p>
              <LookupForm />
            </div>
          </div>

        </div>
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
    args: [lookup.toLowerCase().trim().replace('@', '')],
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
        <input
          type="text"
          value={lookup}
          onChange={e => { setLookup(e.target.value); setLookupError(''); setResolved(null) }}
          onKeyDown={e => e.key === 'Enter' && handleLookup()}
          placeholder="@username"
          disabled={!isCorrectNetwork}
          style={{
            flex: 1,
            background: '#f9fafb', border: '1px solid #e5e7eb',
            borderRadius: '12px', padding: '12px 14px',
            color: '#111827', fontSize: '14px', fontWeight: 600,
            outline: 'none', fontFamily: 'monospace',
          }}
        />
        <button
          onClick={handleLookup}
          disabled={!lookup.trim() || looking || !isCorrectNetwork}
          style={{
            background: lookup.trim() && !looking && isCorrectNetwork ? '#111827' : '#f3f4f6',
            border: 'none',
            borderRadius: '12px', padding: '12px 20px',
            color: lookup.trim() && !looking && isCorrectNetwork ? 'white' : '#9ca3af',
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
          <p style={{ color: '#6b7280', fontSize: '12px', marginBottom: '4px', fontWeight: 600 }}>Resolved address</p>
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
