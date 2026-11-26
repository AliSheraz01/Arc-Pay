'use client'

import React from 'react'
import Link from 'next/link'
import { Sidebar } from './Sidebar'
import { LoginButton } from './LoginButton'
import { FaucetModal } from './FaucetModal'

interface PageLayoutProps {
  children: React.ReactNode
}

export function PageLayout({ children }: PageLayoutProps) {
  return (
    <div
      className="app-container"
      style={{
        background: 'var(--background)',
        minHeight: '100vh',
        color: 'var(--text-primary)',
      }}
    >
      {/* Real Sidebar Navigation (Desktop fixed + Mobile Glass Bar) */}
      <Sidebar />

      {/* Main Content Panel */}
      <div className="main-content" style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Compact Top Header: Mobile shows Logo left + Connect Wallet right; Desktop shows Faucet + Connect Wallet right */}
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 90,
            background: 'var(--background)',
            padding: '12px 20px',
            minHeight: '64px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--line)',
          }}
        >
          {/* Mobile Left: Compact EasyZpay Logo */}
          <Link
            href="/"
            className="flex md:hidden items-center gap-2.5 no-underline"
            style={{ color: 'var(--ink)' }}
          >
            <img
              src="/assets/easyzpay-logo.jpg"
              alt="EasyZpay"
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '9px',
                objectFit: 'cover',
                display: 'block',
              }}
            />
            <span
              style={{
                fontWeight: 700,
                fontSize: '18px',
                letterSpacing: '-0.03em',
                color: 'var(--ink)',
              }}
            >
              EasyZpay
            </span>
          </Link>

          {/* Desktop spacer */}
          <div className="hidden md:block" />

          {/* Right section - Faucet + Connect Wallet */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FaucetModal />
            <LoginButton />
          </div>
        </header>

        {/* Children Page Content */}
        <div style={{ padding: '24px', flex: 1, position: 'relative', zIndex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  )
}
