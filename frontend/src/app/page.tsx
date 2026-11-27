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
              <svg
                width="82"
                height="26"
                viewBox="0 0 210 64"
                fill="none"
                aria-label="Arc Network"
                style={{ display: 'block', color: 'var(--ink)' }}
              >
                <path
                  d="M8 54C11 25 22 10 34 10C46 10 57 25 60 54C54.5 50.5 48 48.5 40 48.5H27.5V40.5H45.5C43.5 27 39 19.5 34 19.5C28 19.5 22 30 19.5 54H8Z"
                  fill="currentColor"
                />
                <text
                  x="74"
                  y="52"
                  fill="currentColor"
                  fontFamily="var(--font)"
                  fontSize="48"
                  fontWeight="500"
                  letterSpacing="-1.5"
                >
                  Arc
                </text>
              </svg>
            </div>

            <div className="v4-social-links">
              <a
                href="https://t.me/EasyZpayBot"
                target="_blank"
                rel="noreferrer"
                className="v4-social-pill"
              >
                <svg width="18" height="18" viewBox="0 0 240 240" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
                  <circle cx="120" cy="120" r="120" fill="#2AABEE" />
                  <path d="M98 175c-3.9 0-3.2-1.5-4.6-5.2L79 123.6l107-63.6" fill="#c8daea" />
                  <path d="M98 175c3 0 4.3-1.4 6-3l16-15.6-20-12" fill="#a9c9dd" />
                  <path d="M100 144.4l48.4 35.7c5.5 3 9.5 1.5 10.9-5.1L179 66.8c2-8-3-11.7-8.3-9.3L22.2 113.6c-7.8 3.1-7.7 7.5-1.4 9.5l38.2 11.9 88.5-55.8c4.2-2.5 8-.9 4.9 1.9" fill="#ffffff" />
                </svg>
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
            <div className="v4-f" style={{ ['--t' as string]: '7s', ['--dl' as string]: '-1s', width: '100%', height: '100%' }}>
              <svg viewBox="0 0 2000 2000" aria-hidden="true" style={{ width: '100%', height: '100%', display: 'block' }}>
                <circle cx="1000" cy="1000" r="1000" fill="#2775CA" />
                <path d="M1275 1158.33c0-145.83-87.5-195.83-262.5-216.66-116.67-16.67-137.5-50-137.5-108.34 0-62.5 45.83-95.83 125-95.83 70.83 0 116.67 25 137.5 75 4.17 12.5 16.67 16.67 29.17 12.5l70.83-29.17c8.33-4.16 12.5-12.5 8.33-20.83-29.16-75-95.83-125-187.5-137.5V541.67c0-12.5-8.33-20.84-20.83-20.84h-58.34c-12.5 0-20.83 8.34-20.83 20.84v95.83c-112.5 16.67-183.33 91.67-183.33 195.83 0 137.5 83.33 191.67 258.33 212.5 116.67 20.84 141.67 54.17 141.67 112.5 0 75-58.34 116.67-141.67 116.67-95.83 0-145.83-41.67-170.83-104.17-4.17-8.33-12.5-12.5-25-12.5l-75 29.17c-8.34 4.16-12.5 12.5-8.34 20.83 29.17 87.5 95.84 145.83 216.67 166.67v95.83c0 12.5 8.33 20.83 20.83 20.83h58.34c12.5 0 20.83-8.33 20.83-20.83v-95.83c116.67-16.67 191.67-91.67 191.67-208.34z" fill="#FFF" />
                <path d="M787.5 1595.83c-325-116.66-479.17-475-354.17-800 70.84-187.5 216.67-333.33 404.17-404.16 12.5-4.17 16.67-16.67 12.5-29.17l-25-66.67c-4.17-12.5-16.67-16.66-29.17-12.5-212.5 79.17-379.16 245.84-458.33 458.34-141.67 366.66 33.33 775 400 916.66 179.17 70.84 379.17 41.67 537.5-62.5 8.33-8.33 12.5-20.83 4.17-29.16l-50-58.34c-8.34-8.33-20.84-8.33-29.17 0-125 79.17-283.33 104.17-412.5 87.5z" fill="#FFF" />
                <path d="M1654.17 791.67c-70.84-187.5-216.67-333.34-404.17-404.17-12.5-4.17-16.67 4.17-20.83 12.5l-29.17 70.83c-4.17 8.34 0 20.84 12.5 25 150 58.34 266.67 175 325 325 141.67 366.67-33.33 775-400 916.67-179.17 70.83-379.17 41.67-537.5-62.5-8.33-4.17-20.83-4.17-29.17 4.16l-50 58.34c-8.33 8.33-4.16 20.83 4.17 29.16 195.83 129.17 441.67 162.5 666.67 75 362.5-141.66 537.5-550 462.5-1025z" fill="#FFF" />
              </svg>
            </div>
          </div>
          <div className="v4-o v4-coin v4-usdc" style={{ ['--d' as string]: 22 }}>
            <svg viewBox="0 0 2000 2000" aria-hidden="true" style={{ width: '100%', height: '100%', display: 'block' }}>
              <circle cx="1000" cy="1000" r="1000" fill="#2775CA" />
              <path d="M1275 1158.33c0-145.83-87.5-195.83-262.5-216.66-116.67-16.67-137.5-50-137.5-108.34 0-62.5 45.83-95.83 125-95.83 70.83 0 116.67 25 137.5 75 4.17 12.5 16.67 16.67 29.17 12.5l70.83-29.17c8.33-4.16 12.5-12.5 8.33-20.83-29.16-75-95.83-125-187.5-137.5V541.67c0-12.5-8.33-20.84-20.83-20.84h-58.34c-12.5 0-20.83 8.34-20.83 20.84v95.83c-112.5 16.67-183.33 91.67-183.33 195.83 0 137.5 83.33 191.67 258.33 212.5 116.67 20.84 141.67 54.17 141.67 112.5 0 75-58.34 116.67-141.67 116.67-95.83 0-145.83-41.67-170.83-104.17-4.17-8.33-12.5-12.5-25-12.5l-75 29.17c-8.34 4.16-12.5 12.5-8.34 20.83 29.17 87.5 95.84 145.83 216.67 166.67v95.83c0 12.5 8.33 20.83 20.83 20.83h58.34c12.5 0 20.83-8.33 20.83-20.83v-95.83c116.67-16.67 191.67-91.67 191.67-208.34z" fill="#FFF" />
              <path d="M787.5 1595.83c-325-116.66-479.17-475-354.17-800 70.84-187.5 216.67-333.33 404.17-404.16 12.5-4.17 16.67-16.67 12.5-29.17l-25-66.67c-4.17-12.5-16.67-16.66-29.17-12.5-212.5 79.17-379.16 245.84-458.33 458.34-141.67 366.66 33.33 775 400 916.66 179.17 70.84 379.17 41.67 537.5-62.5 8.33-8.33 12.5-20.83 4.17-29.16l-50-58.34c-8.34-8.33-20.84-8.33-29.17 0-125 79.17-283.33 104.17-412.5 87.5z" fill="#FFF" />
              <path d="M1654.17 791.67c-70.84-187.5-216.67-333.34-404.17-404.17-12.5-4.17-16.67 4.17-20.83 12.5l-29.17 70.83c-4.17 8.34 0 20.84 12.5 25 150 58.34 266.67 175 325 325 141.67 366.67-33.33 775-400 916.67-179.17 70.83-379.17 41.67-537.5-62.5-8.33-4.17-20.83-4.17-29.17 4.16l-50 58.34c-8.33 8.33-4.16 20.83 4.17 29.16 195.83 129.17 441.67 162.5 666.67 75 362.5-141.66 537.5-550 462.5-1025z" fill="#FFF" />
            </svg>
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
              <svg width="18" height="18" viewBox="0 0 240 240" aria-hidden="true" style={{ display: 'block' }}>
                <circle cx="120" cy="120" r="120" fill="#2AABEE" />
                <path d="M98 175c-3.9 0-3.2-1.5-4.6-5.2L79 123.6l107-63.6" fill="#c8daea" />
                <path d="M98 175c3 0 4.3-1.4 6-3l16-15.6-20-12" fill="#a9c9dd" />
                <path d="M100 144.4l48.4 35.7c5.5 3 9.5 1.5 10.9-5.1L179 66.8c2-8-3-11.7-8.3-9.3L22.2 113.6c-7.8 3.1-7.7 7.5-1.4 9.5l38.2 11.9 88.5-55.8c4.2-2.5 8-.9 4.9 1.9" fill="#ffffff" />
              </svg>
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
