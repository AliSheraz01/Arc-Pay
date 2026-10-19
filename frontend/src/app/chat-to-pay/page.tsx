'use client'

import { PageLayout } from '@/components/PageLayout'
import { NetworkGuard } from '@/components/NetworkGuard'
import { WhatsAppPairingCard } from '@/components/WhatsAppPairingCard'
import Link from 'next/link'
import { MdChat, MdHistory, MdLinkOff, MdSecurity, MdFlashOn, MdArrowBack } from 'react-icons/md'

export default function ChatToPayPage() {
  return (
    <PageLayout>
      <main style={{ maxWidth: '640px', margin: '0 auto', paddingBottom: '60px' }}>
        {/* Back Link */}
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--text-muted)',
            fontSize: '13px',
            textDecoration: 'none',
            marginBottom: '20px',
            fontWeight: 600,
          }}
        >
          <MdArrowBack size={16} />
          <span>Back to Dashboard</span>
        </Link>

        {/* Page Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '14px',
                background: 'rgba(37, 211, 102, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#25D366',
              }}
            >
              <MdChat size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                Chat to Pay
              </h1>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                WhatsApp AI Agent & Delegated Arc Session Keys
              </span>
            </div>
          </div>
        </div>

        <NetworkGuard>
          {/* Main Pairing & Session Management Card */}
          <div style={{ marginBottom: '24px' }}>
            <WhatsAppPairingCard />
          </div>

          {/* Interactive Bot Commands Cheat Sheet */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '24px',
              padding: '28px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
              marginBottom: '24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  background: 'var(--accent-glow)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent)',
                }}
              >
                <MdFlashOn size={18} />
              </div>
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                WhatsApp Bot Commands
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <CommandRow
                command="Pay 5 USDC to @username"
                description="Sends native USDC directly to any registered Easyzpay username."
              />
              <CommandRow
                command="Send 10 to 0x742d...44e"
                description="Transfers USDC to any standard EVM address on Arc Mainnet."
              />
              <CommandRow
                command="/panel"
                description="Opens the interactive control menu with 1-click options."
                tag="NEW"
              />
              <CommandRow
                command="/history"
                description="Fetches your recent on-chain transfers directly from the database."
                tag="NEW"
              />
              <CommandRow
                command="/disconnect"
                description="Immediately revokes your active session key and unlinks your phone."
                tag="NEW"
              />
            </div>
          </div>

          {/* Security & Non-Custodial Architecture Info */}
          <div
            style={{
              background: 'var(--surface-raised)',
              border: '1px solid var(--border)',
              borderRadius: '20px',
              padding: '20px',
              display: 'flex',
              gap: '14px',
            }}
          >
            <MdSecurity size={24} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
                Bank-Grade Delegated Security
              </h4>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                Easyzpay uses ERC-4337 delegated Session Keys stored with AES-256-GCM encryption. The bot can only spend up to your configured daily allowance and requires explicit <strong>YES</strong> confirmation for every transaction.
              </p>
            </div>
          </div>
        </NetworkGuard>
      </main>
    </PageLayout>
  )
}

function CommandRow({ command, description, tag }: { command: string; description: string; tag?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '12px 16px',
        background: 'var(--surface-raised)',
        border: '1px solid var(--border)',
        borderRadius: '14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <code style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent)' }}>{command}</code>
        {tag && (
          <span
            style={{
              fontSize: '10px',
              fontWeight: 800,
              color: '#25D366',
              background: 'rgba(37, 211, 102, 0.12)',
              padding: '2px 8px',
              borderRadius: '8px',
            }}
          >
            {tag}
          </span>
        )}
      </div>
      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{description}</span>
    </div>
  )
}
