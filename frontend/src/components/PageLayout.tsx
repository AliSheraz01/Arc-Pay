'use client'

import React from 'react'
import Link from 'next/link'
import { Sidebar, EasyZpayArchMark } from './Sidebar'
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
      <Sidebar />

      <div className="main-content" style={{ display: 'flex', flexDirection: 'column' }}>
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
          {/* Mobile Left: Compact EasyZpay Arch Mark + Text */}
          <Link
            href="/"
            className="flex md:hidden items-center gap-2.5 no-underline"
            style={{ color: 'var(--ink)' }}
          >
            <EasyZpayArchMark size={30} />
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

          <div className="hidden md:block" />

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FaucetModal />
            <LoginButton />
          </div>
        </header>

        <div style={{ padding: '24px', flex: 1, position: 'relative', zIndex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  )
}
