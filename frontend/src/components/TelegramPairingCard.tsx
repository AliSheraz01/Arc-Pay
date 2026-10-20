'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { MdCheckCircle, MdAccessTime, MdSecurity, MdContentCopy, MdOpenInNew } from 'react-icons/md'

export function TelegramPairingCard() {
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
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [error, setError] = useState('')

  const botUsername = (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'EasyzpayBot').replace(/^@/, '')

  // 1. Session Persistence: Restore active session from Turso database on mount or wallet change
  useEffect(() => {
    if (!address) {
      setSessionData(null)
      setIsCheckingSession(false)
      return
    }

    let isMounted = true
    const currentAddress = address
    async function loadActiveSession() {
      setIsCheckingSession(true)
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
      } finally {
        if (isMounted) setIsCheckingSession(false)
      }
    }

    loadActiveSession()
    return () => {
      isMounted = false
    }
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
    }, 2500)

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
      const sessionPrivateKey = generatePrivateKey()
      const sessionAccount = privateKeyToAccount(sessionPrivateKey)
      const sessionPublicKey = sessionAccount.address

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
      const link =
        data.telegramDeepLink || `https://t.me/${botUsername}?start=${data.pairingToken}`
      setDeepLink(link)
    } catch (err: any) {
      console.error('Pairing error:', err)
      setError(err.message || 'Failed to initiate pairing')
    } finally {
      setLoading(false)
    }
  }

  function handleCopy() {
    if (!pairingToken) return
    navigator.clipboard.writeText('PAIR ' + pairingToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const TelegramIcon = ({ size = 20 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.05-.2-.06-.05-.16-.03-.23-.02-.1.02-1.68 1.07-4.74 3.14-.45.31-.86.46-1.22.45-.4-.01-1.18-.23-1.75-.41-.7-.23-1.26-.35-1.21-.74.03-.2.3-.41.83-.63 3.26-1.42 5.44-2.35 6.54-2.8 3.12-1.29 3.77-1.51 4.2-.1.52.01.17.03.35.03.35z" />
    </svg>
  )

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '24px',
        padding: '28px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              background: 'rgba(34, 158, 217, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#229ED9',
            }}
          >
            <TelegramIcon size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Telegram Chat to Pay
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Official Telegram Bot API • Unlimited Worldwide
            </span>
          </div>
        </div>

        <span
          style={{
            fontSize: '11px',
            fontWeight: 800,
            color: sessionData?.paired ? '#229ED9' : 'var(--accent)',
            background: sessionData?.paired ? 'rgba(34, 158, 217, 0.12)' : 'var(--accent-glow)',
            padding: '4px 10px',
            borderRadius: '12px',
          }}
        >
          {sessionData?.paired ? '● PAIRED (TELEGRAM)' : 'ERC-4337 READY'}
        </span>
      </div>

      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.5, marginBottom: '20px' }}>
        Send USDC instantly on Arc Chain using Telegram. Protected by delegated Session Keys, daily spending caps, and two-step confirmation.
      </p>

      {isCheckingSession && address ? (
        <div
          style={{
            background: 'var(--surface-raised)',
            borderRadius: '16px',
            padding: '24px',
            textAlign: 'center',
            color: 'var(--text-secondary)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <MdAccessTime size={16} className="shimmer-rotate" />
          <span>Syncing Telegram session status with Arc Network...</span>
        </div>
      ) : sessionData?.paired ? (
        <div
          style={{
            background: 'var(--surface-raised)',
            border: '1px solid rgba(34, 158, 217, 0.3)',
            borderRadius: '16px',
            padding: '20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#229ED9',
              fontWeight: 800,
              marginBottom: '12px',
            }}
          >
            <MdCheckCircle size={20} />
            <span>Connected with Telegram ({sessionData.phoneId})</span>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              fontSize: '13px',
              color: 'var(--text-secondary)',
              marginBottom: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Daily Spending Cap:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{sessionData.spendingLimit} USDC</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Spent Today:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{sessionData.spentAmount || '0'} USDC</strong>
            </div>
          </div>

          <div
            style={{
              background: 'var(--surface)',
              borderRadius: '12px',
              padding: '12px',
              fontSize: '12px',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: '6px' }}>💬 Example text to send to your bot:</div>
            <code style={{ display: 'block', color: 'var(--accent)', padding: '2px 0' }}>Pay 5 USDC to @username</code>
            <code style={{ display: 'block', color: 'var(--accent)', padding: '2px 0' }}>Send 10 to 0x742d...44e</code>
            <code style={{ display: 'block', color: 'var(--accent)', padding: '2px 0' }}>/panel</code>
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
            onMouseOver={e => (e.currentTarget.style.color = 'var(--red)')}
            onMouseOut={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >
            Disconnect Telegram Session
          </button>
        </div>
      ) : pairingToken ? (
        <div
          style={{
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-accent)',
            borderRadius: '16px',
            padding: '20px',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Your 6-Character Pairing Code:
            </div>
            <div
              style={{
                fontSize: '28px',
                fontWeight: 900,
                letterSpacing: '0.1em',
                color: 'var(--accent)',
                fontFamily: 'monospace',
                margin: '8px 0',
              }}
            >
              {pairingToken}
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '8px 0 4px 0' }}>
              Send this code to Telegram Bot: <strong style={{ color: '#229ED9' }}>@{botUsername}</strong>
            </p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Send <code>PAIR {pairingToken}</code> directly or tap the 1-Tap button below:
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
                  flex: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: '#229ED9',
                  color: 'white',
                  borderRadius: '12px',
                  padding: '12px',
                  fontSize: '13px',
                  fontWeight: 800,
                  textDecoration: 'none',
                }}
              >
                <TelegramIcon size={18} />
                <span>Open Telegram (1-Tap)</span>
              </a>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              marginTop: '16px',
              color: 'var(--text-muted)',
              fontSize: '11px',
            }}
          >
            <MdAccessTime size={14} className="shimmer-rotate" />
            <span>Listening for confirmation in Telegram...</span>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  marginBottom: '6px',
                }}
              >
                Daily Cap (USDC)
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
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  marginBottom: '6px',
                }}
              >
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
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div
            style={{
              background: 'var(--surface-raised)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '12px 16px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <MdSecurity size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Funds remain in your wallet. The bot can only transfer up to your daily cap with 2-step confirmation.
            </span>
          </div>

          {error && (
            <div style={{ color: 'var(--red)', fontSize: '12px', marginBottom: '12px' }}>
              ⚠️ {error}
            </div>
          )}

          <button
            type="button"
            disabled={loading || !address}
            onClick={handleStartPairing}
            style={{
              width: '100%',
              background: address ? 'linear-gradient(135deg, #229ED9, #0088cc)' : 'var(--border)',
              color: address ? 'white' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '14px',
              padding: '14px',
              fontSize: '14px',
              fontWeight: 800,
              cursor: address ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: address ? '0 4px 14px rgba(34, 158, 217, 0.25)' : 'none',
            }}
          >
            <TelegramIcon size={18} />
            <span>{loading ? 'Generating Code...' : 'Connect Telegram'}</span>
          </button>
        </div>
      )}
    </div>
  )
}
