'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { QRCodeSVG } from 'qrcode.react'
import { Header } from '@/components/Header'
import { NetworkGuard } from '@/components/NetworkGuard'
import { BACKEND_URL } from '@/lib/constants'
import Link from 'next/link'

export default function ReceivePage() {
  const { address, isConnected } = useAccount()
  const [requestAmount, setRequestAmount] = useState('')
  const [requestMemo, setRequestMemo] = useState('')
  const [requestCreated, setRequestCreated] = useState(false)
  const [requestId, setRequestId] = useState('')
  const [tab, setTab] = useState<'qr' | 'request'>('qr')
  const [copied, setCopied] = useState(false)

  const paymentLink = address
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/send?to=${address}&amount=${requestAmount}&memo=${encodeURIComponent(requestMemo)}`
    : ''

  const qrData = address ? paymentLink : ''

  async function handleCreateRequest() {
    if (!address) return
    try {
      const res = await fetch(`${BACKEND_URL}/api/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAddress: address,
          amount: requestAmount || '0',
          memo: requestMemo,
        }),
      })
      const data = await res.json()
      setRequestId(data.id)
      setRequestCreated(true)
    } catch (err) {
      console.error('Failed to create request', err)
    }
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!isConnected) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0f' }}>
        <Header />
        <div style={{ maxWidth: '480px', margin: '80px auto', padding: '0 16px', textAlign: 'center' }}>
          <p style={{ color: '#8888aa' }}>Connect your wallet to receive payments.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f' }}>
      <Header />
      <main style={{ maxWidth: '480px', margin: '0 auto', padding: '24px 16px' }}>
        <Link href="/" style={{ color: '#55556a', fontSize: '13px', textDecoration: 'none', display: 'block', marginBottom: '20px' }}>
          ← Back
        </Link>

        <NetworkGuard>
          {/* Tab Toggle */}
          <div style={{
            background: '#111118', border: '1px solid #2a2a3a',
            borderRadius: '12px', padding: '4px', display: 'flex', marginBottom: '20px',
          }}>
            {(['qr', 'request'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                  background: tab === t ? '#7c3aed' : 'transparent',
                  color: tab === t ? 'white' : '#8888aa',
                  fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: tab === t ? '0 0 20px #7c3aed40' : 'none',
                }}
              >
                {t === 'qr' ? '📱 My QR Code' : '📨 Request Money'}
              </button>
            ))}
          </div>

          {tab === 'qr' && (
            <div style={{ background: '#111118', border: '1px solid #2a2a3a', borderRadius: '20px', padding: '28px', textAlign: 'center' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#f0f0ff', marginBottom: '6px' }}>Receive USDC</h1>
              <p style={{ color: '#55556a', fontSize: '13px', marginBottom: '28px' }}>
                Share your QR code or address to receive payments
              </p>

              {/* QR Code */}
              <div style={{
                display: 'inline-block',
                background: 'white',
                borderRadius: '16px',
                padding: '20px',
                marginBottom: '24px',
                boxShadow: '0 0 40px #7c3aed30',
              }}>
                <QRCodeSVG
                  value={qrData}
                  size={200}
                  bgColor="white"
                  fgColor="#0a0a0f"
                  level="M"
                  includeMargin={false}
                />
              </div>

              {/* Address */}
              <div
                onClick={() => handleCopy(address ?? '')}
                style={{
                  background: '#0a0a0f', border: '1px solid #2a2a3a',
                  borderRadius: '12px', padding: '14px 16px',
                  cursor: 'pointer', marginBottom: '12px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  transition: 'border-color 0.2s',
                }}
                onMouseOver={e => e.currentTarget.style.borderColor = '#7c3aed'}
                onMouseOut={e => e.currentTarget.style.borderColor = '#2a2a3a'}
              >
                <span style={{ color: '#f0f0ff', fontSize: '13px', fontFamily: 'monospace' }}>
                  {address?.slice(0, 12)}…{address?.slice(-10)}
                </span>
                <span style={{ color: copied ? '#00d4a8' : '#55556a', fontSize: '12px', fontWeight: 700 }}>
                  {copied ? 'Copied!' : '📋 Copy'}
                </span>
              </div>

              <button
                onClick={() => handleCopy(paymentLink)}
                style={{
                  width: '100%',
                  background: '#1a1a24', border: '1px solid #2a2a3a',
                  borderRadius: '12px', padding: '12px', color: '#8888aa',
                  fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseOver={e => { e.currentTarget.style.borderColor = '#7c3aed'; e.currentTarget.style.color = '#9f5aff' }}
                onMouseOut={e => { e.currentTarget.style.borderColor = '#2a2a3a'; e.currentTarget.style.color = '#8888aa' }}
              >
                🔗 Copy Payment Link
              </button>
            </div>
          )}

          {tab === 'request' && (
            <div style={{ background: '#111118', border: '1px solid #2a2a3a', borderRadius: '20px', padding: '28px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#f0f0ff', marginBottom: '6px' }}>Request Money</h1>
              <p style={{ color: '#55556a', fontSize: '13px', marginBottom: '28px' }}>
                Create a payment request with an optional amount
              </p>

              {!requestCreated ? (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ color: '#8888aa', fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                      Amount (USDC) — Optional
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={requestAmount}
                        onChange={e => setRequestAmount(e.target.value)}
                        style={{
                          width: '100%', background: '#0a0a0f', border: '1px solid #2a2a3a',
                          borderRadius: '12px', padding: '14px 60px 14px 16px', color: '#f0f0ff',
                          fontSize: '20px', fontWeight: 700, outline: 'none', boxSizing: 'border-box',
                        }}
                        onFocus={e => e.currentTarget.style.borderColor = '#7c3aed'}
                        onBlur={e => e.currentTarget.style.borderColor = '#2a2a3a'}
                      />
                      <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#7c3aed', fontWeight: 700, fontSize: '14px' }}>
                        USDC
                      </span>
                    </div>
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ color: '#8888aa', fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                      Note — Optional
                    </label>
                    <input
                      type="text"
                      placeholder="What's it for?"
                      value={requestMemo}
                      onChange={e => setRequestMemo(e.target.value)}
                      style={{
                        width: '100%', background: '#0a0a0f', border: '1px solid #2a2a3a',
                        borderRadius: '12px', padding: '14px 16px', color: '#f0f0ff',
                        fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                      }}
                      onFocus={e => e.currentTarget.style.borderColor = '#7c3aed'}
                      onBlur={e => e.currentTarget.style.borderColor = '#2a2a3a'}
                    />
                  </div>

                  <button
                    onClick={handleCreateRequest}
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, #7c3aed, #9f5aff)',
                      border: 'none', borderRadius: '14px', padding: '16px',
                      color: 'white', fontSize: '16px', fontWeight: 800,
                      cursor: 'pointer', boxShadow: '0 0 30px #7c3aed40',
                      letterSpacing: '0.02em',
                    }}
                  >
                    Generate Request Link →
                  </button>
                </>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
                  <p style={{ color: '#00d4a8', fontWeight: 700, fontSize: '16px', marginBottom: '8px' }}>Request Created!</p>
                  <p style={{ color: '#55556a', fontSize: '13px', marginBottom: '24px' }}>Share this link with whoever owes you</p>

                  <div style={{
                    background: '#0a0a0f', border: '1px solid #2a2a3a',
                    borderRadius: '12px', padding: '14px', marginBottom: '12px',
                    wordBreak: 'break-all', textAlign: 'left',
                    color: '#8888aa', fontSize: '12px', fontFamily: 'monospace',
                  }}>
                    {`${typeof window !== 'undefined' ? window.location.origin : ''}/pay/${requestId}`}
                  </div>

                  <button
                    onClick={() => handleCopy(`${typeof window !== 'undefined' ? window.location.origin : ''}/pay/${requestId}`)}
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, #00d4a8, #00b896)',
                      border: 'none', borderRadius: '12px', padding: '14px',
                      color: '#0a0a0f', fontSize: '15px', fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {copied ? '✓ Copied!' : '📋 Copy Link'}
                  </button>

                  <button
                    onClick={() => { setRequestCreated(false); setRequestAmount(''); setRequestMemo('') }}
                    style={{
                      width: '100%', marginTop: '10px',
                      background: '#1a1a24', border: '1px solid #2a2a3a',
                      borderRadius: '12px', padding: '12px', color: '#8888aa',
                      fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Create Another
                  </button>
                </div>
              )}
            </div>
          )}
        </NetworkGuard>
      </main>
    </div>
  )
}
