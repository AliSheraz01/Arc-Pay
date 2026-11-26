'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useChainId, useSwitchChain } from 'wagmi'
import {
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
    logoUrl: '/logos/arc-mark.svg',
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
  { href: '/send', label: 'Send', icon: MdSend },
  { href: '/receive', label: 'Receive', icon: MdCallReceived },
  { href: '/cross-pay', label: 'Cross Pay', icon: MdLink },
  { href: '/chat-to-pay', label: 'Chat to Pay', icon: MdChat },
  { href: '/bounties', label: 'Bounties', icon: MdAutoAwesome },
  { href: '/activity', label: 'History', icon: MdHistory },
  { href: '/profile', label: 'Profile', icon: MdPerson },
  { href: '/settings', label: 'Settings', icon: MdSettings },
]

export function EasyZpayArchMark({ size = 32 }: { size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        background: 'var(--blue)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg
        width={Math.round(size * 0.68)}
        height={Math.round(size * 0.34)}
        viewBox="0 0 120 60"
        fill="none"
        aria-hidden="true"
      >
        <path d="M0 60A60 60 0 0 1 120 60L88 60A28 28 0 0 0 32 60Z" fill="#FFFFFF" />
      </svg>
    </span>
  )
}

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
    logoUrl: chainId === 8453 ? '/logos/base.svg' : '/logos/arc-mark.svg',
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
              <EasyZpayArchMark size={32} />
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

          {/* Navigation links: Send, Receive, Cross Pay, Chat to Pay, Bounties, History, Profile, Settings */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {SIDEBAR_NAV_ITEMS.map((item, idx) => {
              const isActive = pathname === item.href
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
                  <Icon size={18} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
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
              <MdLightMode size={15} style={{ color: '#D97706' }} />
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

      {!drawerMode && (
        <MobileGlassBar
          visible={true}
          theme={theme}
          onToggleTheme={toggleTheme}
          onNavigate={onNavigate}
        />
      )}

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
