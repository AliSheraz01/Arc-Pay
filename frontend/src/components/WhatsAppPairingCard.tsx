'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { MdChat, MdCheckCircle, MdAccessTime, MdSecurity, MdContentCopy, MdOpenInNew } from 'react-icons/md'

export function WhatsAppPairingCard() {
  const { address } = useAccount()
  const [spendingLimit, setSpendingLimit] = useState('50.0')
  const [expiryDays, setExpiryDays] = useState('7')
  const [loading, setLoading] = useState(false)
  const [pairingToken, setPairingToken] = useState<string | null>(null)
  const [deepLink, setDeepLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [sessionData, setSessionData] = useState<{
    paired: boolean
    sessionId?: string
    phoneId?: string
    spendingLimit?: string
    spentAmount?: string
    validUntil?: string
  } | null>(null)
  const [error, setError] = useState('')

  // 1. Session Persistence: Restore active session from Turso database on mount or wallet change
  useEffect(() => {
    if (!address) {
      setSessionData(null)
      return
    }

    let isMounted = true
    const currentAddress = address
    async function loadActiveSession() {
      try {
        const res = await fetch(`/api/chat-to-pay/session?address=${currentAddress.toLowerCase()}`)
        if (res.ok) {
          const data = await res.json()
          if (isMounted && data.found && data.session) {
            setSessionData(data.session)
          }
        }
      } catch (err) {
        console.warn('Failed to load persistent session:', err)
      }
    }

    loadActiveSession()
    return () => { isMounted = false }
  }, [address])

  // 2. Poll pairing status if pairingToken is active
  useEffect(() => {
    if (!pairingToken || sessionData?.paired) return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/chat-to-pay/pairing/status/${pairingToken}`)
        if (res.ok) {
          const data = await res.json()
          if (data.paired) {
            setSessionData(data)
            setPairingToken(null)
          }
        }
      } catch (e) {
        console.warn('Status poll error:', e)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [pairingToken, sessionData?.paired])

  async function handleDisconnect() {
    if (!sessionData?.sessionId) {
      setSessionData(null)
      return
    }
    try {
      await fetch(`/api/chat-to-pay/session?sessionId=${sessionData.sessionId}`, {
        method: 'DELETE',
      })
      setSessionData(null)
    } catch (e) {
      console.warn('Disconnect error:', e)
      setSessionData(null)
    }
  }


  async function handleStartPairing() {
    if (!address) return
    setLoading(true)
    setError('')
    try {
      // 1. Generate an ephemeral session key pair
      const sessionPrivateKey = generatePrivateKey()
      const sessionAccount = privateKeyToAccount(sessionPrivateKey)
      const sessionPublicKey = sessionAccount.address

      // 2. Request backend pairing token
      const res = await fetch('/api/chat-to-pay/pairing/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smartAccountAddress: address,
          ownerAddress: address,
          sessionPublicKey,
          sessionPrivateKey,
          spendingLimit,
          expiryDays: Number(expiryDays),
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to create pairing session')
      }

      const data = await res.json()
      setPairingToken(data.pairingToken)
      const link = (data.whatsappDeepLink && !data.whatsappDeepLink.includes('15551234567'))
        ? data.whatsappDeepLink
        : `https://wa.me/923497225236?text=${encodeURIComponent(`PAIR ${data.pairingToken}`)}`
      setDeepLink(link)
    } catch (err: any) {
      console.error('Pairing error:', err)
      setError(err.message || 'Failed to initiate pairing')
    } finally {
      setLoading(false)
    }
  }

  function handleCopy() {
    if (pairingToken) {
      navigator.clipboard.writeText(`PAIR ${pairingToken}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '24px',
      padding: '28px',
      marginBottom: '20px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '10px',
            background: 'rgba(37, 211, 102, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#25D366'
          }}>
            <MdChat size={20} />
          </div>
          <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            WhatsApp Chat-to-Pay
          </h2>
        </div>
        <span style={{
          fontSize: '11px',
          fontWeight: 800,
          color: sessionData?.paired ? '#25D366' : 'var(--accent)',
          background: sessionData?.paired ? 'rgba(37, 211, 102, 0.1)' : 'var(--accent-glow)',
          padding: '4px 10px',
          borderRadius: '12px'
        }}>
          {sessionData?.paired ? '● PAIRED' : 'ERC-4337 READY'}
        </span>
      </div>

      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.5, marginBottom: '20px' }}>
        Send USDC instantly on Arc Chain using WhatsApp. Protected by delegated Session Keys, daily spending caps, and two-step verification.
      </p>

      {sessionData?.paired ? (
        <div style={{
          background: 'var(--surface-raised)',
          border: '1px solid rgba(37, 211, 102, 0.3)',
          borderRadius: '16px',
          padding: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#25D366', fontWeight: 800, marginBottom: '12px' }}>
            <MdCheckCircle size={20} />
            <span>Connected with WhatsApp ({sessionData.phoneId})</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Spending Cap:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{sessionData.spendingLimit} USDC</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Spent so far:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{sessionData.spentAmount || '0'} USDC</strong>
            </div>
          </div>

          <div style={{
            background: 'var(--surface)',
            borderRadius: '12px',
            padding: '12px',
            fontSize: '12px',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)'
          }}>
            <div style={{ fontWeight: 700, marginBottom: '6px' }}>💬 Example text to send:</div>
            <code style={{ display: 'block', color: 'var(--accent)', padding: '2px 0' }}>Pay 5 USDC to @username</code>
            <code style={{ display: 'block', color: 'var(--accent)', padding: '2px 0' }}>Send 10 to 0x123...456</code>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
              Always reply <strong>YES</strong> to execute payment on Arc Mainnet.
            </div>
          </div>

          <button
            type="button"
            onClick={handleDisconnect}
            style={{
              width: '100%',
              marginTop: '12px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '10px',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseOver={e => e.currentTarget.style.color = 'var(--red)'}
            onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}
          >
            Disconnect WhatsApp Session
          </button>
        </div>
      ) : pairingToken ? (
        <div style={{
          background: 'var(--surface-raised)',
          border: '1px solid var(--border-accent)',
          borderRadius: '16px',
          padding: '20px',
        }}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Your 6-Character Pairing Code:</div>
            <div style={{
              fontSize: '28px',
              fontWeight: 900,
              letterSpacing: '0.1em',
              color: 'var(--accent)',
              fontFamily: 'monospace',
              margin: '8px 0',
            }}>
              {pairingToken}
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '8px 0 4px 0' }}>
              Send this code to WhatsApp Bot: <strong style={{ color: '#25D366' }}>+92 349 7225236</strong>
            </p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Click the button below or text directly from WhatsApp.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={handleCopy}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '12px',
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              <MdContentCopy size={16} />
              <span>{copied ? 'Copied!' : 'Copy Code'}</span>
            </button>

            {deepLink && (
              <a
                href={deepLink}
                target="_blank"
                rel="noreferrer"
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: '#25D366',
                  color: 'white',
                  borderRadius: '12px',
                  padding: '12px',
                  fontSize: '13px',
                  fontWeight: 800,
                  textDecoration: 'none',
                }}
              >
                <MdOpenInNew size={16} />
                <span>Open WhatsApp</span>
              </a>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '16px', color: 'var(--text-muted)', fontSize: '11px' }}>
            <MdAccessTime size={14} className="shimmer-rotate" />
            <span>Listening for confirmation in WhatsApp...</span>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '6px' }}>
                Spending Limit (USDC)
              </label>
              <input
                type="number"
                value={spendingLimit}
                onChange={e => setSpendingLimit(e.target.value)}
                placeholder="50.0"
                style={{
                  width: '100%',
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '6px' }}>
                Duration (Days)
              </label>
              <input
                type="number"
                value={expiryDays}
                onChange={e => setExpiryDays(e.target.value)}
                placeholder="7"
                style={{
                  width: '100%',
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {error && (
            <p style={{ color: 'var(--red)', fontSize: '12px', marginBottom: '12px' }}>
              ⚠️ {error}
            </p>
          )}

          <button
            type="button"
            disabled={loading || !address}
            onClick={handleStartPairing}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              background: 'linear-gradient(135deg, #25D366, #128C7E)',
              border: 'none',
              borderRadius: '12px',
              padding: '14px',
              color: 'white',
              fontSize: '14px',
              fontWeight: 800,
              cursor: address ? 'pointer' : 'not-allowed',
              boxShadow: '0 4px 14px rgba(37, 211, 102, 0.25)',
              transition: 'all 0.2s',
            }}
          >
            <MdSecurity size={18} />
            <span>{loading ? 'Generating Session...' : 'Connect WhatsApp (Chat-to-Pay)'}</span>
          </button>
        </div>
      )}
    </div>
  )
}
