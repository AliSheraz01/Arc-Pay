'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Sidebar, EasyZpayArchMark } from '@/components/Sidebar'
import { MobileGlassBar } from '@/components/MobileGlassBar'

const HEADLINE_WORDS = [
  'Pay',
  'anyone',
  'by',
  'username,',
  'on',
  'the',
  'web',
  'or',
  'Telegram.',
]

export default function HomePage() {
  const router = useRouter()
  const visRef = useRef<HTMLElement>(null)
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [visIn, setVisIn] = useState(false)
  const [desktopDrawerOpen, setDesktopDrawerOpen] = useState(false)
  const [mobileBarOpen, setMobileBarOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'dark' | 'light' | null
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const resolved = saved || (prefersDark ? 'dark' : 'light')
    setTheme(resolved)
    document.documentElement.setAttribute('data-theme', resolved)
  }, [])

  const handleToggleTheme = (next: 'light' | 'dark') => {
    setTheme(next)
    localStorage.setItem('theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  // IntersectionObserver reveal for the blue visual panel below the first screen
  useEffect(() => {
    const el = visRef.current
    if (!el) return
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setVisIn(true)
              io.disconnect()
            }
          })
        },
        { threshold: 0.12 }
      )
      io.observe(el)
      return () => io.disconnect()
    } else {
      setVisIn(true)
    }
  }, [])

  // Pointer parallax on the blue visual panel (respects prefers-reduced-motion)
  useEffect(() => {
    const el = visRef.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      el.style.setProperty('--mx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3))
      el.style.setProperty('--my', ((e.clientY - r.top) / r.height - 0.5).toFixed(3))
    }
    el.addEventListener('pointermove', onMove)
    return () => el.removeEventListener('pointermove', onMove)
  }, [])

  useEffect(() => {
    return () => {
      if (navTimerRef.current) clearTimeout(navTimerRef.current)
    }
  }, [])

  const handleLaunchApp = () => {
    const isMobile = window.innerWidth < 768
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (navTimerRef.current) clearTimeout(navTimerRef.current)

    if (isMobile) {
      // A4: Mobile (<768px) — floating pill glass tab bar rises from bottom, then navigate client-side to /send
      setMobileBarOpen(true)
      navTimerRef.current = setTimeout(
        () => {
          router.push('/send')
        },
        reduced ? 150 : 750
      )
    } else {
      // A3: Desktop — real Sidebar slides in from the left, tabs float in one by one, then navigate client-side to /send
      setDesktopDrawerOpen(true)
      navTimerRef.current = setTimeout(
        () => {
          router.push('/send')
        },
        reduced ? 150 : 1050
      )
    }
  }

  const handleCloseDrawer = () => {
    if (navTimerRef.current) clearTimeout(navTimerRef.current)
    setDesktopDrawerOpen(false)
  }

  const handleDrawerNavigate = () => {
    if (navTimerRef.current) clearTimeout(navTimerRef.current)
    setDesktopDrawerOpen(false)
  }

  return (
    <div className="v4-root">
      <div className="v4-panel">
        {/* First Screen (order: 1, 100svh centered) */}
        <div className="v4-right">
          <header className="v4-header">
            <Link href="/" className="v4-logo">
              <EasyZpayArchMark size={30} />
              <span>EasyZpay</span>
            </Link>

            <button
              type="button"
              className="v4-top"
              onClick={handleLaunchApp}
              aria-controls="app-sidebar"
              aria-expanded={desktopDrawerOpen}
            >
              Launch App
            </button>
          </header>

          <div className="v4-copy">
            <h1 className="v4-h1" aria-label="Pay anyone by username, on the web or Telegram.">
              {HEADLINE_WORDS.map((word, idx) => (
                <React.Fragment key={word + idx}>
                  <span className="v4-w">
                    <span style={{ ['--i' as string]: idx }}>{word}</span>
                  </span>
                  {idx < HEADLINE_WORDS.length - 1 ? ' ' : ''}
                </React.Fragment>
              ))}
            </h1>

            <p className="v4-sub">
              Send USDC on Arc Network with a username instead of a 42-character wallet address. Works in the app and in our Telegram bot.
            </p>

            <div className="v4-cta">
              <button
                type="button"
                className="v4-btn v4-primary"
                onClick={handleLaunchApp}
                aria-controls="app-sidebar"
                aria-expanded={desktopDrawerOpen}
              >
                Launch App
              </button>
              <Link className="v4-btn v4-ghost" href="/docs">
                Read Docs
              </Link>
            </div>

            <div className="v4-arc">
              <span>Native on</span>
              <img alt="Arc Network" src="/assets/arc-logo.jpg" />
            </div>

            <div className="v4-social-links">
              <a
                href="https://t.me/EasyZpayBot"
                target="_blank"
                rel="noreferrer"
                className="v4-social-pill"
              >
                <img src="/logos/telegram.svg" alt="Telegram" width={18} height={18} />
                <span>Telegram Bot</span>
              </a>
              <a
                href="https://x.com/easyzpay"
                target="_blank"
                rel="noreferrer"
                className="v4-social-pill"
                aria-label="EasyZpay on X"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                <span>@easyzpay</span>
              </a>
            </div>
          </div>

          <div className="v4-stats">
            <div>
              Sub-second<small>Finality on Arc</small>
            </div>
            <hr />
            <div>
              Near-zero<small>Gas fees</small>
            </div>
          </div>
          <div className="v4-hint" aria-hidden="true">
            Scroll ↓
          </div>
        </div>

        {/* Blue Visual Panel BELOW first screen (order: 2, reveals on scroll via IntersectionObserver) */}
        <section
          ref={visRef}
          className={`v4-visual ${visIn ? 'in' : ''}`}
          aria-hidden="true"
        >
          <div className="v4-o v4-ring v4-r1" style={{ ['--d' as string]: -12 }}>
            <div className="v4-f" style={{ ['--t' as string]: '8s' }} />
          </div>
          <div className="v4-o v4-ring v4-r2" style={{ ['--d' as string]: 14 }} />
          <div className="v4-o v4-coin v4-chk" style={{ ['--d' as string]: -18 }}>
            <div className="v4-f" style={{ ['--t' as string]: '5s' }}>
              ✓
            </div>
          </div>
          <div className="v4-o v4-coin v4-dot" style={{ ['--d' as string]: 16 }}>
            <div className="v4-f" style={{ ['--t' as string]: '7s', ['--dl' as string]: '-1s' }}>
              <img alt="USDC" src="/logos/usdc.svg" style={{ width: '100%', height: '100%', display: 'block' }} />
            </div>
          </div>
          <div className="v4-o v4-coin v4-usdc" style={{ ['--d' as string]: 22 }}>
            <img alt="USDC" src="/logos/usdc.svg" style={{ width: '100%', height: '100%', display: 'block' }} />
          </div>
          <div className="v4-o v4-glass" style={{ ['--d' as string]: -20 }}>
            <div className="v4-f" style={{ ['--t' as string]: '6s', ['--dl' as string]: '-3s' }} />
          </div>

          <div className="v4-o v4-phone" style={{ ['--d' as string]: 8 }}>
            <div className="v4-f" style={{ ['--t' as string]: '7s' }}>
              <h3>Pay by username</h3>
              <div className="v4-row">
                <em>To</em>
                <span>
                  @<span className="v4-typed">ali</span>
                </span>
              </div>
              <div className="v4-row">
                <em>Amount</em>
                <span>50 USDC</span>
              </div>
              <div className="v4-send">Send</div>
              <div className="v4-cards">
                <b />
                <b />
                <b />
              </div>
              <div className="v4-done">
                <div>
                  <span>✓</span>50 USDC sent to @ali
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer Strip (order: 3) */}
        <footer className="v4-footer">
          <span>EasyZpay &mdash; USDC payments on Arc Network</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Link href="/docs" style={{ color: 'var(--ink)', textDecoration: 'none', fontWeight: 500 }}>
              Docs
            </Link>
            <a
              href="https://t.me/EasyZpayBot"
              target="_blank"
              rel="noreferrer"
              aria-label="EasyZpay Telegram Bot"
              style={{ display: 'inline-flex', alignItems: 'center' }}
            >
              <img src="/logos/telegram.svg" alt="Telegram" width={18} height={18} />
            </a>
            <a
              href="https://x.com/easyzpay"
              target="_blank"
              rel="noreferrer"
              aria-label="EasyZpay on X"
              style={{ color: 'var(--ink)', display: 'inline-flex', alignItems: 'center' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>
        </footer>
      </div>

      {/* A3: Desktop Real Sidebar Slide-In */}
      <Sidebar
        drawerMode={true}
        isOpen={desktopDrawerOpen}
        onClose={handleCloseDrawer}
        onNavigate={handleDrawerNavigate}
      />

      {/* A4: Mobile Floating Pill Glass Tab Bar */}
      <MobileGlassBar
        visible={mobileBarOpen}
        animateEntrance={true}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onNavigate={() => {
          if (navTimerRef.current) clearTimeout(navTimerRef.current)
        }}
      />
    </div>
  )
}
