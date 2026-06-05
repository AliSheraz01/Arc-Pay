'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { QRCodeSVG } from 'qrcode.react'
import { PageLayout } from '@/components/PageLayout'
import { NetworkGuard } from '@/components/NetworkGuard'
import { BACKEND_URL } from '@/lib/constants'
import Link from 'next/link'
import { ArrowLeft, Copy, Check, QrCode, Coins, Link2 } from 'lucide-react'

export default function ReceivePage() {
  const { address, isConnected } = useAccount()
  const [requestAmount, setRequestAmount] = useState('')
  const [requestMemo, setRequestMemo] = useState('')
  const [requestCreated, setRequestCreated] = useState(false)
  const [requestId, setRequestId] = useState('')
  const [tab, setTab] = useState<'qr' | 'request'>('qr')
  const [copied, setCopied] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

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

  function handleCopy(text: string, isLink: boolean = false) {
    navigator.clipboard.writeText(text)
    if (isLink) {
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    } else {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!isConnected) {
    return (
      <PageLayout>
        <div style={{ maxWidth: '480px', margin: '80px auto', padding: '0 16px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Connect your wallet to receive payments.</p>
        </div>
      </PageLayout>
    )
  }

  const shareableRequestLink = requestId 
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/pay/${requestId}` 
    : ''

  return (
    <PageLayout>
      <main style={{ maxWidth: '480px', margin: '0 auto' }}>
        <Link href="/" style={{ color: 'var(--text-muted)', fontSize: '13px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px', fontWeight: 600 }}>
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>

        <NetworkGuard>
          {/* Tab Toggle */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '16px', padding: '4px', display: 'flex', marginBottom: '20px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)'
          }}>
            {(['qr', 'request'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
                  background: tab === t ? 'linear-gradient(135deg, #7c3aed, #9f5aff)' : 'transparent',
                  color: tab === t ? 'white' : 'var(--text-secondary)',
                  fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: tab === t ? '0 4px 12px rgba(124, 58, 237, 0.25)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                {t === 'qr' ? <QrCode size={16} /> : <Coins size={16} />}
                {t === 'qr' ? 'My QR Code' : 'Request Money'}
              </button>
            ))}
          </div>

          {tab === 'qr' && (
            <div style={{ 
              background: 'var(--surface)', 
              border: '1px solid var(--border)', 
              borderRadius: '24px', 
              padding: '32px', 
              textAlign: 'center',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
            }}>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>Receive USDC</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '28px' }}>
                Scan QR code or share payment link to receive USDC
              </p>

              {/* QR Code Container */}
              <div style={{
                display: 'inline-block',
                background: 'white',
                borderRadius: '20px',
                padding: '24px',
                marginBottom: '28px',
                boxShadow: '0 8px 30px rgba(124, 58, 237, 0.15)',
                border: '1px solid var(--border)'
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

              {/* Copy Address Row */}
              <div
                onClick={() => handleCopy(address ?? '')}
                style={{
                  background: 'var(--surface-raised)', border: '1px solid var(--border)',
                  borderRadius: '12px', padding: '14px 16px',
                  cursor: 'pointer', marginBottom: '12px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  transition: 'border-color 0.2s',
                }}
                onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'monospace' }}>
                  {address?.slice(0, 12)}…{address?.slice(-10)}
                </span>
                <span style={{ color: copied ? 'var(--green)' : 'var(--text-secondary)', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy'}
                </span>
              </div>

              {/* Copy Direct Send Link */}
              <button
                onClick={() => handleCopy(paymentLink, true)}
                style={{
                  width: '100%',
                  background: 'var(--surface-raised)', border: '1px solid var(--border)',
                  borderRadius: '12px', padding: '14px', color: copiedLink ? 'var(--green)' : 'var(--text-secondary)',
                  fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                  transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
                onMouseOver={e => { if(!copiedLink) {e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--text-primary)'} }}
                onMouseOut={e => { if(!copiedLink) {e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'} }}
              >
                {copiedLink ? <Check size={14} /> : <Link2 size={14} />}
                {copiedLink ? 'Payment Link Copied!' : 'Copy Direct Payment Link'}
              </button>
            </div>
          )}

          {tab === 'request' && (
            <div style={{ 
              background: 'var(--surface)', 
              border: '1px solid var(--border)', 
              borderRadius: '24px', 
              padding: '28px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
            }}>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>Request Money</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '28px' }}>
                Create a customized, shareable payment request
              </p>

              {!requestCreated ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Amount */}
                  <div>
                    <label style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                      Amount (USDC)
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={requestAmount}
                        onChange={e => setRequestAmount(e.target.value)}
                        style={{
                          width: '100%', background: 'var(--surface-raised)', border: '1px solid var(--border)',
                          borderRadius: '12px', padding: '14px 16px', color: 'var(--text-primary)',
                          fontSize: '15px', outline: 'none', boxSizing: 'border-box',
                        }}
                        onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                        onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                      />
                    </div>
                  </div>

                  {/* Memo */}
                  <div>
                    <label style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                      Memo / Description
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. For dinner, project work"
                      value={requestMemo}
                      onChange={e => setRequestMemo(e.target.value)}
                      style={{
                        width: '100%', background: 'var(--surface-raised)', border: '1px solid var(--border)',
                        borderRadius: '12px', padding: '14px 16px', color: 'var(--text-primary)',
                        fontSize: '15px', outline: 'none', boxSizing: 'border-box',
                      }}
                      onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                      onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                    />
                  </div>

                  <button
                    onClick={handleCreateRequest}
                    disabled={!requestAmount || parseFloat(requestAmount) <= 0}
                    style={{
                      width: '100%',
                      background: requestAmount && parseFloat(requestAmount) > 0 ? 'linear-gradient(135deg, #7c3aed, #9f5aff)' : 'var(--border)',
                      border: 'none', borderRadius: '12px', padding: '16px',
                      color: requestAmount && parseFloat(requestAmount) > 0 ? 'white' : 'var(--text-secondary)',
                      fontSize: '15px', fontWeight: 800,
                      cursor: requestAmount && parseFloat(requestAmount) > 0 ? 'pointer' : 'not-allowed',
                      boxShadow: requestAmount && parseFloat(requestAmount) > 0 ? '0 4px 16px rgba(124, 58, 237, 0.25)' : 'none',
                      marginTop: '12px'
                    }}
                  >
                    Generate Request Link
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>✉️</div>
                  <h3 style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '18px', marginBottom: '8px' }}>Request Link Generated</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px', lineHeight: 1.5 }}>
                    Anyone with this link can pay you **{parseFloat(requestAmount).toFixed(2)} USDC** instantly on the Arc network.
                  </p>

                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                    background: 'var(--surface-raised)', border: '1px solid var(--border)',
                    borderRadius: '12px', padding: '12px 16px', cursor: 'pointer', marginBottom: '24px',
                  }}
                    onClick={() => handleCopy(shareableRequestLink)}
                  >
                    <span style={{ color: 'var(--text-primary)', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left', fontFamily: 'monospace' }}>
                      {shareableRequestLink}
                    </span>
                    <span style={{ color: copied ? 'var(--green)' : 'var(--accent)', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? 'Copied!' : 'Copy'}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setRequestCreated(false)
                      setRequestAmount('')
                      setRequestMemo('')
                    }}
                    style={{
                      width: '100%', background: 'transparent', border: '1px solid var(--border)',
                      borderRadius: '12px', padding: '14px', color: 'var(--text-primary)',
                      fontSize: '14px', fontWeight: 800, cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={e => e.currentTarget.style.background = 'var(--surface-raised)'}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                  >
                    Create Another Request
                  </button>
                </div>
              )}
            </div>
          )}
        </NetworkGuard>
      </main>
    </PageLayout>
  )
}
