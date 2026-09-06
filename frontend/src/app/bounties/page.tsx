'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAccount, useWriteContract } from 'wagmi'
import { parseUnits } from 'viem'
import { MdEmojiEvents, MdAdd, MdCheckCircle, MdAccessTime, MdSend, MdErrorOutline } from 'react-icons/md'
import { PageLayout } from '@/components/PageLayout'
import { NetworkGuard } from '@/components/NetworkGuard'
import { ROUTER_ABI, USDC_ABI } from '@/lib/abi'
import { ROUTER_ADDRESS, USDC_ADDRESS } from '@/lib/constants'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || ''
const EXPLORER_URL = 'https://testnet.arcscan.app'

export default function BountiesPage() {
  const { address } = useAccount()
  const [tab, setTab] = useState<'browse' | 'create' | 'detail'>('browse')
  const [bounties, setBounties] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [prizeAmount, setPrizeAmount] = useState('')
  const [submitContent, setSubmitContent] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [funding, setFunding] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectingWinner, setSelectingWinner] = useState<string | null>(null)

  const { writeContractAsync } = useWriteContract()

  const fetchBounties = useCallback(async () => {
    let list: any[] = []
    try {
      const res = await fetch(`${BACKEND_URL}/api/bounties`)
      if (res.ok) list = await res.json()
    } catch {}

    // Load local offline bounties if any
    try {
      const local = localStorage.getItem('easyzpay_local_bounties')
      if (local) {
        const localList = JSON.parse(local)
        for (const item of localList) {
          if (!list.some(b => b.id === item.id)) {
            list.unshift(item)
          }
        }
      }
    } catch {}

    setBounties(list)
  }, [])

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

  useEffect(() => { fetchBounties() }, [fetchBounties])

  const createBounty = async () => {
    if (!address || !title || !prizeAmount) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${BACKEND_URL}/api/bounties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, creatorAddress: address, prizeAmount }),
      })
      if (res.ok) {
        const b = await res.json()
        setSelected(b)
        setTab('detail')
        setTitle('')
        setDescription('')
        setPrizeAmount('')
        await fetchBounties()
        setLoading(false)
        return
      }
    } catch {}

    // Fallback: save to local bounties
    try {
      const newB = {
        id: `bounty_local_${Date.now()}`,
        title,
        description: description || '',
        creatorAddress: address.toLowerCase(),
        prizeAmount,
        token: 'USDC',
        chainId: 5042002,
        status: 'OPEN',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        submissions: [],
      }
      const existing = JSON.parse(localStorage.getItem('easyzpay_local_bounties') || '[]')
      existing.unshift(newB)
      localStorage.setItem('easyzpay_local_bounties', JSON.stringify(existing))
      setSelected(newB)
      setTab('detail')
      setTitle('')
      setDescription('')
      setPrizeAmount('')
      await fetchBounties()
    } catch (e: any) {
      setError('Could not save bounty. Please check inputs.')
    }
    setLoading(false)
  }

  const fundBounty = async () => {
    if (!selected || !address) return
    setFunding(true)
    try {
      const amountWei = parseUnits(selected.prizeAmount, 6)
      const approveHash = await writeContractAsync({ address: USDC_ADDRESS as `0x${string}`, abi: USDC_ABI, functionName: 'approve', args: [ROUTER_ADDRESS, amountWei] })
      const txHash = await writeContractAsync({ address: ROUTER_ADDRESS as `0x${string}`, abi: ROUTER_ABI, functionName: 'sendPayment', args: [ROUTER_ADDRESS, amountWei, `Bounty: ${selected.title}`] })
      await fetch(`${BACKEND_URL}/api/bounties/${selected.id}/fund`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ txHash }) })
      await fetchBounty(selected.id)
    } catch (e: any) { setError(e.message || 'Funding failed') }
    setFunding(false)
  }

  const submitToBounty = async () => {
    if (!selected || !address || !submitContent) return
    setSubmitting(true)
    try {
      await fetch(`${BACKEND_URL}/api/bounties/${selected.id}/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ submitterAddress: address, content: submitContent }) })
      setSubmitContent('')
      await fetchBounty(selected.id)
    } catch { setError('Failed to submit') }
    setSubmitting(false)
  }

  const selectWinner = async (submissionId: string, submitterAddress: string) => {
    if (!selected || !address) return
    setSelectingWinner(submissionId)
    try {
      const amountWei = parseUnits(selected.prizeAmount, 6)
      const approveHash = await writeContractAsync({ address: USDC_ADDRESS as `0x${string}`, abi: USDC_ABI, functionName: 'approve', args: [ROUTER_ADDRESS, amountWei] })
      const txHash = await writeContractAsync({ address: ROUTER_ADDRESS as `0x${string}`, abi: ROUTER_ABI, functionName: 'sendPayment', args: [submitterAddress as `0x${string}`, amountWei, `Bounty Winner: ${selected.title}`] })
      await fetch(`${BACKEND_URL}/api/bounties/${selected.id}/select-winner`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ submissionId, rewardAmount: selected.prizeAmount, rewardTxHash: txHash }) })
      await fetchBounty(selected.id)
      await fetchBounties()
    } catch (e: any) { setError(e.message || 'Failed to select winner') }
    setSelectingWinner(null)
  }

  const cardStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '24px', padding: '28px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', marginBottom: '16px' }
  const inputStyle = { width: '100%', background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px', color: 'var(--text-primary)', fontSize: '15px', outline: 'none', boxSizing: 'border-box' as const }
  const labelStyle = { color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, display: 'block', marginBottom: '8px' }
  const btnPrimary = { background: 'linear-gradient(135deg, #1035f6, #3b82f6)', border: 'none', borderRadius: '12px', padding: '14px', color: 'white', fontSize: '15px', fontWeight: 800, cursor: 'pointer', width: '100%' }

  const statusColor = (s: string) => s === 'COMPLETED' ? 'var(--green)' : s === 'OPEN' ? 'var(--accent)' : '#f59e0b'

  return (
    <PageLayout>
      <main style={{ maxWidth: '560px', margin: '0 auto', padding: '80px 16px 120px' }}>
        <NetworkGuard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)' }}><MdEmojiEvents style={{ verticalAlign: 'middle', marginRight: '8px' }} />Bounties</h1>
            {tab === 'browse' && <button onClick={() => setTab('create')} style={{ ...btnPrimary, width: 'auto', padding: '10px 20px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}><MdAdd size={16} /> Create</button>}
          </div>

          {error && <div style={{ background: 'rgba(255,0,0,0.08)', border: '1px solid rgba(255,0,0,0.2)', borderRadius: '12px', padding: '12px', marginBottom: '16px' }}><p style={{ color: 'var(--red)', fontSize: '13px', fontWeight: 600, margin: 0 }}><MdErrorOutline size={14} style={{ verticalAlign: 'middle' }} /> {error}</p></div>}

          {tab === 'browse' && (
            <div>
              {bounties.length === 0 ? (
                <div style={cardStyle}><p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '14px' }}>No bounties yet. Create one to reward contributors!</p></div>
              ) : bounties.map((b: any) => (
                <div key={b.id} style={{ ...cardStyle, cursor: 'pointer' }} onClick={() => { setSelected(b); setTab('detail') }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>{b.title}</h3>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 4px' }}>{b.description?.slice(0, 80) || 'No description'}</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>{b.submissions?.length || 0} submissions</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '18px', fontWeight: 900, color: 'var(--accent)', margin: '0 0 4px' }}>{b.prizeAmount} USDC</p>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '8px', background: `${statusColor(b.status)}20`, color: statusColor(b.status) }}>{b.status}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'create' && (
            <div style={cardStyle}>
              <div style={{ marginBottom: '16px' }}><label style={labelStyle}>Bounty Title</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Best meme design for EasyZPay" style={inputStyle} /></div>
              <div style={{ marginBottom: '16px' }}><label style={labelStyle}>Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the bounty requirements..." style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }} /></div>
              <div style={{ marginBottom: '24px' }}><label style={labelStyle}>Prize Amount (USDC)</label><input type="number" value={prizeAmount} onChange={e => setPrizeAmount(e.target.value)} placeholder="50.00" style={inputStyle} /></div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setTab('browse')} style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', color: 'var(--text-primary)', fontWeight: 800, cursor: 'pointer' }}>Cancel</button>
                <button onClick={createBounty} disabled={loading || !title || !prizeAmount} style={{ ...btnPrimary, flex: 1, opacity: loading || !title || !prizeAmount ? 0.5 : 1 }}>{loading ? 'Creating...' : 'Create Bounty'}</button>
              </div>
            </div>
          )}

          {tab === 'detail' && selected && (
            <div>
              <button onClick={() => { setTab('browse'); setSelected(null) }} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', marginBottom: '16px' }}>← Back to Bounties</button>
              <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>{selected.title}</h2>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>{selected.description || 'No description'}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '24px', fontWeight: 900, color: 'var(--accent)', margin: '0 0 4px' }}>{selected.prizeAmount} USDC</p>
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '8px', background: `${statusColor(selected.status)}20`, color: statusColor(selected.status) }}>{selected.status}</span>
                  </div>
                </div>

                {selected.fundTxHash && (
                  <a href={`${EXPLORER_URL}/tx/${selected.fundTxHash}`} target="_blank" rel="noreferrer" style={{ display: 'block', color: 'var(--green)', fontSize: '12px', fontWeight: 700, marginBottom: '16px', textDecoration: 'none' }}><MdCheckCircle size={14} style={{ verticalAlign: 'middle' }} /> Funded — View on ArcScan ↗</a>
                )}

                {!selected.fundTxHash && address?.toLowerCase() === selected.creatorAddress && (
                  <button onClick={fundBounty} disabled={funding} style={{ ...btnPrimary, marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    {funding ? <><MdAccessTime size={16} /> Funding...</> : <><MdSend size={16} /> Fund Bounty ({selected.prizeAmount} USDC)</>}
                  </button>
                )}

                <h3 style={{ ...labelStyle, marginTop: '24px' }}>Submissions ({selected.submissions?.length || 0})</h3>
                {selected.submissions?.map((s: any) => (
                  <div key={s.id} style={{ padding: '14px', background: 'var(--surface-raised)', borderRadius: '12px', marginBottom: '8px', border: s.status === 'WINNER' ? '2px solid var(--green)' : '1px solid var(--border)' }}>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace', margin: '0 0 6px' }}>{s.submitterAddress.slice(0, 10)}...{s.submitterAddress.slice(-6)}</p>
                    <p style={{ fontSize: '14px', color: 'var(--text-primary)', margin: '0 0 8px', whiteSpace: 'pre-wrap' }}>{s.content}</p>
                    {s.status === 'WINNER' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MdCheckCircle size={16} style={{ color: 'var(--green)' }} />
                        <span style={{ color: 'var(--green)', fontSize: '12px', fontWeight: 700 }}>Winner — {s.rewardAmount} USDC</span>
                        {s.rewardTxHash && <a href={`${EXPLORER_URL}/tx/${s.rewardTxHash}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: 700, textDecoration: 'none' }}>ArcScan ↗</a>}
                      </div>
                    ) : address?.toLowerCase() === selected.creatorAddress && selected.status !== 'COMPLETED' ? (
                      <button onClick={() => selectWinner(s.id, s.submitterAddress)} disabled={selectingWinner === s.id} style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '8px 14px', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                        {selectingWinner === s.id ? 'Sending reward...' : 'Select as Winner & Pay'}
                      </button>
                    ) : <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{s.status}</span>}
                  </div>
                ))}

                {selected.status === 'OPEN' && address?.toLowerCase() !== selected.creatorAddress && (
                  <div style={{ marginTop: '20px' }}>
                    <h3 style={labelStyle}>Submit Your Work</h3>
                    <textarea value={submitContent} onChange={e => setSubmitContent(e.target.value)} placeholder="Describe your submission or paste a link..." style={{ ...inputStyle, minHeight: '80px', resize: 'vertical', marginBottom: '12px' }} />
                    <button onClick={submitToBounty} disabled={submitting || !submitContent} style={{ ...btnPrimary, opacity: submitting || !submitContent ? 0.5 : 1 }}>{submitting ? 'Submitting...' : 'Submit'}</button>
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
