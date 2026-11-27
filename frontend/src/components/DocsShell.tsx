'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { DocMeta, DocHeading, DOC_GROUPS } from '@/lib/docs-types'
import { EasyZpayArchMark } from '@/components/Sidebar'
import { MarkdownRenderer } from '@/components/MarkdownRenderer'

interface DocsShellProps {
  docs: DocMeta[]
  current: DocMeta
  content: string
  headings: DocHeading[]
  prev: DocMeta | null
  next: DocMeta | null
}

export function DocsShell({
  docs,
  current,
  content,
  headings,
  prev,
  next,
}: DocsShellProps) {
  const [search, setSearch] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'dark' | 'light' | null
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const resolved = saved || (prefersDark ? 'dark' : 'light')
    setTheme(resolved)
    document.documentElement.setAttribute('data-theme', resolved)
  }, [])

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    localStorage.setItem('theme', nextTheme)
    document.documentElement.setAttribute('data-theme', nextTheme)
  }

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return docs
    return docs.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.summary.toLowerCase().includes(q) ||
        d.group.toLowerCase().includes(q)
    )
  }, [docs, search])

  const renderNav = (onSelect?: () => void) => (
    <div className="docs-nav-inner">
      <div className="docs-search-wrap">
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="docs-search-icon"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search docs..."
          aria-label="Search documentation"
          className="docs-search-input"
        />
      </div>

      {DOC_GROUPS.map((group) => {
        const items = filteredDocs.filter((d) => d.group === group)
        if (items.length === 0) return null
        return (
          <div key={group} className="docs-group">
            <div className="docs-group-title">{group}</div>
            <div className="docs-group-list">
              {items.map((item) => {
                const active = item.slug === current.slug
                return (
                  <Link
                    key={item.slug}
                    href={`/docs/${item.slug}`}
                    onClick={onSelect}
                    className={`docs-nav-link ${active ? 'active' : ''}`}
                  >
                    {item.title}
                  </Link>
                )
              })}
            </div>
          </div>
        )
      })}

      {filteredDocs.length === 0 && (
        <p style={{ fontSize: '0.85rem', color: 'var(--muted)', padding: '8px 4px' }}>
          No matching pages.
        </p>
      )}
    </div>
  )

  return (
    <div className="docs-root">
      <div className="docs-shell">
        {/* Top Bar */}
        <header className="docs-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="docs-menu-btn"
              aria-label="Open documentation menu"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
              <span>Menu</span>
            </button>

            <Link href="/" className="docs-brand">
              <EasyZpayArchMark size={30} />
              <span>EasyZpay</span>
              <span className="docs-badge">Docs</span>
            </Link>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={toggleTheme}
              className="docs-theme-btn"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
            <Link href="/send" className="docs-launch-pill">
              Launch App
            </Link>
          </div>
        </header>

        {/* 3-Column Grid: Sidebar | Main Article | On This Page */}
        <div className="docs-grid">
          <aside className="docs-sidebar" aria-label="Documentation navigation">
            {renderNav()}
          </aside>

          <main className="docs-main">
            <div className="docs-breadcrumb">{current.group}</div>
            <h1 className="docs-title">{current.title}</h1>
            <p className="docs-summary">{current.summary}</p>

            <MarkdownRenderer content={content} />

            {/* Previous / Next Pagination */}
            <nav className="docs-pager" aria-label="Page pagination">
              {prev ? (
                <Link href={`/docs/${prev.slug}`} className="docs-pager-btn">
                  <span className="docs-pager-label">← Previous</span>
                  <span className="docs-pager-title">{prev.title}</span>
                </Link>
              ) : (
                <div />
              )}
              {next ? (
                <Link href={`/docs/${next.slug}`} className="docs-pager-btn docs-pager-next">
                  <span className="docs-pager-label">Next →</span>
                  <span className="docs-pager-title">{next.title}</span>
                </Link>
              ) : (
                <div />
              )}
            </nav>
          </main>

          <aside className="docs-toc" aria-label="On this page">
            {headings.length > 0 && (
              <div className="docs-toc-sticky">
                <div className="docs-toc-title">On this page</div>
                <ul className="docs-toc-list">
                  {headings.map((h) => (
                    <li key={h.id} className={h.level === 3 ? 'docs-toc-sub' : ''}>
                      <a href={`#${h.id}`} className="docs-toc-link">
                        {h.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* Mobile Slide-in Drawer */}
      {mobileOpen && (
        <div className="docs-drawer-root">
          <div className="docs-drawer-scrim" onClick={() => setMobileOpen(false)} />
          <aside className="docs-drawer" aria-label="Mobile documentation menu">
            <div className="docs-drawer-top">
              <span className="docs-brand">
                <EasyZpayArchMark size={28} />
                <span>EasyZpay Docs</span>
              </span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="docs-close-btn"
                aria-label="Close documentation menu"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            {renderNav(() => setMobileOpen(false))}
          </aside>
        </div>
      )}
    </div>
  )
}
