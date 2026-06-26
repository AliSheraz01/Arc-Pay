'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
} from 'react-icons/md'

export function Sidebar() {
  const pathname = usePathname()
  const [theme, setTheme] = useState<'dark' | 'light'>('light')

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

  const navItems = [
    { href: '/', label: 'Home', icon: MdHome },
    { href: '/send', label: 'Send', icon: MdSend },
    { href: '/receive', label: 'Receive', icon: MdCallReceived },
    ...(isCrossPayEnabled
      ? [
          { href: '/cross-pay', label: 'Cross Pay', icon: MdAutoAwesome }
        ]
      : [{ href: '/history', label: 'Transactions', icon: MdHistory }]
    ),
    { href: '/profile', label: 'Profile', icon: MdPerson },
    { href: '/receive?tab=request', label: 'Payment Links', icon: MdLink },
    { href: '/agent', label: 'AI Pay', icon: MdAutoAwesome },
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

          {/* Navigation links */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {navItems.map(item => {
              const isActive = pathname === item.href || (item.href.startsWith('/receive?tab') && pathname === '/receive')
              const Icon = item.icon
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                    background: isActive ? 'var(--accent-glow)' : 'transparent',
                    textDecoration: 'none',
                    fontSize: '14px',
                    fontWeight: 700,
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: isActive ? '1px solid var(--border-accent)' : '1px solid transparent',
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={e => {
                    if (!isActive) {
                      e.currentTarget.style.color = 'var(--text-primary)'
                      e.currentTarget.style.background = 'var(--surface-raised)'
                    }
                  }}
                  onMouseOut={e => {
                    if (!isActive) {
                      e.currentTarget.style.color = 'var(--text-secondary)'
                      e.currentTarget.style.background = 'transparent'
                    }
                  }}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Bottom Panel */}
        <div>
          {/* Faucet Promo Card */}
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
              marginBottom: '16px',
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

      {/* Mobile Tab Bottom Navigation */}
      <nav className="mobile-nav" style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
        {navItems.slice(0, 4).concat(navItems.slice(-2)).map(item => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.label}
              href={item.href}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                textDecoration: 'none',
                fontSize: '10px',
                fontWeight: 700,
                width: '50px',
                height: '100%',
                transition: 'all 0.2s',
              }}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
