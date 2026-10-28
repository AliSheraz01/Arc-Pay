'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { PageLayout } from '@/components/PageLayout'
import { NetworkGuard } from '@/components/NetworkGuard'
import { TelegramPairingCard } from '@/components/TelegramPairingCard'
import { XAgentWalletCard } from '@/components/XAgentWalletCard'
import Link from 'next/link'
import { MdSecurity, MdFlashOn, MdArrowBack } from 'react-icons/md'

export default function ChatToPayPage() {
  return (
    <PageLayout>
      <Suspense fallback={<div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading Chat to Pay...</div>}>
        <ChatToPayContent />
      </Suspense>
    </PageLayout>
  )
}

function ChatToPayContent() {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') === 'telegram' ? 'telegram' : 'x'
  const [activeTab, setActiveTab] = useState<'x' | 'telegram'>(initialTab)

  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam === 'telegram') setActiveTab('telegram')
    else if (tabParam === 'x') setActiveTab('x')
  }, [searchParams])

  const TelegramIcon = ({ size = 20 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.05-.2-.06-.05-.16-.03-.23-.02-.1.02-1.68 1.07-4.74 3.14-.45.31-.86.46-1.22.45-.4-.01-1.18-.23-1.75-.41-.7-.23-1.26-.35-1.21-.74.03-.2.3-.41.83-.63 3.26-1.42 5.44-2.35 6.54-2.8 3.12-1.29 3.77-1.51 4.2-.1.52.01.17.03.35.03.35z" />
    </svg>
  )

  return (
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
        <h1 style={{ fontSize: '26px', fontWeight: 900, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
          Social & Chat Payments
        </h1>
        <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: '6px 0 0 0' }}>
          Send and receive USDC natively across 𝕏 (Twitter) and Telegram using delegated non-custodial Agent Wallets.
        </p>
      </div>

      {/* Tab Switcher: 𝕏 Bot vs Telegram Bot */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          background: 'var(--surface-raised)',
          padding: '6px',
          borderRadius: '16px',
          marginBottom: '24px',
          border: '1px solid var(--border)',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('x')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px',
            borderRadius: '12px',
            border: 'none',
            background: activeTab === 'x' ? 'var(--surface)' : 'transparent',
            color: activeTab === 'x' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: 800,
            fontSize: '13.5px',
            cursor: 'pointer',
            boxShadow: activeTab === 'x' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
            transition: 'all 0.2s',
          }}
        >
          <span style={{ fontSize: '16px', fontWeight: 900 }}>𝕏</span>
          <span>𝕏 Bot (Agent Wallet)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('telegram')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px',
            borderRadius: '12px',
            border: 'none',
            background: activeTab === 'telegram' ? 'var(--surface)' : 'transparent',
            color: activeTab === 'telegram' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: 800,
            fontSize: '13.5px',
            cursor: 'pointer',
            boxShadow: activeTab === 'telegram' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
            transition: 'all 0.2s',
          }}
        >
          <TelegramIcon size={18} />
          <span>Telegram AI Bot</span>
        </button>
      </div>

      <NetworkGuard>
        {activeTab === 'x' ? (
          <div>
            {/* 𝕏 Agent Wallet Vault & Funding Component */}
            <div style={{ marginBottom: '24px' }}>
              <XAgentWalletCard />
            </div>

            {/* 𝕏 Bot Commands Cheat Sheet */}
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '24px',
                padding: '24px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
                marginBottom: '24px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '10px',
                    background: 'rgba(0,0,0,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-primary)',
                    fontWeight: 900,
                  }}
                >
                  𝕏
                </div>
                <h2 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  𝕏 (Twitter) Bot Commands
                </h2>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <CommandRow
                  command="@EasyPayBot tip 5 USDC to @username"
                  description="Sends 5 USDC tip directly to any user on 𝕏 with sub-second Arc confirmation."
                  tag="MICRO-TIP"
                />
                <CommandRow
                  command="@EasyPayBot pay 10 to @bob"
                  description="Direct peer-to-peer payment settled instantly via your funded Agent Wallet."
                  tag="P2P PAY"
                />
                <CommandRow
                  command="@EasyPayBot bounty 25 USDC for @coder"
                  description="Distributes task or bounty reward to builder on Arc Network."
                  tag="BOUNTY"
                />
              </div>
            </div>
          </div>
        ) : (
          <div>
            {/* Telegram Bot Pairing Card */}
            <div style={{ marginBottom: '24px' }}>
              <TelegramPairingCard />
            </div>

            {/* Telegram Bot Commands Cheat Sheet */}
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '24px',
                padding: '24px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
                marginBottom: '24px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
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
                <h2 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Telegram Bot Commands
                </h2>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <CommandRow
                  command="Pay 5 USDC to @username"
                  description="Sends native USDC directly to any registered Easyzpay username."
                />
                <CommandRow
                  command="/panel"
                  description="Opens interactive control panel with clickable inline buttons."
                  tag="BUTTONS"
                />
                <CommandRow
                  command="/history"
                  description="Displays recent confirmed payments with ArcScan links."
                  tag="SYNC"
                />
                <CommandRow
                  command="/disconnect"
                  description="Instantly revokes session key in Turso DB and unlinks Telegram."
                  tag="REVOKE"
                />
              </div>
            </div>
          </div>
        )}

        {/* Security Info Card */}
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
              Non-Custodial Isolated Agent Security
            </h4>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Easyzpay enforces strict architectural isolation between your cold Main Wallet and your Agent Wallet. The bot only operates with funds you explicitly deposit into the Agent Vault, and you can sweep your funds back at any time.
            </p>
          </div>
        </div>
      </NetworkGuard>
    </main>
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
              color: 'var(--accent)',
              background: 'var(--accent-glow)',
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
