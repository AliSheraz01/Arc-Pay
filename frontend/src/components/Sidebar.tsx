'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  Home, 
  Send, 
  Download, 
  History, 
  Settings, 
  Sun, 
  Moon,
  UserCircle,
} from 'lucide-react'

export function Sidebar() {
  const pathname = usePathname()
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  // Load theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null
    if (savedTheme) {
      setTheme(savedTheme)
      document.documentElement.setAttribute('data-theme', savedTheme)
    } else {
      document.documentElement.setAttribute('data-theme', 'dark')
    }
  }, [])

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    localStorage.setItem('theme', nextTheme)
    document.documentElement.setAttribute('data-theme', nextTheme)
  }

  const navItems = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/send', label: 'Send', icon: Send },
    { href: '/receive', label: 'Receive', icon: Download },
    { href: '/history', label: 'Transactions', icon: History },
    { href: '/profile', label: 'Profile', icon: UserCircle },
    { href: '/settings', label: 'Settings', icon: Settings },
  ]

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="sidebar">
        <div>
          {/* Logo */}
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
            <div style={{
              width: '36px', height: '36px',
              background: 'linear-gradient(135deg, #7c3aed, #9f5aff)',
              borderRadius: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '18px', color: 'white',
              boxShadow: '0 0 16px #7c3aed40',
            }}>
              ⚡
            </div>
            <span style={{
              fontWeight: 900,
              fontSize: '20px',
              background: 'linear-gradient(135deg, #9f5aff, #00d4a8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '-0.03em',
            }}>
              Arc Pay
            </span>
          </Link>

          {/* Network Indicator */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'var(--surface-raised)', border: '1px solid var(--border)',
            borderRadius: '12px', padding: '8px 12px', marginBottom: '24px',
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />
            <span style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>Live on Arc Testnet</span>
          </div>

          {/* Navigation links */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {navItems.map(item => {
              const isActive = pathname === item.href
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
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
          <div style={{
            background: 'var(--accent-glow)',
            border: '1px solid var(--border-accent)',
            borderRadius: '16px',
            padding: '16px',
            marginBottom: '16px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>💧</div>
            <h4 style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 800, marginBottom: '4px' }}>Need gas?</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', lineHeight: 1.4, marginBottom: '10px' }}>
              Get free test tokens from Circle faucet
            </p>
            <a 
              href="https://faucet.circle.com" 
              target="_blank" 
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                color: 'var(--accent)',
                fontSize: '12px',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              Arc Faucet →
            </a>
          </div>

          {/* Theme switcher */}
          <button
            onClick={toggleTheme}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              background: 'var(--surface-raised)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '12px',
              color: 'var(--text-primary)',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent)'}
            onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            {theme === 'dark' ? (
              <>
                <Sun size={16} style={{ color: '#f5c542' }} />
                <span>Light Mode</span>
              </>
            ) : (
              <>
                <Moon size={16} style={{ color: '#7c3aed' }} />
                <span>Dark Mode</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile Tab Bottom Navigation */}
      <nav className="mobile-nav">
        {navItems.map(item => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
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
