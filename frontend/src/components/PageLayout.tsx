'use client'

import React from 'react'
import { Sidebar } from './Sidebar'
import { LoginButton } from './LoginButton'
import { FaucetModal } from './FaucetModal'

interface PageLayoutProps {
  children: React.ReactNode
}

export function PageLayout({ children }: PageLayoutProps) {
  return (
    <div className="app-container" style={{ background: 'var(--background)', minHeight: '100vh', color: 'var(--text-primary)' }}>
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Panel */}
      <div className="main-content" style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Top Header Bar inside the main area */}
        <header style={{
          position: 'sticky',
          top: 0,
          zIndex: 90,
          background: 'var(--background)',
          padding: '16px 24px 8px 24px',
          height: '72px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}>
          {/* Right section - Faucet + Connect Wallet */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
