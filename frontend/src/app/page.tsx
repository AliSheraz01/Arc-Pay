'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
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

  // IntersectionObserver reveal for the blue visual panel
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

  // Cleanup pending navigation timer on unmount
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
      // Step 3: Mobile (<768px) — no side drawer; floating pill glass tab bar rises from bottom, then navigate client-side
      setMobileBarOpen(true)
      navTimerRef.current = setTimeout(
        () => {
          router.push('/app')
        },
        reduced ? 150 : 750
      )
    } else {
      // Step 2: Desktop — real Sidebar slides in from the left, tabs float in one by one, then navigate client-side to /app
      setDesktopDrawerOpen(true)
      navTimerRef.current = setTimeout(
        () => {
          router.push('/app')
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
        {/* Left Blue Visual Panel */}
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
              <img alt="USDC" src="/assets/usdc-logo.png" />
            </div>
          </div>
          <div className="v4-o v4-coin v4-usdc" style={{ ['--d' as string]: 22 }}>
            <img alt="USDC" src="/assets/usdc-logo.png" />
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

        {/* Right Copy & Header Panel */}
        <div className="v4-right">
          <header className="v4-header">
            <div className="v4-logo">
              <img className="v4-mark" alt="EasyZpay" src="/assets/easyzpay-logo.jpg" />
              <span>EasyZpay</span>
            </div>

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
      </div>

      {/* Step 2: Desktop Real Sidebar Slide-In */}
      <Sidebar
        drawerMode={true}
        isOpen={desktopDrawerOpen}
        onClose={handleCloseDrawer}
        onNavigate={handleDrawerNavigate}
      />

      {/* Step 3: Mobile Floating Pill Glass Tab Bar */}
      <MobileGlassBar
        visible={mobileBarOpen}
        animateEntrance={true}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onNavigate={() => {
          if (navTimerRef.current) clearTimeout(navTimerRef.current)
        }}
      />

      <style jsx>{`
        .v4-root {
          min-height: 100vh;
          background: var(--frame);
          color: var(--ink);
          padding: 12px;
          padding-top: calc(12px + env(safe-area-inset-top, 0px));
          padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
        }

        .v4-panel {
          min-height: calc(100vh - 24px);
          background: var(--panel);
          border-radius: 26px;
          overflow: hidden;
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          position: relative;
        }

        .v4-visual {
          --u: clamp(9px, 1.12vw, 16px);
          --mx: 0;
          --my: 0;
          position: relative;
          margin: 0 12px 12px;
          order: 2;
          border-radius: 22px;
          overflow: hidden;
          min-height: clamp(480px, 50vw, 780px);
          opacity: 0;
          transform: translateY(70px);
          transition: opacity 0.9s ease, transform 0.9s cubic-bezier(0.2, 0.8, 0.2, 1);
          background: radial-gradient(90% 60% at 30% 100%, #0b1fa8 0%, transparent 70%),
            linear-gradient(160deg, #9db6ff 0%, #4f7bff 45%, #1c3fe0 100%);
        }

        .v4-visual.in {
          opacity: 1;
          transform: none;
        }

        .v4-right {
          order: 1;
          min-height: calc(100svh - 24px);
          display: flex;
          flex-direction: column;
          padding: 0 clamp(20px, 4vw, 52px) clamp(28px, 4vw, 48px);
        }

        @media (min-width: 861px) {
          .v4-panel {
            grid-template-columns: 1fr 1.05fr;
          }
          .v4-visual {
            order: 1;
            margin: 12px 0 12px 12px;
            min-height: calc(100svh - 48px);
          }
          .v4-right {
            order: 2;
          }
        }

        .v4-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 22px 0;
        }

        .v4-logo {
          white-space: nowrap;
          flex: none;
          display: flex;
          align-items: center;
          gap: 9px;
          font-weight: 700;
          font-size: 1.3rem;
          letter-spacing: -0.03em;
          color: var(--ink);
        }

        .v4-mark {
          width: 30px;
          height: 30px;
          border-radius: 9px;
          display: block;
          object-fit: cover;
        }

        .v4-top {
          white-space: nowrap;
          flex: none;
          border: 0;
          cursor: pointer;
          background: var(--ink);
          color: var(--panel);
          font: 600 0.86rem var(--font);
          padding: 11px 18px;
          border-radius: 999px;
          min-height: 44px;
          transition: transform 0.2s;
        }
        .v4-top:hover {
          transform: translateY(-1px);
        }

        .v4-copy {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          padding: 28px 0;
        }

        .v4-h1 {
          margin: 0;
          font-weight: 600;
          font-size: clamp(2.4rem, 5.2vw, 5rem);
          line-height: 0.98;
          letter-spacing: -0.045em;
          max-width: 14ch;
          color: var(--ink);
        }

        .v4-w {
          display: inline-block;
          overflow: hidden;
          vertical-align: top;
          padding-bottom: 0.08em;
        }

        .v4-w span {
          display: inline-block;
          transform: translateY(105%);
          animation: v4-rise 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
          animation-delay: calc(var(--i) * 70ms);
        }

        @keyframes v4-rise {
          to {
            transform: none;
          }
        }

        .v4-sub {
          margin: 24px 0 28px;
          max-width: 40ch;
          color: var(--muted);
          font-size: 1.05rem;
          line-height: 1.55;
          opacity: 0;
          animation: v4-fade 0.8s 0.7s ease forwards;
        }

        @keyframes v4-fade {
          to {
            opacity: 1;
          }
        }

        .v4-cta {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 10px;
          opacity: 0;
          animation: v4-fade 0.7s 0.9s ease forwards;
        }

        .v4-btn {
          white-space: nowrap;
          font: 600 1rem var(--font);
          padding: 16px 28px;
          border-radius: 999px;
          border: 1px solid var(--line);
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          transition: transform 0.2s;
        }
        .v4-btn:hover {
          transform: translateY(-2px);
        }
        .v4-primary {
          background: var(--blue);
          color: var(--blue-ink);
          border-color: var(--blue);
          box-shadow: 0 10px 26px rgba(43, 91, 255, 0.3);
        }
        .v4-ghost {
          background: var(--panel);
          color: var(--ink);
        }

        .v4-arc {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 26px;
          font-size: 0.85rem;
          color: var(--muted);
          opacity: 0;
          animation: v4-fade 0.7s 1.1s ease forwards;
        }

        .v4-arc img {
          height: 40px;
          width: auto;
          border-radius: 12px;
          display: block;
        }

        .v4-stats {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 28px;
          margin-top: auto;
          padding-top: 32px;
          color: var(--ink);
        }

        .v4-stats div {
          font-size: clamp(1.5rem, 2.6vw, 2.2rem);
          font-weight: 500;
          letter-spacing: -0.03em;
          line-height: 1.1;
        }

        .v4-stats small {
          display: block;
          font-size: 0.8rem;
          font-weight: 400;
          letter-spacing: 0;
          color: var(--muted);
          margin-top: 4px;
        }

        .v4-stats hr {
          width: 1px;
          height: 48px;
          border: 0;
          background: var(--line);
          margin: 0;
        }

        .v4-hint {
          margin-top: 22px;
          text-align: center;
          font-size: 0.78rem;
          color: var(--muted);
          animation: v4-nudge 2.2s ease-in-out infinite;
        }
        @keyframes v4-nudge {
          50% {
            transform: translateY(6px);
          }
        }

        /* Visual Stage Objects */
        .v4-o {
          position: absolute;
          transform: translate(calc(var(--mx) * var(--d) * 1px), calc(var(--my) * var(--d) * 1px));
          transition: transform 0.25s ease-out;
        }
        .v4-f {
          animation: v4-float var(--t, 6s) ease-in-out infinite;
          animation-delay: var(--dl, 0s);
        }
        @keyframes v4-float {
          50% {
            transform: translateY(calc(var(--u) * -1.3)) rotate(var(--r, 3deg));
          }
        }

        .v4-phone {
          left: 50%;
          top: 50%;
          width: calc(var(--u) * 22);
          height: calc(var(--u) * 43);
          margin: calc(var(--u) * -21.5) 0 0 calc(var(--u) * -11);
          z-index: 2;
        }

        .v4-phone .v4-f {
          width: 100%;
          height: 100%;
          border-radius: calc(var(--u) * 3.6);
          background: #080c26;
          border: calc(var(--u) * 0.5) solid #1636c9;
          box-shadow: 0 calc(var(--u) * 3) calc(var(--u) * 6) rgba(5, 10, 60, 0.45);
          overflow: hidden;
          color: #fff;
          padding: calc(var(--u) * 2.2) calc(var(--u) * 1.6);
          transform: rotate(-7deg);
          --r: -5deg;
          position: relative;
        }

        .v4-phone h3 {
          margin: calc(var(--u) * 1.4) 0 calc(var(--u) * 1.4);
          font-size: calc(var(--u) * 1.7);
          text-align: center;
          font-weight: 600;
          letter-spacing: -0.02em;
        }

        .v4-row {
          background: rgba(255, 255, 255, 0.1);
          border-radius: calc(var(--u) * 1.2);
          padding: calc(var(--u) * 1.1) calc(var(--u) * 1.3);
          margin-bottom: calc(var(--u) * 0.8);
          font-size: calc(var(--u) * 1.25);
          display: flex;
          justify-content: space-between;
        }

        .v4-row em {
          font-style: normal;
          opacity: 0.6;
        }

        .v4-typed {
          display: inline-block;
          overflow: hidden;
          white-space: nowrap;
          vertical-align: bottom;
          width: 0;
          animation: v4-type 7s steps(5) infinite;
        }

        @keyframes v4-type {
          0%,
          8% {
            width: 0;
          }
          22%,
          92% {
            width: 3ch;
          }
          100% {
            width: 0;
          }
        }

        .v4-send {
          margin-top: calc(var(--u) * 1.2);
          background: #1db954;
          border-radius: calc(var(--u) * 1.2);
          text-align: center;
          padding: calc(var(--u) * 1.2);
          font-weight: 600;
          font-size: calc(var(--u) * 1.3);
          animation: v4-press 7s infinite;
        }

        @keyframes v4-press {
          0%,
          40% {
            transform: none;
          }
          46% {
            transform: scale(0.94);
          }
          52%,
          100% {
            transform: none;
          }
        }

        .v4-cards {
          position: absolute;
          left: calc(var(--u) * 1.6);
          right: calc(var(--u) * 1.6);
          bottom: calc(var(--u) * 1.6);
          height: calc(var(--u) * 14);
        }

        .v4-cards b {
          position: absolute;
          left: 0;
          right: 0;
          height: calc(var(--u) * 7);
          border-radius: calc(var(--u) * 1.3);
        }

        .v4-cards b:nth-child(1) {
          bottom: calc(var(--u) * 6.5);
          background: #efd9f2;
          transform: scale(0.9);
        }

        .v4-cards b:nth-child(2) {
          bottom: calc(var(--u) * 3.2);
          background: #4f7bff;
          transform: scale(0.95);
        }

        .v4-cards b:nth-child(3) {
          bottom: 0;
          background: #f5c84b;
        }

        .v4-done {
          position: absolute;
          inset: 0;
          background: rgba(8, 12, 38, 0.92);
          display: grid;
          place-items: center;
          text-align: center;
          font-size: calc(var(--u) * 1.4);
          opacity: 0;
          animation: v4-done 7s infinite;
        }

        .v4-done span {
          display: grid;
          place-items: center;
          width: calc(var(--u) * 6);
          height: calc(var(--u) * 6);
          margin: 0 auto calc(var(--u) * 1);
          border-radius: 50%;
          background: #1db954;
          font-size: calc(var(--u) * 3);
        }

        @keyframes v4-done {
          0%,
          52% {
            opacity: 0;
          }
          58%,
          86% {
            opacity: 1;
          }
          94%,
          100% {
            opacity: 0;
          }
        }

        .v4-coin {
          border-radius: 50%;
          display: grid;
          place-items: center;
          font-weight: 700;
          box-shadow: 0 calc(var(--u) * 1) calc(var(--u) * 2.4) rgba(5, 10, 70, 0.35);
        }

        .v4-coin img {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          display: block;
          object-fit: cover;
        }

        .v4-chk {
          left: 12%;
          top: 8%;
          width: calc(var(--u) * 8);
          height: calc(var(--u) * 8);
          z-index: 3;
          background: radial-gradient(circle at 35% 30%, #7be08f, #0f8f3b);
          color: #fff;
          font-size: calc(var(--u) * 4);
        }

        .v4-usdc {
          right: 10%;
          top: 34%;
          width: calc(var(--u) * 10);
          height: calc(var(--u) * 10);
          z-index: 3;
          background: radial-gradient(circle at 30% 25%, #fff, #c9d3ea 70%);
          animation: v4-spin 6s ease-in-out infinite;
          overflow: hidden;
        }

        @keyframes v4-spin {
          0%,
          45% {
            transform: rotateY(0);
          }
          75%,
          100% {
            transform: rotateY(360deg);
          }
        }

        .v4-ring {
          border-radius: 50%;
          border: calc(var(--u) * 1.2) solid #fff;
          opacity: 0.85;
        }

        .v4-r1 {
          right: 14%;
          top: 6%;
          width: calc(var(--u) * 10);
          height: calc(var(--u) * 10);
          border-color: #fff;
          box-shadow: 0 8px 22px rgba(20, 40, 170, 0.28);
        }

        .v4-r2 {
          left: 6%;
          bottom: 22%;
          width: calc(var(--u) * 5);
          height: calc(var(--u) * 5);
          border-color: #ffd23f;
        }

        .v4-dot {
          left: 9%;
          top: 42%;
          width: calc(var(--u) * 6);
          height: calc(var(--u) * 6);
          background: #0b1030;
          z-index: 3;
          overflow: hidden;
        }

        .v4-glass {
          right: 7%;
          bottom: 9%;
          width: calc(var(--u) * 7);
          height: calc(var(--u) * 7);
          z-index: 3;
          border-radius: 50%;
          border: calc(var(--u) * 0.9) solid rgba(255, 255, 255, 0.7);
          background: rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(3px);
        }

        @media (max-width: 860px) {
          .v4-visual {
            --u: 9px;
            margin: 0 12px 12px;
            min-height: 460px;
          }
          .v4-stats {
            padding-bottom: 6px;
          }
        }
      `}</style>
    </div>
  )
}
