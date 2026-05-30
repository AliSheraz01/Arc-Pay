'use client'

import { useState } from 'react'
import { FAUCET_URL } from '@/lib/constants'

export function FaucetModal() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          background: 'linear-gradient(135deg, #00d4a820, #00d4a810)',
          border: '1px solid #00d4a840',
          color: '#00d4a8',
          borderRadius: '10px',
          padding: '9px 16px',
          fontSize: '13px',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          letterSpacing: '0.02em',
          transition: 'all 0.2s',
          whiteSpace: 'nowrap',
        }}
        onMouseOver={e => {
          e.currentTarget.style.background = 'linear-gradient(135deg, #00d4a840, #00d4a820)'
          e.currentTarget.style.borderColor = '#00d4a8'
        }}
        onMouseOut={e => {
          e.currentTarget.style.background = 'linear-gradient(135deg, #00d4a820, #00d4a810)'
          e.currentTarget.style.borderColor = '#00d4a840'
        }}
      >
        <span>💧</span> Arc Faucet
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#111118',
              border: '1px solid #2a2a3a',
              borderRadius: '20px',
              padding: '32px',
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 0 60px #00d4a820',
              animation: 'slide-up 0.3s ease-out',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#00d4a8', marginBottom: '4px' }}>
                  💧 Arc Faucet
                </h2>
                <p style={{ color: '#8888aa', fontSize: '13px' }}>
                  Get free testnet USDC for gas fees
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', color: '#55556a', cursor: 'pointer', fontSize: '20px' }}
              >
                ✕
              </button>
            </div>

            {/* Steps */}
            {[
              { step: '1', title: 'Open Circle Faucet', desc: 'Visit the official Circle faucet page.' },
              { step: '2', title: 'Select Arc Testnet', desc: 'Choose Arc Network as your destination.' },
              { step: '3', title: 'Claim USDC', desc: 'Paste your wallet address and claim tokens.' },
            ].map(item => (
              <div
                key={item.step}
                style={{
                  display: 'flex',
                  gap: '14px',
                  marginBottom: '16px',
                  alignItems: 'flex-start',
                }}
              >
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: '#00d4a820', border: '1px solid #00d4a840',
                  color: '#00d4a8', fontSize: '12px', fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {item.step}
                </div>
                <div>
                  <div style={{ color: '#f0f0ff', fontWeight: 600, fontSize: '14px' }}>{item.title}</div>
                  <div style={{ color: '#8888aa', fontSize: '13px' }}>{item.desc}</div>
                </div>
              </div>
            ))}

            <a
              href={FAUCET_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                marginTop: '24px',
                background: 'linear-gradient(135deg, #00d4a8, #00b896)',
                color: '#0a0a0f',
                border: 'none',
                borderRadius: '12px',
                padding: '14px',
                fontSize: '15px',
                fontWeight: 800,
                cursor: 'pointer',
                textAlign: 'center',
                textDecoration: 'none',
                letterSpacing: '0.02em',
                transition: 'opacity 0.2s',
              }}
            >
              Open Circle Faucet →
            </a>

            <p style={{ color: '#55556a', fontSize: '12px', textAlign: 'center', marginTop: '12px' }}>
              Powered by Circle • Arc Testnet only
            </p>
          </div>
        </div>
      )}
    </>
  )
}
