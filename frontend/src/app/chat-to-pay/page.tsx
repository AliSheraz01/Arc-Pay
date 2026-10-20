'use client'

import { PageLayout } from '@/components/PageLayout'
import { NetworkGuard } from '@/components/NetworkGuard'
import { TelegramPairingCard } from '@/components/TelegramPairingCard'
import Link from 'next/link'
import { MdSecurity, MdFlashOn, MdArrowBack } from 'react-icons/md'

export default function ChatToPayPage() {
  const TelegramIcon = ({ size = 22 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.05-.2-.06-.05-.16-.03-.23-.02-.1.02-1.68 1.07-4.74 3.14-.45.31-.86.46-1.22.45-.4-.01-1.18-.23-1.75-.41-.7-.23-1.26-.35-1.21-.74.03-.2.3-.41.83-.63 3.26-1.42 5.44-2.35 6.54-2.8 3.12-1.29 3.77-1.51 4.2-.1.52.01.17.03.35.03.35z" />
    </svg>
  )

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
                background: 'rgba(34, 158, 217, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#229ED9',
              }}
            >
              <TelegramIcon size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                Telegram Chat to Pay
              </h1>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Official Telegram Bot API • Unlimited Worldwide • Gasless Arc Relayer
              </span>
            </div>
          </div>
        </div>

        <NetworkGuard>
          {/* Main Pairing & Session Management Card */}
          <div style={{ marginBottom: '24px' }}>
            <TelegramPairingCard />
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
                  background: 'rgba(34, 158, 217, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#229ED9',
                }}
              >
                <MdFlashOn size={18} />
              </div>
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Telegram Bot Commands & Features
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
                description="Opens the interactive control menu with clickable inline buttons."
                tag="INLINE BUTTONS"
              />
              <CommandRow
                command="/history"
                description="Queries the Turso database and displays recent confirmed payments with ArcScan links."
                tag="LIVE SYNC"
              />
              <CommandRow
                command="/disconnect"
                description="Instantly revokes your active session key in Turso DB and unlinks your Telegram."
                tag="SECURITY"
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
                Easyzpay uses ERC-4337 delegated Session Keys stored with AES-256-GCM encryption. The bot can only spend up to your configured daily allowance and requires explicit <strong>Confirm</strong> button click or <strong>YES</strong> confirmation for every transaction.
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
              color: '#229ED9',
              background: 'rgba(34, 158, 217, 0.12)',
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
