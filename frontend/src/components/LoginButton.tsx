'use client'

import { usePrivy } from '@privy-io/react-auth'

export function LoginButton() {
  const { login, logout, ready, authenticated, user } = usePrivy()

  if (!ready) {
    return (
      <button 
        disabled
        style={{
          background: 'var(--surface-raised)',
          color: 'var(--text-muted)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '8px 16px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'not-allowed',
        }}
      >
        Loading...
      </button>
    )
  }

  if (authenticated) {
    const displayName = 
      user?.google?.email || 
      user?.email?.address || 
      (user?.wallet?.address 
        ? `${user.wallet.address.slice(0, 6)}...${user.wallet.address.slice(-4)}`
        : 'Connected')

    return (
      <button 
        onClick={logout}
        style={{
          background: 'var(--surface-raised)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '8px 16px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'all 0.2s ease',
        }}
        className="hover-disconnect"
      >
        <span>{displayName}</span>
        <span className="disconnect-label" style={{ fontSize: '10px', opacity: 0.6 }}>(Disconnect)</span>

        <style jsx>{`
          .hover-disconnect {
            transition: border-color 0.2s, color 0.2s;
          }
          .hover-disconnect:hover {
            border-color: var(--red) !important;
            color: var(--red) !important;
          }
        `}</style>
      </button>
    )
  }

  return (
    <button 
      onClick={login}
      style={{
        background: 'var(--accent)',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        padding: '8px 20px',
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'pointer',
        boxShadow: '0 0 16px var(--accent-glow)',
        transition: 'all 0.2s ease',
      }}
      className="btn-connect"
    >
      Connect Wallet

      <style jsx>{`
        .btn-connect {
          transition: background 0.2s, transform 0.2s;
        }
        .btn-connect:hover {
          background: var(--accent-bright) !important;
          transform: translateY(-1px);
        }
        .btn-connect:active {
          transform: translateY(0);
        }
      `}</style>
    </button>
  )
}
