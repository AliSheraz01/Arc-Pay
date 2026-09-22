'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAccount, useWriteContract } from 'wagmi'
import { parseUnits, keccak256, toBytes, createPublicClient, http, isAddress } from 'viem'
import { 
  MdEmojiEvents, 
  MdAdd, 
  MdCheckCircle, 
  MdAccessTime, 
  MdSend, 
  MdErrorOutline, 
  MdLock, 
  MdArrowBack,
  MdOpenInNew,
  MdPerson,
  MdFlag,
  MdChecklist,
  MdCancel,
  MdSecurity
} from 'react-icons/md'
import { PageLayout } from '@/components/PageLayout'
import { NetworkGuard } from '@/components/NetworkGuard'
import { USDC_ABI, BOUNTY_ESCROW_ABI } from '@/lib/abi'
import { 
  USDC_ADDRESS, 
  BOUNTY_ESCROW_ADDRESS, 
  ACTIVE_CHAIN, 
  EXPLORER_URL, 
  BACKEND_URL, 
  IS_PRODUCTION 
} from '@/lib/constants'

// Deterministic bytes32 bountyId from off-chain UUID string
function toBountyId(id: string): `0x${string}` {
  return keccak256(toBytes(id))
}

const publicClient = createPublicClient({
  chain: ACTIVE_CHAIN as any,
  transport: http(process.env.NEXT_PUBLIC_ARC_RPC_URL || (IS_PRODUCTION ? 'https://rpc.mainnet.arc.io' : 'https://rpc.testnet.arc.network')),
})

type BountyTab = 'featured' | 'active' | 'my_bounties' | 'my_submissions' | 'completed'

interface TaskItem {
  id: string
  text: string
}

export default function BountiesPage() {
  const { address, isConnected } = useAccount()

  // Navigation State
  const [currentView, setCurrentView] = useState<'list' | 'create' | 'detail'>('list')
  const [activeTab, setActiveTab] = useState<BountyTab>('active')

  // Data State
  const [bounties, setBounties] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Create Bounty Form State
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [prizeAmount, setPrizeAmount] = useState('120')
  const [deadline, setDeadline] = useState('')
  const [category, setCategory] = useState('Development')
  const [difficulty, setDifficulty] = useState('Intermediate')
  const [requirements, setRequirements] = useState(
    '1. Original work\n2. No plagiarism\n3. Source code or demo link required\n4. Verified Arc address'
  )
  const [tasks, setTasks] = useState<TaskItem[]>([
    { id: '1', text: 'Implement required functionality' },
    { id: '2', text: 'Provide unit tests and screenshots' },
    { id: '3', text: 'Submit GitHub repository / demo URL' },
  ])
  const [newTaskInput, setNewTaskInput] = useState('')

  // Submission State
  const [submitContent, setSubmitContent] = useState('')
  const [submitLinks, setSubmitLinks] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Escrow Interaction State
  const [fundPhase, setFundPhase] = useState<'idle' | 'approving' | 'depositing' | 'confirming' | 'done'>('idle')
  const [payPhase, setPayPhase] = useState<'idle' | 'releasing' | 'confirming' | 'done'>('idle')
  const [cancelPhase, setCancelPhase] = useState<'idle' | 'cancelling' | 'confirming' | 'done'>('idle')
  const [selectingWinner, setSelectingWinner] = useState<string | null>(null)

  const { writeContractAsync } = useWriteContract()

  // Fetch all bounties
  const fetchBounties = useCallback(async () => {
    let list: any[] = []
    try {
      const res = await fetch(`${BACKEND_URL}/api/bounties`)
      if (res.ok) list = await res.json()
    } catch {}

    try {
      const local = localStorage.getItem('easyzpay_local_bounties')
      if (local) {
        const localList = JSON.parse(local)
        for (const item of localList) {
          if (!list.some(b => b.id === item.id)) list.unshift(item)
        }
      }
    } catch {}

    setBounties(list)
  }, [])

  // Fetch individual bounty
  const fetchBounty = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/bounties/${id}`)
      if (res.ok) {
        setSelected(await res.json())
        return
      }
    } catch {}

    try {
      const local = localStorage.getItem('easyzpay_local_bounties')
      if (local) {
        const found = JSON.parse(local).find((b: any) => b.id === id)
        if (found) setSelected(found)
      }
    } catch {}
  }, [])

  useEffect(() => {
    fetchBounties()
  }, [fetchBounties])

  // Filtered bounties per tab
  const filteredBounties = useMemo(() => {
    const userAddr = address?.toLowerCase()
    switch (activeTab) {
      case 'featured':
        return bounties.filter(b => b.status === 'OPEN' && parseFloat(b.prizeAmount) >= 100)
      case 'active':
        return bounties.filter(b => b.status === 'OPEN')
      case 'my_bounties':
        return userAddr ? bounties.filter(b => b.creatorAddress?.toLowerCase() === userAddr) : []
      case 'my_submissions':
        return userAddr 
          ? bounties.filter(b => (b.submissions || []).some((s: any) => s.submitterAddress?.toLowerCase() === userAddr)) 
          : []
      case 'completed':
        return bounties.filter(b => b.status === 'COMPLETED')
      default:
        return bounties
    }
  }, [bounties, activeTab, address])

  // Task list management
  const addTask = () => {
    if (!newTaskInput.trim()) return
    setTasks([...tasks, { id: Date.now().toString(), text: newTaskInput.trim() }])
    setNewTaskInput('')
  }

  const removeTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id))
  }

  // Create Bounty Flow
  const handleCreateBounty = async () => {
    if (!address || !title || !prizeAmount) {
      setError('Please fill in title, reward, and connect your wallet.')
      return
    }
    setLoading(true)
    setError('')

    const bountyData = {
      title,
      description,
      creatorAddress: address.toLowerCase(),
      prizeAmount,
      tasks: tasks.map(t => t.text),
      deadline: deadline || null,
      requirements,
      category,
      difficulty,
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/bounties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bountyData),
      })

      if (res.ok) {
        const b = await res.json()
        setSelected(b)
        setCurrentView('detail')
        await fetchBounties()
        setLoading(false)
        return
      }
    } catch {}

    // Offline fallback
    const newB = {
      id: `bounty_local_${Date.now()}`,
      ...bountyData,
      token: 'USDC',
      chainId: ACTIVE_CHAIN.id,
      status: 'OPEN',
      escrowStatus: 'UNFUNDED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      submissions: [],
    }
    const existing = JSON.parse(localStorage.getItem('easyzpay_local_bounties') || '[]')
    existing.unshift(newB)
    localStorage.setItem('easyzpay_local_bounties', JSON.stringify(existing))

    setSelected(newB)
    setCurrentView('detail')
    await fetchBounties()
    setLoading(false)
  }

  // Fund Bounty on Arc Mainnet
  const handleFundBounty = async () => {
    if (!selected || !address) return
    setError('')
    setFundPhase('approving')

    try {
      const amountWei = parseUnits(selected.prizeAmount, 6)
      const bountyId = toBountyId(selected.id)
      const deadlineTimestamp = selected.deadline 
        ? Math.floor(new Date(selected.deadline).getTime() / 1000) 
        : 0

      // Step 1: Approve USDC spend limit
      const approveHash = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [BOUNTY_ESCROW_ADDRESS, amountWei],
      })
      await publicClient.waitForTransactionReceipt({ hash: approveHash })

      // Step 2: Deposit into BountyEscrow
      setFundPhase('depositing')
      const depositHash = await writeContractAsync({
        address: BOUNTY_ESCROW_ADDRESS,
        abi: BOUNTY_ESCROW_ABI,
        functionName: 'depositBounty',
        args: [bountyId, amountWei, BigInt(deadlineTimestamp)],
      })

      setFundPhase('confirming')
      await publicClient.waitForTransactionReceipt({ hash: depositHash })

      // Step 3: Record funding in backend
      try {
        await fetch(`${BACKEND_URL}/api/bounties/${selected.id}/fund`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ txHash: depositHash, bountyHash: bountyId }),
        })
      } catch {}

      // Update local cache
      try {
        const existing = JSON.parse(localStorage.getItem('easyzpay_local_bounties') || '[]')
        const idx = existing.findIndex((b: any) => b.id === selected.id)
        if (idx !== -1) {
          existing[idx].fundTxHash = depositHash
          existing[idx].escrowStatus = 'FUNDED'
          existing[idx].status = 'OPEN'
          localStorage.setItem('easyzpay_local_bounties', JSON.stringify(existing))
        }
      } catch {}

      setFundPhase('done')
      await fetchBounty(selected.id)
      await fetchBounties()
    } catch (e: any) {
      console.error('Funding failed:', e)
      setError(e.message || 'Escrow funding failed')
    }
    setFundPhase('idle')
  }

  // Submit Work Flow
  const handleSubmitWork = async () => {
    if (!selected || !address || !submitContent.trim()) {
      setError('Please provide your submission summary or proof links.')
      return
    }
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch(`${BACKEND_URL}/api/bounties/${selected.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submitterAddress: address.toLowerCase(),
          content: submitContent,
          links: submitLinks,
        }),
      })

      if (res.ok) {
        setSubmitContent('')
        setSubmitLinks('')
        await fetchBounty(selected.id)
        await fetchBounties()
        setSubmitting(false)
        return
      }
    } catch {}

    // Offline fallback
    const localSub = {
      id: `sub_${Date.now()}`,
      bountyId: selected.id,
      submitterAddress: address.toLowerCase(),
      content: submitContent,
      links: submitLinks,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    }
    const existing = JSON.parse(localStorage.getItem('easyzpay_local_bounties') || '[]')
    const idx = existing.findIndex((b: any) => b.id === selected.id)
    if (idx !== -1) {
      existing[idx].submissions = existing[idx].submissions || []
      existing[idx].submissions.unshift(localSub)
      localStorage.setItem('easyzpay_local_bounties', JSON.stringify(existing))
    }

    setSubmitContent('')
    setSubmitLinks('')
    await fetchBounty(selected.id)
    await fetchBounties()
    setSubmitting(false)
  }

  // Winner Selection & Escrow Payout
  const handleSelectWinner = async (submissionId: string, winnerAddr: string) => {
    if (!selected || !address) return
    setSelectingWinner(submissionId)
    setError('')
    setPayPhase('releasing')

    try {
      const bountyId = toBountyId(selected.id)

      // Step 1: Release prize directly from BountyEscrow
      const releaseHash = await writeContractAsync({
        address: BOUNTY_ESCROW_ADDRESS,
        abi: BOUNTY_ESCROW_ABI,
        functionName: 'releasePrize',
        args: [bountyId, winnerAddr as `0x${string}`],
      })

      setPayPhase('confirming')
      await publicClient.waitForTransactionReceipt({ hash: releaseHash })

      // Step 2: Update backend
      try {
        await fetch(`${BACKEND_URL}/api/bounties/${selected.id}/select-winner`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            submissionId,
            rewardAmount: selected.prizeAmount,
            rewardTxHash: releaseHash,
            winnerAddress: winnerAddr,
          }),
        })
      } catch {}

      // Update local storage
      try {
        const existing = JSON.parse(localStorage.getItem('easyzpay_local_bounties') || '[]')
        const idx = existing.findIndex((b: any) => b.id === selected.id)
        if (idx !== -1) {
          existing[idx].status = 'COMPLETED'
          existing[idx].escrowStatus = 'PAID'
          existing[idx].winnerAddress = winnerAddr
          existing[idx].rewardTxHash = releaseHash
          const sub = existing[idx].submissions?.find((s: any) => s.id === submissionId)
          if (sub) {
            sub.status = 'WINNER'
            sub.rewardTxHash = releaseHash
          }
          localStorage.setItem('easyzpay_local_bounties', JSON.stringify(existing))
        }
      } catch {}

      setPayPhase('done')
      await fetchBounty(selected.id)
      await fetchBounties()
    } catch (e: any) {
      console.error('Prize release failed:', e)
      setError(e.message || 'Failed to release prize from escrow')
    }
    setPayPhase('idle')
    setSelectingWinner(null)
  }

  // Cancel Bounty & Refund Creator
  const handleCancelBounty = async () => {
    if (!selected || !address) return
    if (!confirm('Are you sure you want to cancel this bounty and refund the escrow balance to your wallet?')) return

    setError('')
    setCancelPhase('cancelling')

    try {
      const bountyId = toBountyId(selected.id)
      const cancelHash = await writeContractAsync({
        address: BOUNTY_ESCROW_ADDRESS,
        abi: BOUNTY_ESCROW_ABI,
        functionName: 'cancelBounty',
        args: [bountyId],
      })

      setCancelPhase('confirming')
      await publicClient.waitForTransactionReceipt({ hash: cancelHash })

      // Update backend
      try {
        await fetch(`${BACKEND_URL}/api/bounties/${selected.id}/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refundTxHash: cancelHash }),
        })
      } catch {}

      setCancelPhase('done')
      await fetchBounty(selected.id)
      await fetchBounties()
    } catch (e: any) {
      console.error('Bounty cancellation failed:', e)
      setError(e.message || 'Failed to cancel bounty')
    }
    setCancelPhase('idle')
  }

  const isCreator = selected && address && selected.creatorAddress?.toLowerCase() === address.toLowerCase()
  const isEscrowFunded = selected && (selected.escrowStatus === 'FUNDED' || !!selected.fundTxHash)
  const isCompleted = selected && selected.status === 'COMPLETED'
  const isCancelled = selected && selected.status === 'CANCELLED'

  return (
    <PageLayout>
      <main style={{ maxWidth: '960px', margin: '0 auto', padding: '0 16px' }}>
        <NetworkGuard>
          {/* Top Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ 
                  background: 'rgba(16, 53, 246, 0.1)', 
                  color: 'var(--accent)', 
                  padding: '4px 10px', 
                  borderRadius: '12px', 
                  fontSize: '11px', 
                  fontWeight: 800,
                  letterSpacing: '0.04em' 
                }}>
                  {ACTIVE_CHAIN.name.toUpperCase()}
                </span>
                <span style={{ 
                  background: 'rgba(16, 185, 129, 0.1)', 
                  color: 'var(--green)', 
                  padding: '4px 10px', 
                  borderRadius: '12px', 
                  fontSize: '11px', 
                  fontWeight: 800 
                }}>
                  ON-CHAIN ESCROW
                </span>
              </div>
              <h1 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                USDC Bounties
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                Create or solve tasks funded securely on Arc Mainnet escrow.
              </p>
            </div>

            {currentView === 'list' && (
              <button
                onClick={() => { setCurrentView('create'); setError('') }}
                style={{
                  background: 'linear-gradient(135deg, #1035f6, #3b82f6)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '14px',
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(16, 53, 246, 0.25)',
                  transition: 'all 0.2s',
                }}
              >
                <MdAdd size={20} /> Create Bounty
              </button>
            )}

            {currentView !== 'list' && (
              <button
                onClick={() => { setCurrentView('list'); setSelected(null); setError('') }}
                style={{
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  borderRadius: '12px',
                  padding: '10px 18px',
                  fontSize: '13px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <MdArrowBack size={18} /> Back to Bounties
              </button>
            )}
          </div>

          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--red)',
              borderRadius: '12px',
              padding: '12px 16px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: 'var(--red)',
              fontSize: '13px',
              fontWeight: 600,
            }}>
              <MdErrorOutline size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* VIEW: BOUNTY LIST & TABS */}
          {currentView === 'list' && (
            <div>
              {/* Navigation Tabs */}
              <div style={{
                display: 'flex',
                gap: '8px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '6px',
                marginBottom: '24px',
                overflowX: 'auto',
              }}>
                {(['featured', 'active', 'my_bounties', 'my_submissions', 'completed'] as BountyTab[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      flex: 1,
                      minWidth: '120px',
                      padding: '10px 16px',
                      borderRadius: '12px',
                      border: 'none',
                      background: activeTab === tab ? 'var(--accent)' : 'transparent',
                      color: activeTab === tab ? '#fff' : 'var(--text-secondary)',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tab === 'featured' && 'Featured'}
                    {tab === 'active' && 'Active Bounties'}
                    {tab === 'my_bounties' && 'My Bounties'}
                    {tab === 'my_submissions' && 'My Submissions'}
                    {tab === 'completed' && 'Completed'}
                  </button>
                ))}
              </div>

              {/* Bounties Grid */}
              {filteredBounties.length === 0 ? (
                <div style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '24px',
                  padding: '60px 24px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏆</div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    No Bounties Found in this Tab
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '400px', margin: '0 auto 20px auto' }}>
                    Be the first to create an on-chain escrow bounty on Arc Mainnet!
                  </p>
                  <button
                    onClick={() => setCurrentView('create')}
                    style={{
                      background: 'var(--accent)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '10px 20px',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    + Create Bounty
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                  {filteredBounties.map(b => {
                    const isFunded = b.escrowStatus === 'FUNDED' || !!b.fundTxHash
                    const isPaid = b.status === 'COMPLETED'
                    return (
                      <div
                        key={b.id}
                        onClick={() => { setSelected(b); setCurrentView('detail') }}
                        style={{
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: '20px',
                          padding: '24px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)',
                        }}
                        onMouseOver={e => {
                          e.currentTarget.style.borderColor = 'var(--accent)'
                          e.currentTarget.style.transform = 'translateY(-2px)'
                        }}
                        onMouseOut={e => {
                          e.currentTarget.style.borderColor = 'var(--border)'
                          e.currentTarget.style.transform = 'translateY(0)'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                            <span style={{
                              background: 'var(--surface-raised)',
                              border: '1px solid var(--border)',
                              color: 'var(--text-secondary)',
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '4px 10px',
                              borderRadius: '8px',
                            }}>
                              {b.category || 'General'}
                            </span>
                            <span style={{
                              background: isPaid ? 'rgba(16, 185, 129, 0.1)' : isFunded ? 'rgba(16, 53, 246, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                              color: isPaid ? 'var(--green)' : isFunded ? 'var(--accent)' : '#f59e0b',
                              fontSize: '11px',
                              fontWeight: 800,
                              padding: '4px 10px',
                              borderRadius: '10px',
                            }}>
                              {isPaid ? 'Reward Paid' : isFunded ? 'Escrowed on Arc' : 'Draft / Unfunded'}
                            </span>
                          </div>

                          <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px', lineHeight: 1.3 }}>
                            {b.title}
                          </h3>

                          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.5, marginBottom: '20px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {b.description || 'No description provided.'}
                          </p>
                        </div>

                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', fontWeight: 600 }}>REWARD</span>
                            <span style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)' }}>
                              {parseFloat(b.prizeAmount).toFixed(0)} <span style={{ fontSize: '13px', color: 'var(--accent)' }}>USDC</span>
                            </span>
                          </div>

                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                            {b.submissions?.length || 0} Submissions
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* VIEW: CREATE BOUNTY */}
          {currentView === 'create' && (
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '24px',
              padding: '32px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
            }}>
              <h2 style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Create New Bounty
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '28px' }}>
                Define task requirements, checklist, and lock USDC into on-chain escrow.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Bounty Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Build an Arc Mainnet Payment Widget"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--surface-raised)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Reward (USDC)
                  </label>
                  <input
                    type="number"
                    placeholder="120"
                    value={prizeAmount}
                    onChange={e => setPrizeAmount(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--surface-raised)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>
                  Description
                </label>
                <textarea
                  rows={4}
                  placeholder="Explain what contributors need to accomplish..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--surface-raised)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '14px 16px',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* Tasks Builder */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>
                  Deliverables & Tasks
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                  {tasks.map((task, idx) => (
                    <div key={task.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-raised)', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{idx + 1}. {task.text}</span>
                      <button onClick={() => removeTask(task.id)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '13px' }}>✕</button>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Add task item..."
                    value={newTaskInput}
                    onChange={e => setNewTaskInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addTask() }}
                    style={{
                      flex: 1,
                      background: 'var(--surface-raised)',
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                  <button onClick={addTask} style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 16px', color: 'var(--text-primary)', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                    + Add Task
                  </button>
                </div>
              </div>

              {/* Parameters: Category & Deadline */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--surface-raised)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      outline: 'none',
                    }}
                  >
                    <option value="Development">Development</option>
                    <option value="Design">Design</option>
                    <option value="Writing">Writing</option>
                    <option value="Security">Security</option>
                    <option value="Marketing">Marketing</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Difficulty
                  </label>
                  <select
                    value={difficulty}
                    onChange={e => setDifficulty(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--surface-raised)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      outline: 'none',
                    }}
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Deadline
                  </label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={e => setDeadline(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--surface-raised)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Pre-Publish Escrow Summary Card (Required by Section 18) */}
              <div style={{
                background: 'rgba(16, 53, 246, 0.05)',
                border: '1px solid var(--border-accent)',
                borderRadius: '16px',
                padding: '20px',
                marginBottom: '24px',
              }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                  Escrow Funding Summary
                </span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Reward:</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{prizeAmount || '0'} USDC</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Escrow Deposit:</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{prizeAmount || '0'} USDC</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Escrow Network:</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 800 }}>{ACTIVE_CHAIN.name}</span>
                </div>
              </div>

              <button
                disabled={loading}
                onClick={handleCreateBounty}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #1035f6, #3b82f6)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '16px',
                  fontSize: '15px',
                  fontWeight: 800,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 16px rgba(16, 53, 246, 0.25)',
                }}
              >
                {loading ? 'Creating Bounty...' : 'Publish Bounty & Fund Escrow'}
              </button>
            </div>
          )}

          {/* VIEW: BOUNTY DETAIL PAGE */}
          {currentView === 'detail' && selected && (
            <div>
              {/* Header Card */}
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '24px',
                padding: '32px',
                marginBottom: '20px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        {selected.category || 'General'}
                      </span>
                      <span style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        {selected.difficulty || 'Medium'}
                      </span>
                      <span style={{
                        background: isCompleted ? 'rgba(16, 185, 129, 0.1)' : isCancelled ? 'rgba(239, 68, 68, 0.1)' : isEscrowFunded ? 'rgba(16, 53, 246, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                        color: isCompleted ? 'var(--green)' : isCancelled ? 'var(--red)' : isEscrowFunded ? 'var(--accent)' : '#f59e0b',
                        padding: '4px 10px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 800,
                      }}>
                        {isCompleted ? 'Reward Paid' : isCancelled ? 'Cancelled & Refunded' : isEscrowFunded ? 'Escrowed on Arc' : 'Unfunded Draft'}
                      </span>
                    </div>

                    <h1 style={{ fontSize: '26px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '8px' }}>
                      {selected.title}
                    </h1>

                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MdPerson size={16} /> Created by <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{selected.creatorAddress}</span>
                    </p>
                  </div>

                  {/* Reward Card */}
                  <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px 24px', textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>
                      Prize Reward
                    </span>
                    <span style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)' }}>
                      {parseFloat(selected.prizeAmount).toFixed(0)} <span style={{ fontSize: '16px', color: 'var(--accent)' }}>USDC</span>
                    </span>
                    <span style={{ fontSize: '11px', color: isEscrowFunded ? 'var(--green)' : '#f59e0b', display: 'block', fontWeight: 700, marginTop: '2px' }}>
                      {isEscrowFunded ? '✓ Escrow Secured on Arc' : '⚠️ Awaiting Escrow Deposit'}
                    </span>
                  </div>
                </div>

                {/* Creator Actions: Fund / Cancel */}
                {isCreator && !isCompleted && !isCancelled && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {!isEscrowFunded && (
                      <button
                        onClick={handleFundBounty}
                        disabled={fundPhase !== 'idle'}
                        style={{
                          background: 'linear-gradient(135deg, #1035f6, #3b82f6)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '12px',
                          padding: '12px 24px',
                          fontWeight: 800,
                          fontSize: '14px',
                          cursor: fundPhase !== 'idle' ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {fundPhase === 'approving' ? '1/2 Approving USDC...' :
                         fundPhase === 'depositing' ? '2/2 Depositing into Escrow...' :
                         fundPhase === 'confirming' ? 'Confirming on Arc Mainnet...' :
                         `Deposit ${selected.prizeAmount} USDC to Escrow`}
                      </button>
                    )}

                    {isEscrowFunded && (
                      <button
                        onClick={handleCancelBounty}
                        disabled={cancelPhase !== 'idle'}
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          color: 'var(--red)',
                          border: '1px solid var(--red)',
                          borderRadius: '12px',
                          padding: '10px 20px',
                          fontWeight: 700,
                          fontSize: '13px',
                          cursor: cancelPhase !== 'idle' ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {cancelPhase !== 'idle' ? 'Cancelling & Refunding...' : 'Cancel Bounty & Refund Escrow'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Payout Details if Completed */}
              {isCompleted && (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid var(--green)',
                  borderRadius: '20px',
                  padding: '24px',
                  marginBottom: '20px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <MdCheckCircle size={20} color="var(--green)" />
                    <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--green)' }}>Reward Paid & Finalized</span>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '12px' }}>
                    Winner: <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)', fontWeight: 700 }}>{selected.winnerAddress}</span>
                  </p>
                  {selected.rewardTxHash && (
                    <a
                      href={`${EXPLORER_URL}/tx/${selected.rewardTxHash}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      View Escrow Payout Transaction on ArcScan ↗
                    </a>
                  )}
                </div>
              )}

              {/* Tasks & Requirements */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px', padding: '24px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MdChecklist size={18} color="var(--accent)" /> Deliverables & Tasks
                  </h3>
                  {selected.tasks ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {(typeof selected.tasks === 'string' ? JSON.parse(selected.tasks || '[]') : selected.tasks).map((t: string, i: number) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                          <span style={{ color: 'var(--accent)', fontWeight: 800 }}>•</span>
                          <span>{t}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No checklist specified.</p>
                  )}
                </div>

                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px', padding: '24px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MdSecurity size={18} color="var(--accent)" /> Submission Requirements
                  </h3>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                    {selected.requirements || 'Standard terms: Original work, verifiable demo, and correct recipient address.'}
                  </div>
                </div>
              </div>

              {/* Submissions Section */}
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '24px',
                padding: '32px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
              }}>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px' }}>
                  Submissions ({selected.submissions?.length || 0})
                </h3>

                {/* Submit Form (for non-creators) */}
                {!isCreator && !isCompleted && !isCancelled && isEscrowFunded && (
                  <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>
                      Submit Your Work
                    </h4>
                    <textarea
                      rows={3}
                      placeholder="Describe what you completed, summary, etc..."
                      value={submitContent}
                      onChange={e => setSubmitContent(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: '10px',
                        padding: '12px',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        outline: 'none',
                        marginBottom: '10px',
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Proof Links (GitHub PR, Figma, Live demo URL...)"
                      value={submitLinks}
                      onChange={e => setSubmitLinks(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: '10px',
                        padding: '12px',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        outline: 'none',
                        marginBottom: '12px',
                      }}
                    />
                    <button
                      disabled={submitting || !submitContent.trim()}
                      onClick={handleSubmitWork}
                      style={{
                        background: 'var(--accent)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '10px 20px',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: submitting ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {submitting ? 'Submitting...' : 'Submit Proof'}
                    </button>
                  </div>
                )}

                {/* Submissions List */}
                {(!selected.submissions || selected.submissions.length === 0) ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No submissions yet for this bounty.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {selected.submissions.map((sub: any) => {
                      const isSubWinner = sub.status === 'WINNER'
                      return (
                        <div
                          key={sub.id}
                          style={{
                            background: isSubWinner ? 'rgba(16, 185, 129, 0.05)' : 'var(--surface-raised)',
                            border: `1px solid ${isSubWinner ? 'var(--green)' : 'var(--border)'}`,
                            borderRadius: '16px',
                            padding: '16px 20px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '12px',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <span style={{ fontSize: '13px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {sub.submitterAddress}
                              </span>
                              <span style={{
                                background: isSubWinner ? 'var(--green)' : 'var(--surface)',
                                color: isSubWinner ? '#fff' : 'var(--text-secondary)',
                                fontSize: '10px',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: '6px',
                              }}>
                                {sub.status}
                              </span>
                            </div>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                              {sub.content}
                            </p>
                            {sub.links && (
                              <a
                                href={sub.links.startsWith('http') ? sub.links : `https://${sub.links}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}
                              >
                                View Proof Link ↗
                              </a>
                            )}
                          </div>

                          {/* Winner Selection Button for Creator */}
                          {isCreator && !isCompleted && !isCancelled && isEscrowFunded && (
                            <button
                              disabled={payPhase !== 'idle'}
                              onClick={() => handleSelectWinner(sub.id, sub.submitterAddress)}
                              style={{
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '10px',
                                padding: '8px 16px',
                                fontSize: '12px',
                                fontWeight: 800,
                                cursor: payPhase !== 'idle' ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {selectingWinner === sub.id && payPhase === 'releasing' ? 'Releasing Escrow...' :
                               selectingWinner === sub.id && payPhase === 'confirming' ? 'Confirming on Arc...' :
                               'Select Winner & Release Prize'}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </NetworkGuard>
      </main>
    </PageLayout>
  )
}
