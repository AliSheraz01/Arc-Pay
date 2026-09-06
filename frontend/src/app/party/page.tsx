'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSendTransaction } from 'wagmi'
import { parseUnits, parseEther, isAddress, createPublicClient, http } from 'viem'
import Link from 'next/link'
import { MdGroup, MdAdd, MdCheckCircle, MdErrorOutline, MdAccessTime, MdSend } from 'react-icons/md'
import { PageLayout } from '@/components/PageLayout'
import { NetworkGuard } from '@/components/NetworkGuard'
import { ROUTER_ABI, USDC_ABI, REGISTRY_ABI } from '@/lib/abi'
import { ROUTER_ADDRESS, USDC_ADDRESS, REGISTRY_ADDRESS, arcTestnet } from '@/lib/constants'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || ''
const EXPLORER_URL = 'https://testnet.arcscan.app'

type Participant = { identifier: string; resolvedAddress: string | null; amount: string; displayName: string | null }

export default function PartyPage() {
  const { address } = useAccount()
  const [step, setStep] = useState<'list' | 'create' | 'view'>('list')
  const [parties, setParties] = useState<any[]>([])
  const [selectedParty, setSelectedParty] = useState<any>(null)
  const [name, setName] = useState('')
  const [splitType, setSplitType] = useState('equal')
  const [totalAmount, setTotalAmount] = useState('')
  const [participantInput, setParticipantInput] = useState('')
  const [participants, setParticipants] = useState<Participant[]>([])
  const [resolving, setResolving] = useState(false)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [payingId, setPayingId] = useState<string | null>(null)

  const { writeContractAsync } = useWriteContract()
  const { sendTransactionAsync } = useSendTransaction()

  const fetchParties = useCallback(async () => {
    let list: any[] = []
    if (address) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/party/user/${address}`)
        if (res.ok) list = await res.json()
      } catch {}
    }

    try {
      const local = localStorage.getItem('easyzpay_local_parties')
      if (local) {
        const localList = JSON.parse(local)
        for (const lp of localList) {
          if (!list.some(p => p.id === lp.id)) {
            list.unshift(lp)
          }
        }
      }
    } catch {}

    setParties(list)
  }, [address])

  useEffect(() => { fetchParties() }, [fetchParties])

  const addParticipant = async () => {
    if (!participantInput.trim()) return
    setResolving(true)
    setError('')
    const id = participantInput.trim()

    // 1. Direct address check
    if (isAddress(id)) {
      const addr = id as string
      if (participants.some(p => p.resolvedAddress?.toLowerCase() === addr.toLowerCase())) {
        setError('Participant already added')
        setResolving(false)
        return
      }
      const amt = splitType === 'equal' && totalAmount ? (parseFloat(totalAmount) / (participants.length + 1)).toFixed(2) : ''
      setParticipants(prev => [...prev, { identifier: id, resolvedAddress: addr, amount: amt, displayName: `${addr.slice(0, 6)}…${addr.slice(-4)}` }])
      setParticipantInput('')
      setResolving(false)
      return
    }

    let resolvedAddr: string | null = null
    let resolvedDisplay: string | null = null

    // 2. Try API canonical resolver
    try {
      const prefix = id.startsWith('0x') ? '' : id.includes('@') ? '' : '@'
      const res = await fetch(`${BACKEND_URL}/api/resolve/${encodeURIComponent(prefix + id)}`)
      if (res.ok) {
        const data = await res.json()
        if (data.walletAddress && isAddress(data.walletAddress)) {
          resolvedAddr = data.walletAddress
          resolvedDisplay = data.displayName || data.username || id
        }
      }
    } catch {}

    // 3. Try direct on-chain resolution via Arc Testnet
    if (!resolvedAddr) {
      try {
        const cleanName = id.replace('@', '').toLowerCase()
        const client = createPublicClient({
          chain: arcTestnet,
          transport: http('https://rpc.testnet.arc.network'),
        })
        const onChain = await client.readContract({
          address: REGISTRY_ADDRESS,
          abi: REGISTRY_ABI,
          functionName: 'resolveUsername',
          args: [cleanName],
        }) as string
        if (onChain && onChain !== '0x0000000000000000000000000000000000000000' && isAddress(onChain)) {
          resolvedAddr = onChain
          resolvedDisplay = `@${cleanName}`
        }
      } catch {}
    }

    // 4. Try localStorage X accounts
    if (!resolvedAddr) {
      try {
        const handle = id.replace('x:', '').replace('@', '').toLowerCase()
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && key.startsWith('easyzpay_x_')) {
            const acc = JSON.parse(localStorage.getItem(key) || '{}')
            if (acc.username?.toLowerCase() === handle) {
              const cachedAddr = key.replace('easyzpay_x_', '')
              if (isAddress(cachedAddr)) {
                resolvedAddr = cachedAddr
                resolvedDisplay = acc.displayName || `@${handle}`
                break
              }
            }
          }
        }
      } catch {}
    }

    if (resolvedAddr) {
      if (participants.some(p => p.resolvedAddress?.toLowerCase() === resolvedAddr?.toLowerCase())) {
        setError('Participant already added')
      } else {
        const amt = splitType === 'equal' && totalAmount ? (parseFloat(totalAmount) / (participants.length + 1)).toFixed(2) : ''
        setParticipants(prev => [...prev, { identifier: id, resolvedAddress: resolvedAddr, amount: amt, displayName: resolvedDisplay || id }])
        setParticipantInput('')
        if (splitType === 'equal' && totalAmount) {
          const perPerson = (parseFloat(totalAmount) / (participants.length + 1)).toFixed(2)
          setParticipants(prev => prev.map(p => ({ ...p, amount: perPerson })))
        }
      }
    } else {
      setError(`Could not find wallet for "${id}"`)
    }
    setResolving(false)
  }

  useEffect(() => {
    if (splitType === 'equal' && totalAmount && participants.length > 0) {
      const perPerson = (parseFloat(totalAmount) / participants.length).toFixed(2)
      setParticipants(prev => prev.map(p => ({ ...p, amount: perPerson })))
    }
  }, [totalAmount, splitType])

  const createParty = async () => {
    if (!address || !name || !totalAmount || participants.length === 0) return
    setCreating(true)
    setError('')
    try {
      const res = await fetch(`${BACKEND_URL}/api/party`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          creatorAddress: address,
          splitType,
          totalAmount,
          participants: participants.map(p => ({ identifier: p.identifier, resolvedAddress: p.resolvedAddress, amount: p.amount })),
        }),
      })
      if (res.ok) {
        await fetchParties()
        setStep('list')
        setName('')
        setTotalAmount('')
        setParticipants([])
        setCreating(false)
        return
      }
    } catch {}

    // Fallback: save to localStorage
    try {
      const newParty = {
        id: `party_local_${Date.now()}`,
        name,
        creatorAddress: address.toLowerCase(),
        splitType,
        totalAmount,
        token: 'USDC',
        chainId: 5042002,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        participants: participants.map((p, idx) => ({
          id: `pp_loc_${idx}_${Date.now()}`,
          identifier: p.identifier,
          resolvedAddress: p.resolvedAddress,
          amount: p.amount,
          status: 'PENDING',
        })),
      }
      const existing = JSON.parse(localStorage.getItem('easyzpay_local_parties') || '[]')
      existing.unshift(newParty)
      localStorage.setItem('easyzpay_local_parties', JSON.stringify(existing))
      await fetchParties()
      setStep('list')
      setName('')
      setTotalAmount('')
      setParticipants([])
    } catch {
      setError('Could not create party. Please check inputs.')
    }
    setCreating(false)
  }

  const payParticipant = async (party: any, participant: any) => {
    if (!address || !participant.resolvedAddress) return
    setPayingId(participant.id)
    setError('')
    try {
      const amountWei = parseUnits(participant.amount, 6)
      let sendHash: `0x${string}` | undefined

      // 1. Try Payment Router
      try {
        await writeContractAsync({ address: USDC_ADDRESS as `0x${string}`, abi: USDC_ABI, functionName: 'approve', args: [ROUTER_ADDRESS, amountWei] })
        sendHash = await writeContractAsync({ address: ROUTER_ADDRESS as `0x${string}`, abi: ROUTER_ABI, functionName: 'sendPayment', args: [participant.resolvedAddress as `0x${string}`, amountWei, `Party: ${party.name}`] })
      } catch (routerErr) {
        console.warn('[Party] Router payment failed, falling back to direct transfer:', routerErr)
      }

      // 2. Direct transfer fallback
      if (!sendHash) {
        try {
          sendHash = await writeContractAsync({
            address: USDC_ADDRESS as `0x${string}`,
            abi: USDC_ABI,
            functionName: 'transfer',
            args: [participant.resolvedAddress as `0x${string}`, amountWei],
          })
        } catch (ercErr) {
          sendHash = await sendTransactionAsync({
            to: participant.resolvedAddress as `0x${string}`,
            value: parseEther(participant.amount),
          })
        }
      }

      if (sendHash) {
        await fetch(`${BACKEND_URL}/api/party/${party.id}/pay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ participantId: participant.id, txHash: sendHash }),
        })
        await fetchParties()
        if (selectedParty) {
          const r = await fetch(`${BACKEND_URL}/api/party/${party.id}`)
          if (r.ok) setSelectedParty(await r.json())
        }
      }
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || 'Payment failed')
    }
    setPayingId(null)
  }

  const cardStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '24px', padding: '28px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', marginBottom: '16px' }
  const inputStyle = { width: '100%', background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px', color: 'var(--text-primary)', fontSize: '15px', outline: 'none', boxSizing: 'border-box' as const }
  const labelStyle = { color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, display: 'block', marginBottom: '8px' }
  const btnPrimary = { background: 'linear-gradient(135deg, #1035f6, #3b82f6)', border: 'none', borderRadius: '12px', padding: '14px', color: 'white', fontSize: '15px', fontWeight: 800, cursor: 'pointer', width: '100%' }

  return (
    <PageLayout>
      <main style={{ maxWidth: '560px', margin: '0 auto', padding: '80px 16px 120px' }}>
        <NetworkGuard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)' }}><MdGroup style={{ verticalAlign: 'middle', marginRight: '8px' }} />Party Pay</h1>
            {step === 'list' && <button onClick={() => setStep('create')} style={{ ...btnPrimary, width: 'auto', padding: '10px 20px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}><MdAdd size={16} /> New Party</button>}
          </div>

          {error && <div style={{ background: 'rgba(255,0,0,0.08)', border: '1px solid rgba(255,0,0,0.2)', borderRadius: '12px', padding: '12px', marginBottom: '16px' }}><p style={{ color: 'var(--red)', fontSize: '13px', fontWeight: 600, margin: 0 }}><MdErrorOutline size={14} style={{ verticalAlign: 'middle' }} /> {error}</p></div>}

          {step === 'list' && (
            <div>
              {parties.length === 0 ? (
                <div style={cardStyle}><p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '14px' }}>No parties yet. Create one to split payments with friends!</p></div>
              ) : parties.map((p: any) => (
                <div key={p.id} style={{ ...cardStyle, cursor: 'pointer' }} onClick={() => { setSelectedParty(p); setStep('view') }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>{p.name}</h3>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>{p.participants?.length || 0} participants · {p.totalAmount} USDC</p>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '8px', background: p.status === 'COMPLETED' ? 'rgba(0,212,168,0.1)' : 'var(--accent-glow)', color: p.status === 'COMPLETED' ? 'var(--green)' : 'var(--accent)' }}>{p.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 'create' && (
            <div style={cardStyle}>
              <div style={{ marginBottom: '16px' }}><label style={labelStyle}>Party Name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Friday Dinner Split" style={inputStyle} /></div>
              <div style={{ marginBottom: '16px' }}><label style={labelStyle}>Total Amount (USDC)</label><input type="number" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} placeholder="100.00" style={inputStyle} /></div>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Split Type</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {['equal', 'custom'].map(t => (
                    <button key={t} onClick={() => setSplitType(t)} style={{ flex: 1, padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, background: splitType === t ? 'var(--accent)' : 'var(--surface-raised)', color: splitType === t ? '#fff' : 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}>{t === 'equal' ? 'Equal Split' : 'Custom Amounts'}</button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Add Participant</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input value={participantInput} onChange={e => setParticipantInput(e.target.value)} placeholder="@username, x:handle, or 0x..." style={{ ...inputStyle, flex: 1 }} onKeyDown={e => e.key === 'Enter' && addParticipant()} />
                  <button onClick={addParticipant} disabled={resolving} style={{ ...btnPrimary, width: 'auto', padding: '10px 16px', fontSize: '13px' }}>{resolving ? '...' : 'Add'}</button>
                </div>
              </div>
              {participants.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>Participants ({participants.length})</label>
                  {participants.map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: 'var(--surface-raised)', borderRadius: '10px', marginBottom: '6px' }}>
                      <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>{p.displayName || p.identifier}</span>
                      {splitType === 'custom' ? <input type="number" value={p.amount} onChange={e => { const np = [...participants]; np[i].amount = e.target.value; setParticipants(np) }} style={{ ...inputStyle, width: '100px', padding: '8px' }} placeholder="0.00" /> : <span style={{ fontSize: '13px', color: 'var(--accent)', fontWeight: 700 }}>{p.amount} USDC</span>}
                      <button onClick={() => setParticipants(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '16px' }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => { setStep('list'); setParticipants([]); setName(''); setTotalAmount('') }} style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', color: 'var(--text-primary)', fontWeight: 800, cursor: 'pointer' }}>Cancel</button>
                <button onClick={createParty} disabled={creating || !name || !totalAmount || participants.length === 0} style={{ ...btnPrimary, flex: 1, opacity: creating || !name || !totalAmount || participants.length === 0 ? 0.5 : 1 }}>{creating ? 'Creating...' : 'Create Party'}</button>
              </div>
            </div>
          )}

          {step === 'view' && selectedParty && (
            <div>
              <button onClick={() => { setStep('list'); setSelectedParty(null) }} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', marginBottom: '16px' }}>← Back to Parties</button>
              <div style={cardStyle}>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>{selectedParty.name}</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>{selectedParty.totalAmount} USDC · {selectedParty.splitType} split · <span style={{ color: selectedParty.status === 'COMPLETED' ? 'var(--green)' : 'var(--accent)', fontWeight: 700 }}>{selectedParty.status}</span></p>
                {selectedParty.participants?.map((p: any) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', background: 'var(--surface-raised)', borderRadius: '12px', marginBottom: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2px' }}>{p.identifier}</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace', margin: 0 }}>{p.resolvedAddress?.slice(0, 10)}...{p.resolvedAddress?.slice(-6)}</p>
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--accent)' }}>{p.amount} USDC</span>
                    {p.status === 'PAID' ? (
                      <a href={`${EXPLORER_URL}/tx/${p.txHash}`} target="_blank" rel="noreferrer" style={{ color: 'var(--green)', fontWeight: 700, fontSize: '12px', textDecoration: 'none' }}><MdCheckCircle size={18} /></a>
                    ) : (
                      <button onClick={() => payParticipant(selectedParty, p)} disabled={payingId === p.id} style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '8px 14px', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {payingId === p.id ? <MdAccessTime size={14} /> : <MdSend size={14} />} {payingId === p.id ? '...' : 'Pay'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </NetworkGuard>
      </main>
    </PageLayout>
  )
}
