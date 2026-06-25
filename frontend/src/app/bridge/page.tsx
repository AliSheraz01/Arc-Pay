'use client'

import { useState } from 'react'
import { PageLayout } from '@/components/PageLayout'
import { NetworkGuard } from '@/components/NetworkGuard'
import { MdArrowBack, MdArrowDownward, MdTimer, MdLocalGasStation, MdCheckCircle } from 'react-icons/md'
import Link from 'next/link'
import { useAccount, useSwitchChain, useChainId } from 'wagmi'

export default function BridgePage() {
  const { isConnected } = useAccount()
  const { chains } = useSwitchChain()
  const chainId = useChainId()
  const [amount, setAmount] = useState('')
  const [bridgeStatus, setBridgeStatus] = useState<'idle' | 'burning' | 'attesting' | 'minting' | 'complete'>('idle')

  const currentChain = chains.find(c => c.id === chainId)

  const handleBridge = () => {
    setBridgeStatus('burning')
    setTimeout(() => setBridgeStatus('attesting'), 2000)
    setTimeout(() => setBridgeStatus('minting'), 4000)
    setTimeout(() => setBridgeStatus('complete'), 6000)
    setTimeout(() => setBridgeStatus('idle'), 9000)
  }

  if (!isConnected) {
    return (
      <PageLayout>
        <div style={{ maxWidth: '480px', margin: '80px auto', padding: '0 16px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Connect your wallet to bridge USDC.</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <main style={{ maxWidth: '540px', margin: '0 auto', padding: '0 16px' }}>
        <Link href="/" style={{ color: 'var(--text-muted)', fontSize: '13px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px', fontWeight: 600 }}>
          <MdArrowBack size={20} /> Back to Dashboard
        </Link>

        <NetworkGuard>
          <div style={{ 
            background: 'var(--surface)', 
            border: '1px solid var(--border)', 
            borderRadius: '24px', 
            padding: '28px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
              <div>
                <h1 style={{ fontSize: '26px', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '4px', letterSpacing: '-0.02em' }}>CCTP Bridge</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Native USDC bridging powered by Circle</p>
              </div>
              <div style={{ background: 'rgba(39, 117, 202, 0.1)', padding: '6px 12px', borderRadius: '20px', color: '#2775ca', fontSize: '12px', fontWeight: 800 }}>
                V2
              </div>
            </div>

            {/* From Chain */}
            <div style={{ background: 'var(--surface-raised)', borderRadius: '16px', padding: '16px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>From Network</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Balance: 0.00 USDC</span>
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                {currentChain?.name || 'Unknown'} (Current)
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', margin: '-12px 0', position: 'relative', zIndex: 2 }}>
              <div style={{ width: '36px', height: '36px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <MdArrowDownward size={18} />
              </div>
            </div>

            {/* To Chain */}
            <div style={{ background: 'var(--surface-raised)', borderRadius: '16px', padding: '16px', border: '1px solid var(--border)', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>To Network</span>
              </div>
              <select style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '18px', fontWeight: 800, outline: 'none', appearance: 'none', cursor: 'pointer' }}>
                {chains.map(c => (
                  <option key={c.id} value={c.id} style={{ background: 'var(--surface)' }}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Amount</span>
              </div>
              <div style={{ position: 'relative' }}>
                <input 
                  type="number" 
                  placeholder="0.00" 
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  style={{ width: '100%', padding: '16px 80px 16px 16px', background: 'var(--surface-raised)', borderRadius: '16px', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '28px', fontWeight: 900, outline: 'none' }}
                />
                <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>USDC</span>
                </div>
              </div>
            </div>

            {/* Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px', padding: '16px', background: 'var(--surface-raised)', borderRadius: '16px', border: '1px dashed var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>
                  <MdTimer size={16} /> Estimated Time
                </div>
                <div style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 700 }}>~2 Minutes</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>
                  <MdLocalGasStation size={16} /> Bridge Fee
                </div>
                <div style={{ color: 'var(--green)', fontSize: '13px', fontWeight: 800 }}>Free (CCTP)</div>
              </div>
            </div>

            <button 
              onClick={handleBridge}
              disabled={bridgeStatus !== 'idle'}
              style={{
                width: '100%', padding: '18px', background: bridgeStatus === 'idle' ? '#2775ca' : 'var(--surface-raised)', color: bridgeStatus === 'idle' ? 'white' : 'var(--text-secondary)', border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: 800, cursor: bridgeStatus === 'idle' ? 'pointer' : 'not-allowed', boxShadow: bridgeStatus === 'idle' ? '0 4px 16px rgba(39, 117, 202, 0.3)' : 'none', transition: 'all 0.2s'
              }}
            >
              {bridgeStatus === 'idle' && 'Bridge USDC'}
              {bridgeStatus === 'burning' && 'Burning USDC on Source...'}
              {bridgeStatus === 'attesting' && 'Waiting for Circle Attestation...'}
              {bridgeStatus === 'minting' && 'Minting USDC on Destination...'}
              {bridgeStatus === 'complete' && 'Bridge Complete!'}
            </button>

            {/* Progress Tracker UI */}
            {bridgeStatus !== 'idle' && (
              <div style={{ marginTop: '24px', padding: '16px', background: 'var(--surface-raised)', borderRadius: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: bridgeStatus === 'complete' ? 'var(--green)' : 'var(--text-primary)' }}>
                  <MdCheckCircle size={20} />
                  <span style={{ fontSize: '14px', fontWeight: 700 }}>
                    {bridgeStatus === 'burning' ? 'Transaction pending...' : 'Success'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </NetworkGuard>
      </main>
    </PageLayout>
  )
}
