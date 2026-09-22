'use client'

import { useState, useEffect, Suspense } from 'react'
import { useAccount, useReadContract, useChainId } from 'wagmi'
import { QRCodeSVG } from 'qrcode.react'
import { PageLayout } from '@/components/PageLayout'
import { NetworkGuard } from '@/components/NetworkGuard'
import { BACKEND_URL, REGISTRY_ADDRESS, ARC_CHAIN_ID } from '@/lib/constants'
import { REGISTRY_ABI } from '@/lib/abi'
import { ACTIVE_CHAIN } from '@/config/network'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { 
  MdArrowBack, 
  MdContentCopy, 
  MdCheck, 
  MdQrCode, 
  MdMonetizationOn, 
  MdLink, 
  MdShare 
} from 'react-icons/md'

function ReceiveForm() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const searchParams = useSearchParams()
  
  const [requestAmount, setRequestAmount] = useState('')
  const [requestMemo, setRequestMemo] = useState('')
  const [requestCreated, setRequestCreated] = useState(false)
  const [requestId, setRequestId] = useState('')
  const [xUsername, setXUsername] = useState<string | null>(null)
  const [copiedXLink, setCopiedXLink] = useState(false)
  const [copiedUserLink, setCopiedUserLink] = useState(false)
  const [copiedAddress, setCopiedAddress] = useState(false)
  const [copiedDirectLink, setCopiedDirectLink] = useState(false)
  const [shared, setShared] = useState(false)

  const [tab, setTab] = useState<'qr' | 'request'>(() => {
    const t = searchParams.get('tab')
    return t === 'request' ? 'request' : 'qr'
  })

  // Read on-chain registered username
  const { data: onChainUsername } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'getMyUsername',
    account: address,
    query: { enabled: !!address && chainId === ARC_CHAIN_ID },
  })

  const username = onChainUsername && typeof onChainUsername === 'string' && onChainUsername.length > 0
    ? onChainUsername
    : null

  // Fetch connected X account on mount
  useEffect(() => {
    if (address) {
      fetch(`${BACKEND_URL}/api/social/x/status/${address}`)
        .then(res => res.json())
        .then(data => {
          if (data.connected && data.account?.username) {
            setXUsername(data.account.username)
          }
        })
        .catch(() => {})
    }
  }, [address])

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const usernameLink = username ? `${origin}/pay/@${username}` : ''
  const directAddressLink = address ? `${origin}/send?to=${address}` : ''
  const primaryPaymentLink = username ? usernameLink : directAddressLink
  const qrData = primaryPaymentLink

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
      if (!res.ok) throw new Error('Backend failed')
      const data = await res.json()
      setRequestId(data.id)
      setRequestCreated(true)
    } catch (err) {
      console.warn('Failed to create backend request, falling back to direct client-side link:', err)
      setRequestId('direct')
      setRequestCreated(true)
    }
  }

  function handleCopyText(text: string, type: 'user' | 'address' | 'direct' | 'x') {
    navigator.clipboard.writeText(text)
    if (type === 'user') {
      setCopiedUserLink(true)
      setTimeout(() => setCopiedUserLink(false), 2000)
    } else if (type === 'address') {
      setCopiedAddress(true)
      setTimeout(() => setCopiedAddress(false), 2000)
    } else if (type === 'direct') {
      setCopiedDirectLink(true)
      setTimeout(() => setCopiedDirectLink(false), 2000)
    } else if (type === 'x') {
      setCopiedXLink(true)
      setTimeout(() => setCopiedXLink(false), 2000)
    }
  }

  async function handleShare(url: string, title: string, text: string) {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text, url })
        setShared(true)
        setTimeout(() => setShared(false), 2000)
        return
      } catch {}
    }
    navigator.clipboard.writeText(url)
    setShared(true)
    setTimeout(() => setShared(false), 2000)
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

  const shareableRequestLink = requestId === 'direct'
    ? (username 
      ? `${origin}/pay/@${username}?amount=${requestAmount}&memo=${encodeURIComponent(requestMemo)}`
      : `${origin}/send?to=${address}&amount=${requestAmount}&memo=${encodeURIComponent(requestMemo)}`)
    : (requestId 
      ? `${origin}/pay/${requestId}` 
      : '')

  return (
    <PageLayout>
      <main style={{ maxWidth: '480px', margin: '0 auto' }}>
        <Link href="/" style={{ color: 'var(--text-muted)', fontSize: '13px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px', fontWeight: 600 }}>
          <MdArrowBack size={20} /> Back to Dashboard
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
                  background: tab === t ? 'linear-gradient(135deg, #1035f6, #3b82f6)' : 'transparent',
                  color: tab === t ? 'white' : 'var(--text-secondary)',
                  fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: tab === t ? '0 4px 12px rgba(16, 53, 246, 0.25)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                {t === 'qr' ? <MdQrCode size={16} /> : <MdMonetizationOn size={16} />}
                {t === 'qr' ? 'My QR & Links' : 'Request Money'}
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
              {/* Username badge */}
              {username ? (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  background: 'var(--accent-glow)', border: '1px solid var(--border-accent)',
                  borderRadius: '100px', padding: '6px 16px', marginBottom: '16px'
                }}>
                  <span style={{ color: 'var(--accent)', fontSize: '15px', fontWeight: 900 }}>
                    @{username}
                  </span>
                  <span style={{
                    background: 'rgba(16, 185, 129, 0.15)', color: 'var(--green)',
                    fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '10px'
                  }}>
                    VERIFIED ON ARC
                  </span>
                </div>
              ) : (
                <div style={{ marginBottom: '16px' }}>
                  <Link href="/" style={{ textDecoration: 'none' }}>
                    <span style={{
                      color: 'var(--accent)', fontSize: '12px', fontWeight: 800,
                      background: 'var(--surface-raised)', padding: '6px 14px', borderRadius: '20px',
                      border: '1px dashed var(--accent)', display: 'inline-block'
                    }}>
                      ⚡ Claim your free @username on Dashboard
                    </span>
                  </Link>
                </div>
              )}

              <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Receive USDC on {ACTIVE_CHAIN.name}
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>
                Scan QR code or share your link to receive instant USDC transfers.
              </p>

              {/* QR Code Container */}
              <div style={{
                display: 'inline-block',
                background: 'white',
                borderRadius: '20px',
                padding: '20px',
                marginBottom: '24px',
                boxShadow: '0 8px 30px rgba(16, 53, 246, 0.15)',
                border: '1px solid var(--border)'
              }}>
                <QRCodeSVG
                  value={qrData}
                  size={190}
                  bgColor="white"
                  fgColor="#0a0a0f"
                  level="M"
                  includeMargin={false}
                />
              </div>

              {/* Primary Username Link Copy */}
              {username && (
                <div style={{ marginBottom: '12px' }}>
                  <button
                    onClick={() => handleCopyText(usernameLink, 'user')}
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, #1035f6, #3b82f6)',
                      border: 'none', borderRadius: '14px', padding: '14px',
                      color: 'white', fontSize: '14px', fontWeight: 800, cursor: 'pointer',
                      transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      boxShadow: '0 4px 14px rgba(16, 53, 246, 0.25)'
                    }}
                  >
                    {copiedUserLink ? <MdCheck size={18} /> : <MdLink size={18} />}
                    {copiedUserLink ? 'Username Link Copied!' : `Copy @${username} Payment Link`}
                  </button>
                </div>
              )}

              {/* Share via Web Share API */}
              <button
                onClick={() => handleShare(
                  primaryPaymentLink,
                  `Pay ${username ? `@${username}` : 'me'} on EasyZPay`,
                  `Pay ${username ? `@${username}` : 'me'} in USDC on ${ACTIVE_CHAIN.name}:`
                )}
                style={{
                  width: '100%',
                  background: 'var(--surface-raised)', border: '1px solid var(--border)',
                  borderRadius: '12px', padding: '12px',
                  color: shared ? 'var(--green)' : 'var(--text-primary)',
                  fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                  transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  marginBottom: '12px'
                }}
              >
                {shared ? <MdCheck size={16} /> : <MdShare size={16} />}
                {shared ? 'Link Shared / Copied!' : 'Share Payment Link via...'}
              </button>

              {/* Copy Address Row */}
              <div
                onClick={() => handleCopyText(address ?? '', 'address')}
                style={{
                  background: 'var(--surface-raised)', border: '1px solid var(--border)',
                  borderRadius: '12px', padding: '12px 16px',
                  cursor: 'pointer', marginBottom: '12px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  transition: 'border-color 0.2s',
                }}
                onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{ textAlign: 'left' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>Wallet Address</div>
                  <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'monospace' }}>
                    {address?.slice(0, 10)}…{address?.slice(-8)}
                  </span>
                </div>
                <span style={{ color: copiedAddress ? 'var(--green)' : 'var(--text-secondary)', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {copiedAddress ? <MdCheck size={14} /> : <MdContentCopy size={14} />}
                  {copiedAddress ? 'Copied!' : 'Copy'}
                </span>
              </div>

              {/* Copy X Handle Payment Link if X Connected */}
              {xUsername && (
                <button
                  onClick={() => {
                    const xLink = `${origin}/send?to=x/@${xUsername}`
                    handleCopyText(xLink, 'x')
                  }}
                  style={{
                    width: '100%',
                    background: '#000', border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '12px', padding: '12px', color: copiedXLink ? 'var(--green)' : '#fff',
                    fontSize: '13px', fontWeight: 800, cursor: 'pointer',
                    transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  }}
                >
                  <span>𝕏</span> {copiedXLink ? '✓ 𝕏 Link Copied!' : `Copy 𝕏 Payment Link (@${xUsername})`}
                </button>
              )}
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
                      <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>
                        <MdMonetizationOn size={18} />
                      </div>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={requestAmount}
                        onChange={e => setRequestAmount(e.target.value)}
                        style={{
                          width: '100%', background: 'var(--surface-raised)', border: '1px solid var(--border)',
                          borderRadius: '12px', padding: '14px 16px 14px 44px', color: 'var(--text-primary)',
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
                      background: requestAmount && parseFloat(requestAmount) > 0 ? 'linear-gradient(135deg, #1035f6, #3b82f6)' : 'var(--border)',
                      border: 'none', borderRadius: '12px', padding: '16px',
                      color: requestAmount && parseFloat(requestAmount) > 0 ? 'white' : 'var(--text-secondary)',
                      fontSize: '15px', fontWeight: 800,
                      cursor: requestAmount && parseFloat(requestAmount) > 0 ? 'pointer' : 'not-allowed',
                      boxShadow: requestAmount && parseFloat(requestAmount) > 0 ? '0 4px 16px rgba(16, 53, 246, 0.25)' : 'none',
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
                    Anyone with this link can pay you <strong>{parseFloat(requestAmount).toFixed(2)} USDC</strong> on {ACTIVE_CHAIN.name}.
                  </p>

                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                    background: 'var(--surface-raised)', border: '1px solid var(--border)',
                    borderRadius: '12px', padding: '12px 16px', cursor: 'pointer', marginBottom: '24px',
                  }}
                    onClick={() => handleCopyText(shareableRequestLink, 'direct')}
                  >
                    <span style={{ color: 'var(--text-primary)', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left', fontFamily: 'monospace' }}>
                      {shareableRequestLink}
                    </span>
                    <span style={{ color: copiedDirectLink ? 'var(--green)' : 'var(--accent)', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      {copiedDirectLink ? <MdCheck size={16} /> : <MdContentCopy size={16} />}
                      {copiedDirectLink ? 'Copied!' : 'Copy'}
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

export default function ReceivePage() {
  return (
    <Suspense fallback={
      <PageLayout>
        <div style={{ maxWidth: '480px', margin: '80px auto', padding: '0 16px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
        </div>
      </PageLayout>
    }>
      <ReceiveForm />
    </Suspense>
  )
}
