'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
import {
  MdHome,
  MdSend,
  MdChat,
  MdMoreHoriz,
  MdCallReceived,
  MdLink,
  MdAutoAwesome,
  MdHistory,
  MdPerson,
  MdSettings,
  MdClose,
  MdLightMode,
  MdDarkMode,
} from 'react-icons/md'

interface MobileGlassBarProps {
  visible?: boolean
  animateEntrance?: boolean
  theme?: 'light' | 'dark'
  onToggleTheme?: (next: 'light' | 'dark') => void
  onNavigate?: (href: string) => void
}

const PRIMARY_TABS = [
  { href: '/app', label: 'Home', icon: MdHome },
  { href: '/send', label: 'Send', icon: MdSend },
  { href: '/chat-to-pay', label: 'Chat to Pay', icon: MdChat },
]

const MORE_ITEMS = [
  { href: '/receive', label: 'Receive', icon: MdCallReceived, color: '#F5B800' },
  { href: '/cross-pay', label: 'Cross Pay', icon: MdLink, color: '#8B5CF6' },
  { href: '/bounties', label: 'Bounties', icon: MdAutoAwesome, color: '#F97316' },
  { href: '/activity', label: 'History', icon: MdHistory, color: '#64748B' },
  { href: '/profile', label: 'Profile', icon: MdPerson, color: '#EC4899' },
  { href: '/settings', label: 'Settings', icon: MdSettings, color: '#475569' },
]

export function MobileGlassBar({
  visible = true,
  animateEntrance = false,
  theme,
  onToggleTheme,
  onNavigate,
}: MobileGlassBarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [moreOpen, setMoreOpen] = useState(false)

  const isMoreActive = MORE_ITEMS.some((item) => pathname === item.href)

  const handleLinkClick = (e: React.MouseEvent, href: string) => {
    setMoreOpen(false)
    if (onNavigate) {
      e.preventDefault()
      onNavigate(href)
      router.push(href)
    }
  }

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            className="mobile-glass-bar-wrap"
            initial={animateEntrance ? { y: 90, opacity: 0 } : false}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 90, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
          >
            <nav className="mobile-glass-bar" aria-label="Mobile Navigation">
              {PRIMARY_TABS.map((tab, idx) => {
                const Icon = tab.icon
                const isActive = pathname === tab.href
                return (
                  <motion.div
                    key={tab.href}
                    style={{ flex: 1, display: 'flex' }}
                    initial={animateEntrance ? { scale: 0.7, opacity: 0, y: 12 } : false}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    transition={{
                      type: 'spring',
                      stiffness: 420,
                      damping: 24,
                      delay: animateEntrance ? 0.08 + idx * 0.06 : 0,
                    }}
                  >
                    <Link
                      href={tab.href}
                      onClick={(e) => handleLinkClick(e, tab.href)}
                      className={`mobile-glass-tab ${isActive ? 'active' : ''}`}
                      style={{ width: '100%' }}
                    >
                      <Icon size={19} />
                      <span>{tab.label}</span>
                    </Link>
                  </motion.div>
                )
              })}

              <motion.div
                style={{ flex: 1, display: 'flex' }}
                initial={animateEntrance ? { scale: 0.7, opacity: 0, y: 12 } : false}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{
                  type: 'spring',
                  stiffness: 420,
                  damping: 24,
                  delay: animateEntrance ? 0.08 + 3 * 0.06 : 0,
                }}
              >
                <button
                  type="button"
                  onClick={() => setMoreOpen((v) => !v)}
                  aria-expanded={moreOpen}
                  aria-haspopup="dialog"
                  className={`mobile-glass-tab ${moreOpen || isMoreActive ? 'active' : ''}`}
                  style={{ width: '100%' }}
                >
                  <MdMoreHoriz size={20} />
                  <span>More</span>
                </button>
              </motion.div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* More Glass Bottom Sheet */}
      <AnimatePresence>
        {moreOpen && (
          <div className="md:hidden fixed inset-0 z-[1000]">
            {/* Scrim — tap outside to close */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMoreOpen(false)}
              style={{
                position: 'absolute',
                inset: 0,
                background: 'var(--scrim)',
                backdropFilter: 'blur(4px)',
              }}
            />

            {/* Draggable Glass Bottom Sheet */}
            <motion.div
              role="dialog"
              aria-label="More navigation"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 32 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.05, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 70 || info.velocity.y > 400) {
                  setMoreOpen(false)
                }
              }}
              style={{
                position: 'absolute',
                left: 12,
                right: 12,
                bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
                borderRadius: '26px',
                background: 'var(--panel)',
                border: '1px solid var(--line)',
                padding: '12px 16px 20px',
                boxShadow: '0 24px 60px rgba(0, 0, 0, 0.35)',
                touchAction: 'none',
              }}
            >
              {/* Drag Handle */}
              <div
                style={{
                  width: '40px',
                  height: '4px',
                  borderRadius: '999px',
                  background: 'var(--line)',
                  margin: '0 auto 12px',
                }}
              />

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px',
                  padding: '0 4px',
                }}
              >
                <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)' }}>
                  More
                </span>
                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  aria-label="Close menu"
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    border: '1px solid var(--line)',
                    background: 'var(--soft)',
                    color: 'var(--ink)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <MdClose size={18} />
                </button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: '8px',
                }}
              >
                {MORE_ITEMS.map((item) => {
                  const Icon = item.icon
                  const active = pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={(e) => handleLinkClick(e, item.href)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        minHeight: '48px',
                        padding: '10px 14px',
                        borderRadius: '16px',
                        background: active ? 'var(--blue)' : 'var(--soft)',
                        color: active ? 'var(--blue-ink)' : 'var(--ink)',
                        textDecoration: 'none',
                        fontSize: '14px',
                        fontWeight: 600,
                      }}
                    >
                      <span
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: active ? 'var(--blue-ink)' : item.color,
                          flexShrink: 0,
                        }}
                      />
                      <Icon size={17} />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </div>

              {onToggleTheme && (
                <div
                  style={{
                    marginTop: '12px',
                    display: 'flex',
                    gap: '6px',
                    background: 'var(--soft)',
                    padding: '4px',
                    borderRadius: '999px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onToggleTheme('light')}
                    style={{
                      flex: 1,
                      minHeight: '40px',
                      borderRadius: '999px',
                      border: 0,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      fontSize: '13px',
                      fontWeight: 600,
                      background: theme === 'light' ? 'var(--panel)' : 'transparent',
                      color: theme === 'light' ? 'var(--ink)' : 'var(--muted)',
                    }}
                  >
                    <MdLightMode size={16} /> Light
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleTheme('dark')}
                    style={{
                      flex: 1,
                      minHeight: '40px',
                      borderRadius: '999px',
                      border: 0,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      fontSize: '13px',
                      fontWeight: 600,
                      background: theme === 'dark' ? 'var(--panel)' : 'transparent',
                      color: theme === 'dark' ? 'var(--ink)' : 'var(--muted)',
                    }}
                  >
                    <MdDarkMode size={16} /> Dark
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
