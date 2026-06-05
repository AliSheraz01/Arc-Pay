'use client'

import Link from 'next/link'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { FaucetModal } from '@/components/FaucetModal'
import { useState, useEffect } from 'react'

export function Header() {
  const [theme, setTheme] = useState<'dark' | 'light'>('light')

  useEffect(() => {
    const checkTheme = () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') as 'dark' | 'light' | null
      setTheme(currentTheme ?? 'light')
    }
    checkTheme()

    const observer = new MutationObserver(checkTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      padding: '0 24px',
      height: '64px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      {/* Left side: Network status on desktop, Logo on mobile */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {/* Desktop: Arc Testnet status */}
        <div className="header-desktop-status" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />
          <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 700 }}>Arc Testnet</span>
        </div>

        {/* Mobile: Logo */}
        <Link href="/" className="header-mobile-logo" style={{ textDecoration: 'none', display: 'none', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px',
            background: 'var(--accent)',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px var(--accent-glow)',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 19A8 8 0 0 1 20 19" stroke="white" strokeWidth="4" strokeLinecap="round" fill="none" />
            </svg>
          </div>
          <span style={{
            fontWeight: 900,
            fontSize: '18px',
            color: 'var(--accent)',
            letterSpacing: '-0.02em',
          }}>
            Arc Pay
          </span>
        </Link>
      </div>

      {/* Right — Faucet + Wallet */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <FaucetModal />
        <ConnectButton
          accountStatus="avatar"
          chainStatus="icon"
          showBalance={true}
          label="Connect Wallet"
        />
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          .header-desktop-status {
            display: none !important;
          }
          .header-mobile-logo {
            display: flex !important;
          }
        }
      `}</style>
    </header>
  )
}
