'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
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
  MdChat,
} from 'react-icons/md'
import { LoginButton } from './LoginButton'
import { MobileGlassBar } from './MobileGlassBar'

const SUPPORTED_NETWORKS = [
  {
    chainId: 5042,
    name: 'Arc Mainnet',
    shortName: 'Arc',
    color: '#2B5BFF',
    logoUrl: '/assets/arc-logo.jpg',
  },
  {
    chainId: 8453,
    name: 'Base',
    shortName: 'Base',
    color: '#0052ff',
    logoUrl: '/logos/base.svg',
  },
  {
    chainId: 1,
    name: 'Ethereum',
    shortName: 'ETH',
    color: '#627eea',
    logoUrl: '/logos/ethereum.svg',
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
    logoUrl: '/logos/optimism.svg',
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

export const SIDEBAR_NAV_ITEMS = [
  { href: '/app', label: 'Home', icon: MdHome, color: '#2B5BFF' },
  { href: '/send', label: 'Send', icon: MdSend, color: '#1DB954' },
  { href: '/receive', label: 'Receive', icon: MdCallReceived, color: '#F5B800' },
  { href: '/cross-pay', label: 'Cross Pay', icon: MdLink, color: '#8B5CF6' },
  { href: '/chat-to-pay', label: 'Chat to Pay', icon: MdChat, color: '#06B6D4' },
  { href: '/bounties', label: 'Bounties', icon: MdAutoAwesome, color: '#F97316' },
  { href: '/activity', label: 'History', icon: MdHistory, color: '#64748B' },
  { href: '/profile', label: 'Profile', icon: MdPerson, color: '#EC4899' },
  { href: '/settings', label: 'Settings', icon: MdSettings, color: '#475569' },
]

interface SidebarProps {
  drawerMode?: boolean
  isOpen?: boolean
  onClose?: () => void
  onNavigate?: (href: string) => void
}

export function Sidebar({
  drawerMode = false,
  isOpen = true,
  onClose,
  onNavigate,
}: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [theme, setTheme] = useState<'dark' | 'light'>('light')
  const [showNetworkModal, setShowNetworkModal] = useState(false)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const chainId = useChainId()
  const { switchChainAsync } = useSwitchChain()

  const currentNetwork = SUPPORTED_NETWORKS.find((n) => n.chainId === chainId) || {
    chainId: chainId || 5042,
    name:
      chainId === 8453
        ? 'Base'
        : chainId === 1
        ? 'Ethereum'
        : chainId === 42161
        ? 'Arbitrum One'
        : chainId === 10
        ? 'OP Mainnet'
        : chainId === 137
        ? 'Polygon'
        : chainId === 43114
        ? 'Avalanche'
        : chainId === 5042
        ? 'Arc Mainnet'
        : chainId === 5042002
        ? 'Arc Testnet'
        : chainId
        ? `Chain ${chainId}`
        : 'Arc Mainnet',
    color: chainId === 8453 ? '#0052ff' : '#2B5BFF',
    logoUrl: chainId === 8453 ? '/logos/base.svg' : '/assets/arc-logo.jpg',
  }

  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'dark' | 'light' | null
    const prefersDark =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    const resolved = saved || (prefersDark ? 'dark' : 'light')
    setTheme(resolved)
    document.documentElement.setAttribute('data-theme', resolved)
  }, [])

  const toggleTheme = (targetTheme: 'dark' | 'light') => {
    setTheme(targetTheme)
    localStorage.setItem('theme', targetTheme)
    document.documentElement.setAttribute('data-theme', targetTheme)
  }

  // Focus & Escape handling when used as a slide-in drawer on desktop "/"
  useEffect(() => {
    if (!drawerMode) return
    if (isOpen) {
      closeBtnRef.current?.focus()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && onClose) {
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [drawerMode, isOpen, onClose])

  const handleItemClick = (e: React.MouseEvent, href: string) => {
    if (onNavigate) {
      e.preventDefault()
      onNavigate(href)
      router.push(href)
    } else if (onClose) {
      onClose()
    }
  }

  return (
    <>
      {/* Scrim when drawerMode is active */}
      {drawerMode && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--scrim)',
            opacity: isOpen ? 1 : 0,
            pointerEvents: isOpen ? 'auto' : 'none',
            transition: 'opacity 0.35s ease',
            zIndex: 98,
          }}
        />
      )}

      {/* Desktop Sidebar (Real component used both docked in /app and as slide-in on /) */}
      <aside
        id="app-sidebar"
        aria-label="Dashboard"
        className={`sidebar ${drawerMode && isOpen ? 'drawer-open' : ''}`}
        {...(drawerMode && !isOpen ? { inert: true as unknown as boolean } : {})}
        style={{
          background: 'var(--panel)',
          borderRight: '1px solid var(--line)',
          width: drawerMode ? 'min(330px, 88vw)' : undefined,
          transform: drawerMode
            ? isOpen
              ? 'translateX(0)'
              : 'translateX(-102%)'
            : undefined,
          zIndex: drawerMode ? 120 : 99,
        }}
      >
        <div>
          {/* Logo + Close button in drawer mode */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: drawerMode ? '14px' : '28px',
              paddingLeft: '4px',
            }}
          >
            <Link
              href="/"
              onClick={(e) => handleItemClick(e, '/')}
              style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <img
                src="/assets/easyzpay-logo.jpg"
                alt="EasyZpay"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  objectFit: 'cover',
                }}
              />
              <span
                style={{
                  fontWeight: 700,
                  fontSize: '20px',
                  color: 'var(--ink)',
                  letterSpacing: '-0.03em',
                }}
              >
                EasyZpay
              </span>
            </Link>

            {drawerMode && onClose && (
              <button
                ref={closeBtnRef}
                type="button"
                onClick={onClose}
                aria-label="Close dashboard"
                style={{
                  background: 'none',
                  border: '1px solid var(--line)',
                  color: 'var(--ink)',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <MdClose size={18} />
              </button>
            )}
          </div>

          {/* Live Network Status */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              color: 'var(--muted)',
              padding: '0 4px 10px',
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#1DB954',
                display: 'inline-block',
              }}
            />
            <span>{currentNetwork.name}</span>
          </div>

          {/* Connect Wallet button inside drawer mode */}
          {drawerMode && (
            <div
              className="drawer-stagger-item"
              style={{
                marginBottom: '12px',
                ['--stagger-i' as string]: 0,
              }}
            >
              <LoginButton />
            </div>
          )}

          {/* Navigation links */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {SIDEBAR_NAV_ITEMS.map((item, idx) => {
              const isActive =
                pathname === item.href ||
                (item.href === '/app' && pathname === '/app')
              const Icon = item.icon
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={(e) => handleItemClick(e, item.href)}
                  className={`sidebar-nav-item ${isActive ? 'active' : ''} ${
                    drawerMode ? 'drawer-stagger-item' : ''
                  }`}
                  style={
                    drawerMode
                      ? ({ ['--stagger-i' as string]: idx + 1 } as React.CSSProperties)
                      : undefined
                  }
                >
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: isActive ? 'var(--blue-ink)' : item.color,
                      flexShrink: 0,
                    }}
                  />
                  <Icon size={18} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Bottom Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
          {/* Network Switcher */}
          <button
            type="button"
            onClick={() => setShowNetworkModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--soft)',
              border: '1px solid var(--line)',
              borderRadius: '16px',
              padding: '12px 14px',
              cursor: 'pointer',
              color: 'var(--ink)',
              transition: 'all 0.2s',
              width: '100%',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--muted)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Network
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <SidebarChainLogo chain={currentNetwork} size={18} />
                <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--ink)' }}>
                  {currentNetwork.name}
                </span>
              </div>
            </div>
            <MdSwapHoriz size={20} style={{ color: 'var(--muted)' }} />
          </button>

          {/* Theme switcher pill capsule */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--soft)',
              border: '1px solid var(--line)',
              borderRadius: '999px',
              padding: '4px',
              gap: '4px',
              width: '100%',
            }}
          >
            <button
              type="button"
              onClick={() => toggleTheme('light')}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                background: theme === 'light' ? 'var(--panel)' : 'transparent',
                border: 'none',
                borderRadius: '999px',
                padding: '8px 12px',
                color: theme === 'light' ? 'var(--ink)' : 'var(--muted)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: theme === 'light' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              <MdLightMode size={15} style={{ color: '#f5c542' }} />
              <span>Light</span>
            </button>
            <button
              type="button"
              onClick={() => toggleTheme('dark')}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                background: theme === 'dark' ? 'var(--panel)' : 'transparent',
                border: 'none',
                borderRadius: '999px',
                padding: '8px 12px',
                color: theme === 'dark' ? 'var(--ink)' : 'var(--muted)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: theme === 'dark' ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              <MdDarkMode size={15} style={{ color: '#6C8CFF' }} />
              <span>Dark</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Glass Bottom Tab Bar (visible on all app pages below 768px) */}
      {!drawerMode && (
        <MobileGlassBar
          visible={true}
          theme={theme}
          onToggleTheme={toggleTheme}
          onNavigate={onNavigate}
        />
      )}

      {/* Network Switcher Modal */}
      {showNetworkModal && (
        <div
          onClick={() => setShowNetworkModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--scrim)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--panel)',
              border: '1px solid var(--line)',
              borderRadius: '24px',
              maxWidth: '400px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
                Select Network
              </h3>
              <button
                type="button"
                onClick={() => setShowNetworkModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '4px' }}
              >
                <MdClose size={20} />
              </button>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '0 0 18px 0' }}>
              Switch your wallet to any supported network.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {SUPPORTED_NETWORKS.map((net) => {
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
                      borderRadius: '16px',
                      background: isSelected ? 'var(--accent-glow)' : 'var(--soft)',
                      border: isSelected ? '1px solid var(--blue)' : '1px solid transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <SidebarChainLogo chain={net} size={22} />
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>
                        {net.name}
                      </span>
                    </div>

                    {isSelected && (
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: 'var(--green)',
                          background: 'var(--green-glow)',
                          padding: '3px 8px',
                          borderRadius: '999px',
                        }}
                      >
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

      <style jsx global>{`
        .sidebar.drawer-open .drawer-stagger-item {
          animation: sidebar-slide-in 0.55s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
          animation-delay: calc(0.12s + var(--stagger-i, 0) * 65ms);
          opacity: 0;
          transform: translateX(-40px);
        }
        @keyframes sidebar-slide-in {
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  )
}

function SidebarChainLogo({
  chain,
  size = 18,
}: {
  chain: { chainId: number; name: string; color?: string; logoUrl?: string }
  size?: number
}) {
  const [imgError, setImgError] = useState(false)

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
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: chain.color || '#2B5BFF',
        flexShrink: 0,
        display: 'inline-block',
      }}
    />
  )
}
