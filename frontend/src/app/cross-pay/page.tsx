'use client'

import { useState, useCallback } from 'react'
import { PageLayout } from '@/components/PageLayout'
import { MdSend, MdHistory, MdHealing, MdArrowBack, MdSearch, MdErrorOutline, MdCheckCircle } from 'react-icons/md'
import Link from 'next/link'
import { useAccount, useSwitchChain, useChainId, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits, isAddress, createPublicClient, http } from 'viem'
import { CCTP_TOKEN_MESSENGER, getCctpDomain, BACKEND_URL, REGISTRY_ADDRESS, arcTestnet } from '@/lib/constants'
import { REGISTRY_ABI } from '@/lib/abi'

export default function CrossPayPage() {
  const [activeTab, setActiveTab] = useState<'send' | 'history' | 'recovery'>('send')
  const { isConnected } = useAccount()

  if (!isConnected) {
    return (
      <PageLayout>
        <div style={{ maxWidth: '480px', margin: '80px auto', padding: '0 16px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Connect your wallet to use Cross Pay.</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <main style={{ maxWidth: '640px', margin: '0 auto', padding: '0 16px' }}>
        <Link href="/" style={{ color: 'var(--text-muted)', fontSize: '13px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px', fontWeight: 600 }}>
          <MdArrowBack size={20} /> Back to Dashboard
        </Link>

          <div style={{ 
            background: 'var(--surface)', 
            border: '1px solid var(--border)', 
            borderRadius: '24px', 
            padding: '28px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
          }}>
            <h1 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.02em' }}>Cross Pay</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '28px' }}>Send USDC across any supported testnet instantly.</p>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', background: 'var(--surface-raised)', padding: '6px', borderRadius: '16px' }}>
              <button
                onClick={() => setActiveTab('send')}
                style={{
                  flex: 1, padding: '10px', borderRadius: '12px', fontSize: '14px', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  background: activeTab === 'send' ? 'var(--accent)' : 'transparent',
                  color: activeTab === 'send' ? '#fff' : 'var(--text-secondary)',
                  border: 'none', cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                <MdSend size={18} /> Send
              </button>
              <button
                onClick={() => setActiveTab('history')}
                style={{
                  flex: 1, padding: '10px', borderRadius: '12px', fontSize: '14px', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  background: activeTab === 'history' ? 'var(--accent)' : 'transparent',
                  color: activeTab === 'history' ? '#fff' : 'var(--text-secondary)',
                  border: 'none', cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                <MdHistory size={18} /> History
              </button>
              <button
                onClick={() => setActiveTab('recovery')}
                style={{
                  flex: 1, padding: '10px', borderRadius: '12px', fontSize: '14px', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  background: activeTab === 'recovery' ? 'var(--accent)' : 'transparent',
                  color: activeTab === 'recovery' ? '#fff' : 'var(--text-secondary)',
                  border: 'none', cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                <MdHealing size={18} /> Recovery
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'send' && <SendPaymentTab />}
            {activeTab === 'history' && <HistoryTab />}
            {activeTab === 'recovery' && <RecoveryEngineTab />}

          </div>
      </main>
    </PageLayout>
  )
}

function SendPaymentTab() {
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const { chains } = useSwitchChain()
  const chainId = useChainId()
  const [destChainId, setDestChainId] = useState<number>(chains[0]?.id || 0)
  
  const [resolvedAddress, setResolvedAddress] = useState<`0x${string}` | null>(null)
  const [resolving, setResolving] = useState(false)
  const [resolveError, setResolveError] = useState('')

  const currentChain = chains.find(c => c.id === chainId)

  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })

  const resolveRecipient = useCallback(async (value: string) => {
    setResolveError('')
    setResolvedAddress(null)

    if (!value) return

    if (isAddress(value)) {
      setResolvedAddress(value as `0x${string}`)
      return
    }

    const username = value.startsWith('@') ? value.slice(1) : value
    if (!username) return

    setResolving(true)
    try {
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

  const handleSendCrossChain = async () => {
    if (!amount || !resolvedAddress) return
    
    const USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' // Example Sepolia USDC

    writeContract({
      address: CCTP_TOKEN_MESSENGER,
      abi: [{
        "inputs": [
          { "internalType": "uint256", "name": "amount", "type": "uint256" },
          { "internalType": "uint32", "name": "destinationDomain", "type": "uint32" },
          { "internalType": "bytes32", "name": "mintRecipient", "type": "bytes32" },
          { "internalType": "address", "name": "burnToken", "type": "address" }
        ],
        "name": "depositForBurn",
        "outputs": [{ "internalType": "uint64", "name": "nonce", "type": "uint64" }],
        "stateMutability": "nonpayable",
        "type": "function"
      }],
      functionName: 'depositForBurn',
      args: [
        parseUnits(amount, 6),
        getCctpDomain(destChainId), // Map chainId to Circle Domain
        ('0x000000000000000000000000' + resolvedAddress.replace('0x', '')) as `0x${string}`, // Pad to bytes32
        USDC_ADDRESS as `0x${string}`
      ]
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', gap: '16px' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>Source Chain</label>
          <div style={{ padding: '14px', background: 'var(--surface-raised)', borderRadius: '12px', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600 }}>
            {currentChain?.name || 'Unknown'} (Current)
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>Destination Chain</label>
          <select 
            value={destChainId}
            onChange={e => setDestChainId(Number(e.target.value))}
            style={{ width: '100%', padding: '14px', background: 'var(--surface-raised)', borderRadius: '12px', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600, outline: 'none' }}
          >
            {chains.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>Recipient (@username or Address)</label>
        <input 
          type="text" 
          placeholder="@alisheraz0ev or 0x..." 
          value={recipient}
          onChange={e => {
            setRecipient(e.target.value)
            resolveRecipient(e.target.value)
          }}
          style={{ width: '100%', padding: '16px', background: 'var(--surface-raised)', borderRadius: '16px', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '16px', outline: 'none' }}
        />
        {resolving && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}><MdSearch /> Resolving username...</div>}
        {resolveError && <div style={{ fontSize: '12px', color: '#ff4466', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}><MdErrorOutline /> {resolveError}</div>}
        {resolvedAddress && !resolving && !resolveError && recipient !== resolvedAddress && (
          <div style={{ fontSize: '12px', color: 'var(--green)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <MdCheckCircle /> Resolved: {resolvedAddress.slice(0, 6)}...{resolvedAddress.slice(-4)}
          </div>
        )}
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>Amount (USDC)</label>
        <input 
          type="number" 
          placeholder="0.00" 
          value={amount}
          onChange={e => setAmount(e.target.value)}
          style={{ width: '100%', padding: '16px', background: 'var(--surface-raised)', borderRadius: '16px', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '24px', fontWeight: 800, outline: 'none' }}
        />
      </div>

      <button 
        onClick={handleSendCrossChain}
        disabled={isPending || isConfirming}
        style={{
          width: '100%', padding: '18px', background: (isPending || isConfirming) ? 'var(--text-secondary)' : 'var(--accent)', color: 'white', border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: 800, cursor: (isPending || isConfirming) ? 'not-allowed' : 'pointer', marginTop: '12px', boxShadow: (isPending || isConfirming) ? 'none' : '0 4px 16px rgba(16, 53, 246, 0.3)', transition: 'all 0.2s'
        }}
      >
        {isPending ? 'Confirm in Wallet...' : isConfirming ? 'Processing Transaction...' : 'Send Cross-Chain Payment'}
      </button>

      {isConfirmed && (
        <div style={{ padding: '12px', background: 'var(--green-glow)', color: 'var(--green)', borderRadius: '12px', textAlign: 'center', fontWeight: 700 }}>
          Transaction successful! TX: {hash?.slice(0,10)}...
        </div>
      )}
    </div>
  )
}

function HistoryTab() {
  const [filter, setFilter] = useState('All')
  const filters = ['All', 'Sent', 'Received', 'Pending', 'Failed', 'Recovered']

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '16px', marginBottom: '8px', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
        {filters.map(f => (
          <button 
            key={f} 
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap',
              background: filter === f ? 'var(--text-primary)' : 'var(--surface-raised)',
              color: filter === f ? 'var(--surface)' : 'var(--text-secondary)',
              border: filter === f ? 'none' : '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            {f}
          </button>
        ))}
      </div>

      <div style={{ textAlign: 'center', padding: '60px 0', border: '1px dashed var(--border)', borderRadius: '16px' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 600 }}>No {filter.toLowerCase()} transactions found</p>
      </div>
    </div>
  )
}

function RecoveryEngineTab() {
  return (
    <div>
      <div style={{ padding: '24px', background: 'rgba(225, 29, 46, 0.1)', border: '1px solid rgba(225, 29, 46, 0.3)', borderRadius: '16px', marginBottom: '24px', textAlign: 'center' }}>
        <MdHealing size={32} color="#E11D2E" style={{ marginBottom: '12px' }} />
        <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#E11D2E', marginBottom: '8px' }}>Arc Recovery Engine</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: '400px', margin: '0 auto' }}>
          Automatically scans for incomplete CCTP transfers, burned funds, or cross-chain failures. Claim or retry stuck payments securely.
        </p>
      </div>

      <div style={{ textAlign: 'center', padding: '40px 0', background: 'var(--surface-raised)', borderRadius: '16px', border: '1px solid var(--border)' }}>
        <div style={{ width: '48px', height: '48px', border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
        <style jsx>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
        <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>Scanning for stuck funds...</p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Powered by Easyzpay Recovery Engine</p>
      </div>
    </div>
  )
}
