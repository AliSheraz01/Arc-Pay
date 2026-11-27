'use client'

import React, { useState } from 'react'
import Link from 'next/link'

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*_~()[\]{}]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

function CopyCodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // ignore clipboard errors
    }
  }

  return (
    <div className="docs-code-wrap">
      <button
        type="button"
        onClick={handleCopy}
        className="docs-copy-btn"
        aria-label="Copy code"
      >
        {copied ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Copied</span>
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            <span>Copy</span>
          </>
        )}
      </button>
      <pre className="docs-pre">
        <code>{code}</code>
      </pre>
    </div>
  )
}

function Callout({ type, lines }: { type: 'NOTE' | 'WARNING'; lines: string[] }) {
  const isWarn = type === 'WARNING'
  return (
    <div className={`docs-callout ${isWarn ? 'docs-callout-warn' : 'docs-callout-note'}`} role="note">
      <div className="docs-callout-title">
        {isWarn ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        )}
        <span>{isWarn ? 'Warning' : 'Note'}</span>
      </div>
      <div className="docs-callout-body">
        {lines.map((line, i) => (
          <p key={i}>{renderInline(line)}</p>
        ))}
      </div>
    </div>
  )
}

function renderInline(text: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = []
  const regex = /(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index))
    }
    if (match[2] && match[3]) {
      const href = match[3]
      const isExternal = /^https?:\/\//i.test(href)
      if (isExternal) {
        tokens.push(
          <a key={key++} href={href} target="_blank" rel="noreferrer" className="docs-link">
            {match[2]}
          </a>
        )
      } else {
        tokens.push(
          <Link key={key++} href={href} className="docs-link">
            {match[2]}
          </Link>
        )
      }
    } else if (match[4]) {
      tokens.push(<strong key={key++}>{match[4]}</strong>)
    } else if (match[5]) {
      tokens.push(
        <code key={key++} className="docs-inline-code">
          {match[5]}
        </code>
      )
    }
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex))
  }
  return tokens
}

export function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const blocks: React.ReactNode[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      i++
      continue
    }

    // Code block
    if (trimmed.startsWith('```')) {
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++
      blocks.push(<CopyCodeBlock key={key++} code={codeLines.join('\n')} />)
      continue
    }

    // Callout blockquote (> [!NOTE] or > [!WARNING])
    if (trimmed.startsWith('> [!NOTE]') || trimmed.startsWith('> [!WARNING]')) {
      const type = trimmed.includes('[!WARNING]') ? 'WARNING' : 'NOTE'
      const calloutLines: string[] = []
      i++
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        const cleaned = lines[i].trim().replace(/^>\s?/, '')
        if (cleaned) calloutLines.push(cleaned)
        i++
      }
      blocks.push(<Callout key={key++} type={type} lines={calloutLines} />)
      continue
    }

    // Headings (## and ###)
    const hMatch = trimmed.match(/^(#{2,3})\s+(.+)$/)
    if (hMatch) {
      const level = hMatch[1].length
      const text = hMatch[2].trim()
      const id = slugifyHeading(text)
      if (level === 2) {
        blocks.push(
          <h2 key={key++} id={id} className="docs-h2">
            <a href={`#${id}`} className="docs-anchor" aria-label={`Link to ${text}`}>
              #
            </a>
            {renderInline(text)}
          </h2>
        )
      } else {
        blocks.push(
          <h3 key={key++} id={id} className="docs-h3">
            <a href={`#${id}`} className="docs-anchor" aria-label={`Link to ${text}`}>
              #
            </a>
            {renderInline(text)}
          </h3>
        )
      }
      i++
      continue
    }

    // Unordered list
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''))
        i++
      }
      blocks.push(
        <ul key={key++} className="docs-ul">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>
      )
      continue
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''))
        i++
      }
      blocks.push(
        <ol key={key++} className="docs-ol">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ol>
      )
      continue
    }

    // Paragraph
    const paraLines: string[] = [trimmed]
    i++
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('>') &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim())
      i++
    }
    blocks.push(
      <p key={key++} className="docs-p">
        {renderInline(paraLines.join(' '))}
      </p>
    )
  }

  return <div className="docs-markdown">{blocks}</div>
}
