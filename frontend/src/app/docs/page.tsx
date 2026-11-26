'use client'

import React from 'react'
import Link from 'next/link'

export default function DocsPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--frame)',
        color: 'var(--ink)',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          flex: 1,
          background: 'var(--panel)',
          borderRadius: '26px',
          padding: 'clamp(20px, 4vw, 52px)',
          maxWidth: '1080px',
          width: '100%',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '32px',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <Link
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '9px',
              textDecoration: 'none',
              color: 'var(--ink)',
              fontWeight: 700,
              fontSize: '1.25rem',
              letterSpacing: '-0.03em',
            }}
          >
            <img
              src="/assets/easyzpay-logo.jpg"
              alt="EasyZpay"
              style={{ width: '30px', height: '30px', borderRadius: '9px', objectFit: 'cover' }}
            />
            <span>EasyZpay Docs</span>
          </Link>

          <div style={{ display: 'flex', gap: '10px' }}>
            <Link
              href="/"
              style={{
                padding: '10px 18px',
                borderRadius: '999px',
                border: '1px solid var(--line)',
                background: 'var(--panel)',
                color: 'var(--ink)',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}
            >
              Home
            </Link>
            <Link
              href="/app"
              style={{
                padding: '10px 18px',
                borderRadius: '999px',
                background: 'var(--blue)',
                color: 'var(--blue-ink)',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}
            >
              Open App
            </Link>
          </div>
        </header>

        <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h1
            style={{
              margin: 0,
              fontSize: 'clamp(2rem, 4.5vw, 3.25rem)',
              fontWeight: 600,
              letterSpacing: '-0.04em',
              lineHeight: 1.05,
            }}
          >
            Documentation
          </h1>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '1.05rem', maxWidth: '58ch', lineHeight: 1.6 }}>
            Send and receive USDC on Arc Network using human-readable usernames, X handles, or our Telegram bot.
          </p>
        </section>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px',
          }}
        >
          <div
            style={{
              background: 'var(--soft)',
              borderRadius: '20px',
              padding: '22px',
              border: '1px solid var(--line)',
            }}
          >
            <h2 style={{ margin: '0 0 8px', fontSize: '1.1rem', fontWeight: 600 }}>1. Register Username</h2>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.92rem', lineHeight: 1.55 }}>
              Claim your <code style={{ fontWeight: 600 }}>@username</code> in the app or link your X handle so anyone can pay you without a 42-character address.
            </p>
          </div>

          <div
            style={{
              background: 'var(--soft)',
              borderRadius: '20px',
              padding: '22px',
              border: '1px solid var(--line)',
            }}
          >
            <h2 style={{ margin: '0 0 8px', fontSize: '1.1rem', fontWeight: 600 }}>2. Pay on Telegram</h2>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.92rem', lineHeight: 1.55 }}>
              Pair your Telegram account in <strong>Chat to Pay</strong> and send instant transfers with commands like <code>/pay 50 USDC to @ali</code>.
            </p>
          </div>

          <div
            style={{
              background: 'var(--soft)',
              borderRadius: '20px',
              padding: '22px',
              border: '1px solid var(--line)',
            }}
          >
            <h2 style={{ margin: '0 0 8px', fontSize: '1.1rem', fontWeight: 600 }}>3. Cross-Chain CCTP</h2>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.92rem', lineHeight: 1.55 }}>
              Bridge USDC seamlessly across Arc Mainnet, Base, Ethereum, and OP Mainnet directly from <strong>Cross Pay</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
