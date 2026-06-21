'use client'

import { useState } from 'react'
import { useConnect, useAccount, useDisconnect } from 'wagmi'
import { useWallet } from '@solana/wallet-adapter-react'
import { MdWallet, MdClose, MdCheckCircle } from 'react-icons/md'

export function ConnectWalletModal() {
  const [isOpen, setIsOpen] = useState(false)
  
  const { connectors, connect } = useConnect()
  const { address, isConnected: isEvmConnected } = useAccount()
  const { disconnect: disconnectEvm } = useDisconnect()

  const { wallets: solanaWallets, select: connectSolana, publicKey, disconnect: disconnectSolana } = useWallet()
  const isSolanaConnected = !!publicKey

  // Helpers to find specific EVM connectors
  const metamask = connectors.find(c => c.name.toLowerCase().includes('metamask') || c.id === 'injected')
  const coinbase = connectors.find(c => c.name.toLowerCase().includes('coinbase'))
  const walletConnect = connectors.find(c => c.id === 'walletConnect')

  // Helpers for Solana
  const phantom = solanaWallets.find(w => w.adapter.name.toLowerCase().includes('phantom'))

  const handleEvmConnect = (connector: any) => {
    if (connector) {
      connect({ connector })
      setIsOpen(false)
    }
  }

  const handleSolanaConnect = (walletName: any) => {
    connectSolana(walletName)
    setIsOpen(false)
  }

  const totalConnected = (isEvmConnected ? 1 : 0) + (isSolanaConnected ? 1 : 0)

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        style={{
          background: totalConnected > 0 ? 'var(--surface-raised)' : 'var(--accent)',
          color: totalConnected > 0 ? 'var(--text-primary)' : 'white',
          border: totalConnected > 0 ? '1px solid var(--border)' : 'none',
          padding: '8px 16px',
          borderRadius: '12px',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: totalConnected === 0 ? '0 4px 12px var(--accent-glow)' : 'none'
        }}
      >
        {totalConnected > 0 ? (
          <>
            <MdWallet size={18} color="var(--accent)" />
            {totalConnected} Connected
          </>
        ) : (
          'Connect Wallet'
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '24px', width: '90%', maxWidth: '400px',
            padding: '24px', position: 'relative',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <button 
              onClick={() => setIsOpen(false)}
              style={{
                position: 'absolute', top: '16px', right: '16px',
                background: 'var(--surface-raised)', border: 'none',
                width: '32px', height: '32px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--text-secondary)'
              }}
            >
              <MdClose size={20} />
            </button>

            <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '24px', textAlign: 'center', color: 'var(--text-primary)' }}>
              Connect Wallet
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* MetaMask */}
              <button 
                onClick={() => isEvmConnected ? disconnectEvm() : handleEvmConnect(metamask)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px', borderRadius: '16px', border: '1px solid var(--border)',
                  background: 'var(--surface-raised)', cursor: 'pointer',
                  transition: 'all 0.2s', width: '100%'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  <img src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg" alt="MetaMask" width={24} height={24} />
                  MetaMask (EVM)
                </div>
                {isEvmConnected ? <MdCheckCircle color="#00d4a8" size={20} /> : <span style={{ color: 'var(--text-secondary)' }}>Connect</span>}
              </button>

              {/* WalletConnect */}
              {walletConnect && (
                <button 
                  onClick={() => !isEvmConnected && handleEvmConnect(walletConnect)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '16px', borderRadius: '16px', border: '1px solid var(--border)',
                    background: 'var(--surface-raised)', cursor: 'pointer',
                    transition: 'all 0.2s', width: '100%', opacity: isEvmConnected ? 0.5 : 1
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    <div style={{ width: 24, height: 24, background: '#3b99fc', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="14" height="10" viewBox="0 0 14 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4.03233 2.12457C5.66981 0.536854 8.32906 0.536854 9.96654 2.12457L13.6841 5.72911C13.9189 5.95679 13.9189 6.32591 13.6841 6.55359L12.8091 7.40193C12.5743 7.62961 12.1935 7.62961 11.9587 7.40193L8.68007 4.22301C7.74415 3.31551 6.25472 3.31551 5.31881 4.22301L2.04018 7.40193C1.80537 7.62961 1.42461 7.62961 1.18981 7.40193L0.314781 6.55359C0.079975 6.32591 0.079975 5.95679 0.314781 5.72911L4.03233 2.12457Z" fill="white"/>
                      </svg>
                    </div>
                    WalletConnect
                  </div>
                  {isEvmConnected ? <span style={{ color: 'var(--text-secondary)' }}>EVM Active</span> : <span style={{ color: 'var(--text-secondary)' }}>Connect</span>}
                </button>
              )}

              {/* Coinbase */}
              {coinbase && (
                <button 
                  onClick={() => !isEvmConnected && handleEvmConnect(coinbase)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '16px', borderRadius: '16px', border: '1px solid var(--border)',
                    background: 'var(--surface-raised)', cursor: 'pointer',
                    transition: 'all 0.2s', width: '100%', opacity: isEvmConnected ? 0.5 : 1
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    <div style={{ width: 24, height: 24, background: '#0052FF', borderRadius: '50%' }} />
                    Coinbase
                  </div>
                  {isEvmConnected ? <span style={{ color: 'var(--text-secondary)' }}>EVM Active</span> : <span style={{ color: 'var(--text-secondary)' }}>Connect</span>}
                </button>
              )}

              <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' }} />

              {/* Phantom */}
              <button 
                onClick={() => isSolanaConnected ? disconnectSolana() : handleSolanaConnect(phantom?.adapter.name || 'Phantom')}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px', borderRadius: '16px', border: '1px solid var(--border)',
                  background: 'var(--surface-raised)', cursor: 'pointer',
                  transition: 'all 0.2s', width: '100%'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  <img src="https://phantom.app/img/logo.png" alt="Phantom" width={24} height={24} style={{ borderRadius: '50%' }} />
                  Phantom (Solana)
                </div>
                {isSolanaConnected ? <MdCheckCircle color="#ab9ff2" size={20} /> : <span style={{ color: 'var(--text-secondary)' }}>Connect</span>}
              </button>

            </div>

            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', marginTop: '24px' }}>
              Connect both an EVM wallet and a Solana wallet to link them to your single EasyZpay identity.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
