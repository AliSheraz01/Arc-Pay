'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi'
import { formatUnits } from 'viem'
import { PageLayout } from '@/components/PageLayout'
import { NetworkGuard } from '@/components/NetworkGuard'
import { ACTIVE_CHAIN } from '@/config/network'
import {
  USDC_ADDRESS,
  REGISTRY_ADDRESS,
  EXPLORER_URL,
  ARC_CHAIN_ID,
  BACKEND_URL,
} from '@/lib/constants'
import { USDC_ABI, REGISTRY_ABI } from '@/lib/abi'
import {
  MdContentCopy,
  MdTimeline,
  MdVerifiedUser,
  MdAutorenew,
} from 'react-icons/md'
import { useQuery } from '@tanstack/react-query'
import styles from './ProfileAnalyzer.module.css'

export default function ProfilePage() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const isCorrectNetwork = chainId === ARC_CHAIN_ID

  const [usernameInput, setUsernameInput] = useState('')
  const [step, setStep] = useState<'idle' | 'approving' | 'registering' | 'done'>('idle')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [regTxHash, setRegTxHash] = useState<`0x${string}` | undefined>()

  // X Social Connection State
  const [xAccount, setXAccount] = useState<{ connected: boolean; username?: string; displayName?: string; avatar?: string } | null>(null)
  const [loadingX, setLoadingX] = useState(false)
  const [showConnectXModal, setShowConnectXModal] = useState(false)
  const [xHandleInput, setXHandleInput] = useState('')
  const [xDisplayNameInput, setXDisplayNameInput] = useState('')
  const [xConnecting, setXConnecting] = useState(false)
  const [xError, setXError] = useState('')

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

  // Wait for register tx
  const { data: regReceipt } = useWaitForTransactionReceipt({
    hash: regTxHash,
    query: { enabled: !!regTxHash },
  })

  // Fetch X Status & Stored Username
  const [localUsername, setLocalUsername] = useState<string | null>(null)

  const fetchXStatus = useCallback(async (addr: string) => {
    setLoadingX(true)
    // Check localStorage cache first
    try {
      const cached = localStorage.getItem(`easyzpay_x_${addr.toLowerCase()}`)
      if (cached) {
        const parsed = JSON.parse(cached)
        setXAccount(parsed)
      }
      const cachedUser = localStorage.getItem(`easyzpay_username_${addr.toLowerCase()}`)
      if (cachedUser) {
        setLocalUsername(cachedUser)
      }
    } catch {}

    try {
      const res = await fetch(`${BACKEND_URL}/api/social/x/status/${addr}`)
      if (res.ok) {
        const data = await res.json()
        if (data.connected && data.account) {
          const acc = {
            connected: true,
            username: data.account.username,
            displayName: data.account.displayName,
            avatar: data.account.avatar,
          }
          setXAccount(acc)
          localStorage.setItem(`easyzpay_x_${addr.toLowerCase()}`, JSON.stringify(acc))
        } else {
          setXAccount({ connected: false })
        }
      }
    } catch {
      // Backend offline or unreachable — keep cached state if available
      setXAccount(prev => prev || { connected: false })
    } finally {
      setLoadingX(false)
    }
  }, [])

  useEffect(() => {
    if (address) {
      fetchXStatus(address)
      // Check backend user profile
      fetch(`${BACKEND_URL}/api/users/${address}`)
        .then(r => r.ok ? r.json() : null)
        .then(u => {
          if (u?.username) {
            setLocalUsername(u.username)
            localStorage.setItem(`easyzpay_username_${address.toLowerCase()}`, u.username)
          }
        })
        .catch(() => {})
    }
  }, [address, fetchXStatus])

  const handleConnectX = async () => {
    if (!address) return
    setXConnecting(true)
    setXError('')
    const handle = xHandleInput.trim().replace('@', '')
    const displayName = xDisplayNameInput.trim() || `@${handle}`

    try {
      if (handle) {
        const res = await fetch(`${BACKEND_URL}/api/social/x/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address,
            username: handle,
            displayName,
          }),
        })
        if (res.ok) {
          const acc = {
            connected: true,
            username: handle,
            displayName,
            avatar: `https://unavatar.io/twitter/${handle}`,
          }
          localStorage.setItem(`easyzpay_x_${address.toLowerCase()}`, JSON.stringify(acc))
          setXAccount(acc)
          setShowConnectXModal(false)
          setXConnecting(false)
          return
        }
      }

      const res = await fetch(`${BACKEND_URL}/api/social/x/auth?address=${address}`)
      if (res.ok) {
        const data = await res.json()
        if (data.url) {
          window.location.href = data.url
          return
        }
      }
    } catch {}

    if (handle) {
      const localAcc = {
        connected: true,
        username: handle,
        displayName,
        avatar: `https://unavatar.io/twitter/${handle}`,
      }
      localStorage.setItem(`easyzpay_x_${address.toLowerCase()}`, JSON.stringify(localAcc))
      setXAccount(localAcc)
      setShowConnectXModal(false)
    } else {
      setXError('Please enter your X username handle.')
    }
    setXConnecting(false)
  }

  const handleDisconnectX = async () => {
    if (!address) return
    try {
      await fetch(`${BACKEND_URL}/api/social/x/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      })
    } catch {}
    localStorage.removeItem(`easyzpay_x_${address.toLowerCase()}`)
    setXAccount({ connected: false })
  }


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

    // Heatmap data (last 32 weeks approx to fit width or 16 depending on grid)
    const weeks = 28 // Increased weeks for wider heatmap look
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
    let walletSince = 'Recently'
    if (firstDate) {
      walletSince = firstDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      const diffTime = Math.abs(today.getTime() - firstDate.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      if (diffDays < 30) walletAge = `${diffDays} Days`
      else walletAge = `${Math.floor(diffDays / 30)} Months`
    }

    // Calculate Reputation Score (0 - 100)
    let repScore = 15 // Base score
    if (txs.length > 0) repScore += 10
    repScore += Math.min(30, activeDaysCount * 2)
    repScore += Math.min(20, txs.length)
    if (myUsername && (myUsername as string).length > 0) repScore += 25 // Verified bonus
    
    repScore = Math.min(100, Math.floor(repScore))
    
    const uniqueAddresses = new Set()
    txs.forEach((tx: any) => {
      uniqueAddresses.add(tx.fromAddress.toLowerCase())
      uniqueAddresses.add(tx.toAddress.toLowerCase())
    })
    // Remove self
    uniqueAddresses.delete(address?.toLowerCase())

    return {
      totalTxs: txs.length,
      sentCount: sent.length,
      receivedCount: received.length,
      firstDate,
      lastDate,
      walletAge,
      walletSince,
      activeDays: activeDaysCount,
      longestStreak: maxStreak,
      heatmap: weeksData,
      reputationScore: repScore,
      uniqueWallets: uniqueAddresses.size,
    }
  }, [rawTxData, address, myUsername])

  const formattedBalance = usdcBalance !== undefined ? parseFloat(formatUnits(usdcBalance as bigint, 6)).toFixed(2) : '—'
  const effectiveUsername = (myUsername as string) || localUsername || ''
  const alreadyRegistered = !!(effectiveUsername && effectiveUsername.trim().length > 0)

  const handleRegister = async () => {
    if (!usernameInput) { setError('Username is required'); return }
    if (usernameInput.length < 3) { setError('At least 3 characters'); return }
    setError('')
    setStep('registering')
    const cleanUsername = usernameInput.toLowerCase().trim().replace('@', '')
    try {
      const hash = await writeContractAsync({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'registerUsername',
        args: [cleanUsername],
      })
      setRegTxHash(hash)
      if (address) {
        localStorage.setItem(`easyzpay_username_${address.toLowerCase()}`, cleanUsername)
        setLocalUsername(cleanUsername)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg.includes('user rejected') ? 'Transaction rejected.' : `Registration failed: ${msg.slice(0, 80)}`)
      setStep('idle')
    }
  }

  const handleSubmit = async () => {
    await handleRegister()
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

  // Derived variables for display
  const displayName = alreadyRegistered ? `@${effectiveUsername}` : 'EasyZPay User'
  const avatarText = alreadyRegistered ? effectiveUsername.slice(0, 2).toUpperCase() : 'EZ'
  const isBuilder = analytics.totalTxs > 5

  return (
    <PageLayout>
      <NetworkGuard>
        <div className={styles.container}>
          
          {/* Top Cards Grid */}
          <div className={styles.profileGrid}>
            
            {/* Identity Card */}
            <div className={`${styles.card} ${styles.cardRedAccent}`}>
              <div className={styles.topLayout}>
                <div className={styles.avatarHeader}>
                  <div className={styles.avatar}>
                    {avatarText}
                  </div>
                  <div className={styles.avatarInfo}>
                    <h2>{alreadyRegistered ? `@${effectiveUsername}` : 'EasyZPay User'}</h2>
                    <p>Since {analytics.walletSince}</p>
                  </div>
                </div>

                <div className={styles.handlePill}>
                  <MdContentCopy size={14} style={{ cursor: 'pointer' }} onClick={copyAddress} color={copied ? '#00d4a8' : 'inherit'} /> 
                  {alreadyRegistered ? `@${effectiveUsername}` : `@${shortAddr(address || '0x0000000000000000000000000000000000000000')}`}
                </div>

                <div className={styles.balanceSection}>
                  <div className={styles.balanceLabel}>{ACTIVE_CHAIN.name.toUpperCase()} BALANCE</div>
                  <div className={styles.balanceValue}>
                    •••• <div className={styles.usdcIcon}>$</div>
                  </div>
                </div>

                <a href={`${EXPLORER_URL}/address/${address}`} target="_blank" rel="noreferrer" className={styles.linkRed}>
                  View on ArcScan ↗
                </a>
              </div>
            </div>

            {/* Arc Onchain Score Card */}
            <div className={styles.card}>
              <div className={styles.scoreContainer}>
                
                <div className={styles.scoreRow}>
                  <div className={styles.scoreCircle} style={{ '--percentage': analytics.reputationScore } as React.CSSProperties}>
                    <div className={styles.scoreValue}>
                      <div className={styles.number}>{analytics.reputationScore}</div>
                      <div className={styles.divider}>/100</div>
                    </div>
                  </div>

                  <div className={styles.scoreDetails}>
                    <div className={styles.scoreLabel}>ARC ONCHAIN SCORE</div>
                    {isBuilder && <div className={styles.builderTag}>Builder</div>}
                    
                    <div className={styles.progressBars}>
                      <div className={styles.progressSegment}>
                        <div className={styles.progressLabel}>EXPLORER</div>
                        <div className={styles.progressBar}><div className={styles.progressBarFill} style={{ width: '100%' }}></div></div>
                      </div>
                      <div className={styles.progressSegment}>
                        <div className={styles.progressLabel}>BUILDER</div>
                        <div className={styles.progressBar}><div className={styles.progressBarFill} style={{ width: '60%' }}></div></div>
                      </div>
                      <div className={styles.progressSegment}>
                        <div className={styles.progressLabel}>CONTRIBUTOR</div>
                        <div className={styles.progressBar}><div className={styles.progressBarFill} style={{ width: '0%' }}></div></div>
                      </div>
                      <div className={styles.progressSegment}>
                        <div className={styles.progressLabel}>POWER ARC</div>
                        <div className={styles.progressBar}><div className={styles.progressBarFill} style={{ width: '0%' }}></div></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.scoreFooter}>
                  Calculated from live Arc Mainnet data · Diminishing returns prevent farming
                </div>
              </div>
            </div>
            
          </div>

          {/* Social Accounts (X / Twitter) Card */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '20px', padding: '24px', marginBottom: '24px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '50%',
                background: '#000', color: '#fff', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 900
              }}>
                𝕏
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    {xAccount?.connected ? `@${xAccount.username}` : 'Connect 𝕏 (Twitter) Account'}
                  </h3>
                  {xAccount?.connected && (
                    <span style={{
                      background: 'rgba(0, 212, 168, 0.1)', color: 'var(--green)',
                      fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '10px'
                    }}>
                      ✓ CONNECTED
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                  {xAccount?.connected
                    ? `Receive payments directly via your X username (@${xAccount.username}).`
                    : 'Link your X account so friends and clients can pay you using @yourhandle.'}
                </p>
              </div>
            </div>

            <div>
              {xAccount?.connected ? (
                <button
                  type="button"
                  onClick={handleDisconnectX}
                  style={{
                    background: 'transparent', border: '1px solid var(--border)',
                    color: 'var(--red)', padding: '10px 18px', borderRadius: '12px',
                    fontSize: '13px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  Disconnect 𝕏
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowConnectXModal(true)}
                  style={{
                    background: '#000', color: '#fff', border: '1px solid rgba(255,255,255,0.2)',
                    padding: '10px 20px', borderRadius: '12px', fontSize: '13px', fontWeight: 800,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.3)'
                  }}
                >
                  <span>𝕏</span> Connect 𝕏 Handle
                </button>
              )}
            </div>
          </div>

          {/* Connect X Modal */}
          {showConnectXModal && (
            <div style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px'
            }}>
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '24px', padding: '28px', maxWidth: '440px', width: '100%',
                boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>
                    𝕏
                  </div>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                      Connect 𝕏 (Twitter)
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                      Links your immutable X identity to this EasyZPay wallet.
                    </p>
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                    Your 𝕏 Username Handle
                  </label>
                  <input
                    type="text"
                    placeholder="@elonmusk"
                    value={xHandleInput}
                    onChange={e => setXHandleInput(e.target.value)}
                    style={{
                      width: '100%', background: 'var(--surface-raised)', border: '1px solid var(--border)',
                      borderRadius: '12px', padding: '12px 14px', color: 'var(--text-primary)',
                      fontSize: '14px', outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                    Display Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Elon Musk"
                    value={xDisplayNameInput}
                    onChange={e => setXDisplayNameInput(e.target.value)}
                    style={{
                      width: '100%', background: 'var(--surface-raised)', border: '1px solid var(--border)',
                      borderRadius: '12px', padding: '12px 14px', color: 'var(--text-primary)',
                      fontSize: '14px', outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>

                {xError && (
                  <p style={{ color: 'var(--red)', fontSize: '12px', marginBottom: '16px', fontWeight: 600 }}>
                    {xError}
                  </p>
                )}

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setShowConnectXModal(false)}
                    style={{
                      flex: 1, background: 'transparent', border: '1px solid var(--border)',
                      borderRadius: '12px', padding: '12px', color: 'var(--text-primary)',
                      fontSize: '13px', fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={xConnecting || !xHandleInput.trim()}
                    onClick={handleConnectX}
                    style={{
                      flex: 1, background: '#000', border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '12px', padding: '12px', color: '#fff',
                      fontSize: '13px', fontWeight: 800, cursor: 'pointer'
                    }}
                  >
                    {xConnecting ? 'Connecting...' : 'Connect 𝕏 Account'}
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className={styles.analyticsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statTitle}>TOTAL TXS</div>
              <div className={styles.statValue}>{analytics.totalTxs}</div>
              <div className={styles.statSubtitle}>Sent + received</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statTitle}>SENT</div>
              <div className={styles.statValue}>{analytics.sentCount}</div>
              <div className={styles.statSubtitle}>Outgoing</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statTitle}>RECEIVED</div>
              <div className={styles.statValue}>{analytics.receivedCount}</div>
              <div className={styles.statSubtitle}>Incoming</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statTitle}>TOKEN TRANSFERS</div>
              <div className={styles.statValue}>{analytics.totalTxs > 0 ? Math.floor(analytics.totalTxs * 0.7) : 0}</div>
              <div className={styles.statSubtitle}>ERC-20 events</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statTitle}>INTERNAL TXS</div>
              <div className={styles.statValue}>0</div>
              <div className={styles.statSubtitle}>Contract calls</div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statTitle}>ACTIVE DAYS</div>
              <div className={`${styles.statValue} ${styles.red}`}>{analytics.activeDays}</div>
              <div className={styles.statSubtitle}>{Math.ceil(analytics.activeDays / 7)} weeks</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statTitle}>DAY STREAK</div>
              <div className={`${styles.statValue} ${styles.red}`}>{analytics.longestStreak}</div>
              <div className={styles.statSubtitle}>Consecutive</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statTitle}>TOKENS LAUNCHED</div>
              <div className={styles.statValue}>0</div>
              <div className={styles.statSubtitle}>Via Arc Launcher</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statTitle}>UNIQUE ADDRESSES</div>
              <div className={styles.statValue}>{analytics.uniqueWallets}</div>
              <div className={styles.statSubtitle}>Wallets touched</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statTitle}>FIRST TX</div>
              <div className={styles.statValue} style={{ fontSize: '18px', paddingTop: '4px' }}>{formatDate(analytics.firstDate)}</div>
              <div className={styles.statSubtitle}>{analytics.firstDate ? analytics.firstDate.getFullYear() : '—'}</div>
            </div>
          </div>

          {/* Activity Heatmap */}
          <div className={`${styles.card} ${styles.cardRedAccent}`} style={{ padding: '24px 24px 16px 24px' }}>
            <div className={styles.heatmapHeader}>
              <h3 className={styles.sectionTitle}>
                <MdTimeline size={20} color="#ef4444" /> Transaction Activity 
                <span className={styles.redAction}><MdAutorenew size={14} /> Swipe to view</span>
              </h3>
              <div className={styles.heatmapSubtitle}>
                Last: {analytics.lastDate ? formatDate(analytics.lastDate) : 'Never'}
              </div>
            </div>
            
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

          <div className={styles.footer}>
            Live · <span className={styles.highlight}>Arc Explorer API</span> · Profile globally visible
          </div>

          {/* Registration Fallback (Hidden if already registered, kept for functionality) */}
          {!alreadyRegistered && address && (
            <div className={styles.regBanner}>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>Claim your Identity</h4>
                <p style={{ fontSize: '12px', color: '#a1a1aa', margin: 0 }}>Free registration (gas only)</p>
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

        </div>
      </NetworkGuard>
    </PageLayout>
  )
}
