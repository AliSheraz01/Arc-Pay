'use client'

import { useChainId } from 'wagmi'
import { ARC_CHAIN_ID } from '@/lib/constants'

export function NetworkGuard({ children }: { children: React.ReactNode }) {
  const chainId = useChainId()
  const isCorrectNetwork = chainId === ARC_CHAIN_ID

  if (!isCorrectNetwork && chainId) {
    return (
      <>
        <div
          style={{
            background: 'linear-gradient(90deg, #ff446620, #ff446610)',
            border: '1px solid #ff4466',
            borderRadius: '12px',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <span style={{ color: '#ff4466', fontWeight: 600, fontSize: '14px' }}>
              Wrong network — please switch to Arc Network
            </span>
          </div>
          <SwitchNetworkButton />
        </div>
        <div style={{ opacity: 0.4, pointerEvents: 'none', userSelect: 'none' }}>
          {children}
        </div>
      </>
    )
  }

  return <>{children}</>
}

function SwitchNetworkButton() {
  async function handleSwitch() {
    const ethereum = (window as any).ethereum
    if (typeof window === 'undefined' || !ethereum) return
    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x' + ARC_CHAIN_ID.toString(16) }],
      })
    } catch (err: unknown) {
      // Chain not added yet — add it
      if (err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 4902) {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x' + ARC_CHAIN_ID.toString(16),
            chainName: 'Arc Testnet',
            nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
            rpcUrls: ['https://rpc.testnet.arc.network'],
            blockExplorerUrls: ['https://testnet.arcscan.app'],
          }],
        })
      }
    }
  }

  return (
    <button
      onClick={handleSwitch}
      style={{
        background: '#ff4466',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        padding: '8px 16px',
        fontSize: '13px',
        fontWeight: 700,
        cursor: 'pointer',
        letterSpacing: '0.02em',
        transition: 'opacity 0.2s',
      }}
      onMouseOver={e => (e.currentTarget.style.opacity = '0.8')}
      onMouseOut={e => (e.currentTarget.style.opacity = '1')}
    >
      Switch Network
    </button>
  )
}
