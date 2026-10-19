'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useChainId, useSwitchChain } from 'wagmi'
import { 
  MdHome, 
  MdSend, 
  MdCallReceived, 
  MdHistory, 
  MdSettings, 
  MdLightMode, 
  MdDarkMode,
  MdPerson,
  MdLink,
  MdAutoAwesome,
  MdSwapHoriz,
  MdClose,
  MdCheck,
  MdChat
} from 'react-icons/md'

const SUPPORTED_NETWORKS = [
  {
    chainId: 5042,
    name: 'Arc Mainnet',
    shortName: 'Arc',
    color: '#1035f6',
    logoUrl: 'https://explorer.arc.io/favicon.ico',
  },
  {
    chainId: 8453,
    name: 'Base',
    shortName: 'Base',
    color: '#0052ff',
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png',
  },
  {
    chainId: 1,
    name: 'Ethereum',
    shortName: 'ETH',
    color: '#627eea',
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
  },
  {
    chainId: 42161,
    name: 'Arbitrum One',
    shortName: 'ARB',
    color: '#28a0f0',
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png',
  },
  {
    chainId: 10,
    name: 'OP Mainnet',
    shortName: 'OP',
    color: '#ff0420',
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png',
  },
  {
    chainId: 137,
    name: 'Polygon',
    shortName: 'POL',
    color: '#8247e5',
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png',
  },
  {
    chainId: 43114,
    name: 'Avalanche',
    shortName: 'AVAX',
    color: '#e84142',
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchex/info/logo.png',
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const [theme, setTheme] = useState<'dark' | 'light'>('light')
  const [showNetworkModal, setShowNetworkModal] = useState(false)
  const chainId = useChainId()
  const { switchChainAsync } = useSwitchChain()

  const currentNetwork = SUPPORTED_NETWORKS.find(n => n.chainId === chainId) || {
    chainId: chainId || 5042,
    name: chainId === 8453 ? 'Base' 
      : chainId === 1 ? 'Ethereum' 
      : chainId === 42161 ? 'Arbitrum One' 
      : chainId === 10 ? 'OP Mainnet' 
      : chainId === 137 ? 'Polygon' 
      : chainId === 43114 ? 'Avalanche' 
      : chainId === 5042 ? 'Arc Mainnet' 
      : chainId === 5042002 ? 'Arc Testnet' 
      : chainId ? `Chain ${chainId}` 
      : 'Arc Mainnet',
    color: chainId === 8453 ? '#0052ff' : '#1035f6',
    logoUrl: chainId === 8453 ? 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png' : undefined,
  }

  // Load theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null
    if (savedTheme) {
      setTheme(savedTheme)
      document.documentElement.setAttribute('data-theme', savedTheme)
    } else {
      document.documentElement.setAttribute('data-theme', 'light')
    }
  }, [])

  const toggleTheme = (targetTheme?: 'dark' | 'light') => {
    const nextTheme = targetTheme || (theme === 'dark' ? 'light' : 'dark')
    setTheme(nextTheme)
    localStorage.setItem('theme', nextTheme)
    document.documentElement.setAttribute('data-theme', nextTheme)
  }

  const isCrossPayEnabled = process.env.NEXT_PUBLIC_ENABLE_CROSS_PAY === 'true'

  // Custom premium geometric Payouts icon (monoline SVG)
  const PayoutsIcon = ({ size = 18 }: { size?: number }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3a9 9 0 0 0-9 9M12 21a9 9 0 0 0 9-9" />
      <path d="M21 12a9 9 0 0 0-9-9M3 12a9 9 0 0 0 9 9" />
      <path d="M16 3h5v5M8 21H3v-5" />
      <line x1="12" y1="3" x2="12" y2="9" />
      <line x1="12" y1="15" x2="12" y2="21" />
      <line x1="3" y1="12" x2="9" y2="12" />
      <line x1="15" y1="12" x2="21" y2="12" />
    </svg>
  )

  const navItems = [
    { href: '/', label: 'Home', icon: MdHome },
    { href: '/send', label: 'Send', icon: MdSend },
    { href: '/receive', label: 'Receive', icon: MdCallReceived },
    { href: '/cross-pay', label: 'Cross Pay', icon: MdLink },
    { href: '/chat-to-pay', label: 'Chat to Pay', icon: MdChat },
    { href: '/bounties', label: 'Bounties', icon: MdAutoAwesome },
    { href: '/activity', label: 'History', icon: MdHistory },
    { href: '/profile', label: 'Profile', icon: MdPerson },
    { href: '/settings', label: 'Settings', icon: MdSettings },
  ]

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="sidebar" style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}>
        <div>
          {/* Logo */}
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px', paddingLeft: '8px' }}>
            <div style={{
              width: '38px', height: '38px',
              background: 'var(--accent)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(16, 53, 246, 0.25)',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 19A8 8 0 0 1 20 19" stroke="white" strokeWidth="4.5" strokeLinecap="round" fill="none" />
              </svg>
            </div>
            <span style={{
              fontWeight: 900,
              fontSize: '22px',
              color: 'var(--accent)',
              letterSpacing: '-0.04em',
            }}>
              EasyZpay
            </span>
          </Link>

          {/* Navigation links (Ref 1: Pierre Sù capsule nav with tap bounce) */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {navItems.map(item => {
              const isActive = pathname === item.href || (item.href.startsWith('/receive?tab') && pathname === '/receive')
              const Icon = item.icon
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Bottom Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Network Switcher */}
          <button
            type="button"
            onClick={() => setShowNetworkModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--surface-raised)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '12px 16px',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              transition: 'all 0.2s',
              width: '100%',
              textAlign: 'left'
            }}
            onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent)'}
            onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Current Network
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <SidebarChainLogo chain={currentNetwork} size={18} />
                <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {currentNetwork.name}
                </span>
              </div>
            </div>
            <MdSwapHoriz size={20} style={{ color: 'var(--text-muted)' }} />
          </button>

          {/* Faucet Promo Card - Only on Arc Testnet */}
          {chainId === 5042002 && (
            <a
              href="https://faucet.circle.com"
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex',
                background: 'var(--accent-glow)',
                border: '1px solid var(--border-accent)',
                borderRadius: '16px',
                padding: '16px',
                textDecoration: 'none',
                color: 'var(--text-primary)',
                position: 'relative',
                overflow: 'hidden',
                alignItems: 'center',
                gap: '12px',
                transition: 'all 0.2s',
              }}
              onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>Need gas?</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '11px', lineHeight: 1.4, marginBottom: '6px' }}>
                  Get test tokens from
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent)', fontSize: '12px', fontWeight: 800 }}>
                  <span>Arc Faucet</span>
                  <span style={{ fontSize: '12px' }}>→</span>
                </div>
              </div>
              {/* Droplet Graphic */}
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '12px',
                background: 'rgba(16, 53, 246, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent)',
                flexShrink: 0,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
                </svg>
              </div>
            </a>
          )}

          {/* Theme switcher pill capsule */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--surface-raised)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
            padding: '4px',
            gap: '4px',
            width: '100%',
          }}>
            <button
              onClick={() => toggleTheme('light')}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: theme === 'light' ? 'var(--surface)' : 'transparent',
                border: theme === 'light' ? '1px solid var(--border)' : 'none',
                borderRadius: '16px',
                padding: '8px 12px',
                color: theme === 'light' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: theme === 'light' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              <MdLightMode size={16} style={{ color: '#f5c542' }} />
              <span>Light</span>
            </button>
            <button
              onClick={() => toggleTheme('dark')}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: theme === 'dark' ? 'var(--surface)' : 'transparent',
                border: theme === 'dark' ? '1px solid var(--border)' : 'none',
                borderRadius: '16px',
                padding: '8px 12px',
                color: theme === 'dark' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: theme === 'dark' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              <MdDarkMode size={16} style={{ color: '#7c3aed' }} />
              <span>Dark</span>
            </button>
          </div>

          <div style={{ 
            marginTop: '16px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            padding: '4px 0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img 
                src="https://unavatar.io/twitter/alisheraz0ev" 
                alt="@alisheraz0ev avatar"
                style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }}
              />
              <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500 }}>
                Built By @alisheraz0ev
              </span>
            </div>
            <a 
              href="https://x.com/alisheraz0ev" 
              target="_blank" 
              rel="noreferrer"
              style={{
                background: '#0f172a',
                color: 'white',
                fontSize: '10px',
                fontWeight: 700,
                padding: '6px 12px',
                borderRadius: '16px',
                textDecoration: 'none',
                letterSpacing: '0.05em'
              }}
            >
              FOLLOW
            </a>
          </div>
        </div>
      </aside>

      {/* Mobile Tab Bottom Navigation (Ref 2: Pinterest Fluid Pop-up Bubble) */}
      <nav className="mobile-nav">
        {navItems.map(item => {
          const isActive = pathname === item.href || (item.href.startsWith('/receive?tab') && pathname === '/receive')
          const Icon = item.icon
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`mobile-nav-item ${isActive ? 'active' : ''}`}
            >
              {/* Floating Arc Blue Bubble that pops up above nav bar */}
              <div className="mobile-nav-bubble">
                <Icon size={20} />
              </div>

              {/* Inactive Static Icon */}
              <div className="mobile-nav-static-icon">
                <Icon size={19} />
              </div>

              <span className="mobile-nav-label">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Network Switcher Modal */}
      {showNetworkModal && (
        <div 
          onClick={() => setShowNetworkModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px'
          }}
        >
          <div 
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '24px',
              maxWidth: '400px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Select Network
              </h3>
              <button
                type="button"
                onClick={() => setShowNetworkModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
              >
                <MdClose size={20} />
              </button>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 18px 0' }}>
              Switch your wallet to any supported network.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {SUPPORTED_NETWORKS.map(net => {
                const isSelected = net.chainId === chainId
                return (
                  <button
                    key={net.chainId}
                    type="button"
                    onClick={async () => {
                      setShowNetworkModal(false)
                      if (switchChainAsync && net.chainId !== chainId) {
                        try {
                          await switchChainAsync({ chainId: net.chainId })
                        } catch (err) {
                          console.error('Failed to switch chain:', err)
                        }
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderRadius: '14px',
                      background: isSelected ? 'var(--accent-glow)' : 'var(--surface-raised)',
                      border: isSelected ? '1px solid var(--border-accent)' : '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      textAlign: 'left',
                      width: '100%'
                    }}
                    onMouseOver={e => {
                      if (!isSelected) e.currentTarget.style.borderColor = 'var(--accent)'
                    }}
                    onMouseOut={e => {
                      if (!isSelected) e.currentTarget.style.borderColor = 'var(--border)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <SidebarChainLogo chain={net} size={22} />
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {net.name}
                      </span>
                    </div>

                    {isSelected && (
                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        fontWeight: 800,
                        color: 'var(--green)',
                        background: 'rgba(0, 212, 168, 0.1)',
                        padding: '3px 8px',
                        borderRadius: '8px'
                      }}>
                        <MdCheck size={14} /> Connected
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function SidebarChainLogo({ chain, size = 18 }: { chain: { chainId: number; name: string; color?: string; logoUrl?: string }; size?: number }) {
  const [imgError, setImgError] = useState(false)

  if (chain.chainId === 5042 || chain.chainId === 5042002) {
    return (
      <div style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#1035f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
          <path d="M4 19A8 8 0 0 1 20 19" stroke="white" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        </svg>
      </div>
    )
  }

  if (chain.logoUrl && !imgError) {
    return (
      <img
        src={chain.logoUrl}
        alt={chain.name}
        onError={() => setImgError(true)}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }

  return (
    <span style={{ width: size, height: size, borderRadius: '50%', background: chain.color || '#3b82f6', flexShrink: 0, display: 'inline-block' }} />
  )
}
