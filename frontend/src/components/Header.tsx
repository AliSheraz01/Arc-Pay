'use client'

import Link from 'next/link'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { FaucetModal } from '@/components/FaucetModal'

export function Header() {
  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: 'rgba(10,10,15,0.85)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid #2a2a3a',
      padding: '0 20px',
      height: '64px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      {/* Logo */}
      <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '32px', height: '32px',
          background: 'linear-gradient(135deg, #7c3aed, #9f5aff)',
          borderRadius: '10px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '16px',
          boxShadow: '0 0 16px #7c3aed40',
        }}>
          ⚡
        </div>
        <span style={{
          fontWeight: 900,
          fontSize: '18px',
          background: 'linear-gradient(135deg, #9f5aff, #00d4a8)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          letterSpacing: '-0.02em',
        }}>
          ArcPay
        </span>
      </Link>

      {/* Nav links — hidden on small screens */}
      <nav style={{ display: 'flex', gap: '4px' }}>
        {[
          { href: '/', label: 'Dashboard' },
          { href: '/send', label: 'Send' },
          { href: '/receive', label: 'Receive' },
          { href: '/history', label: 'History' },
        ].map(link => (
          <Link
            key={link.href}
            href={link.href}
            style={{
              color: '#8888aa',
              textDecoration: 'none',
              fontSize: '13px',
              fontWeight: 600,
              padding: '6px 12px',
              borderRadius: '8px',
              transition: 'all 0.15s',
            }}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      {/* Right — Faucet + Wallet */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <FaucetModal />
        <ConnectButton
          accountStatus="avatar"
          chainStatus="icon"
          showBalance={true}
          label="Connect Wallet"
        />
      </div>
    </header>
  )
}
