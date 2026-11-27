import fs from 'fs'
import path from 'path'
import { DocGroup, DocHeading, DocMeta, DocPage, DOC_GROUPS } from './docs-types'

export type { DocGroup, DocHeading, DocMeta, DocPage }
export { DOC_GROUPS }

const DOCS_DIR = path.join(process.cwd(), 'content', 'docs')

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*_~()[\]{}]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  const normalized = raw.replace(/\r\n/g, '\n')
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) {
    return { data: {}, body: normalized }
  }
  const data: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx > 0) {
      const key = line.slice(0, idx).trim()
      const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
      data[key] = val
    }
  }
  return { data, body: match[2].trim() }
}

function extractHeadings(markdown: string): DocHeading[] {
  const headings: DocHeading[] = []
  let inCode = false
  for (const line of markdown.split('\n')) {
    if (line.trim().startsWith('```')) {
      inCode = !inCode
      continue
    }
    if (inCode) continue
    const m = line.match(/^(#{2,3})\s+(.+)$/)
    if (m) {
      const level = m[1].length as 2 | 3
      const text = m[2].trim()
      headings.push({
        id: slugifyHeading(text),
        text,
        level,
      })
    }
  }
  return headings
}

export function getAllDocs(): DocMeta[] {
  if (!fs.existsSync(DOCS_DIR)) return []
  const files = fs.readdirSync(DOCS_DIR).filter((f) => f.endsWith('.md'))
  const docs: DocMeta[] = files.map((file) => {
    const raw = fs.readFileSync(path.join(DOCS_DIR, file), 'utf8')
    const { data } = parseFrontmatter(raw)
    const slug = file.replace(/^\d+-/, '').replace(/\.md$/, '')
    return {
      slug,
      title: data.title || slug,
      summary: data.summary || '',
      group: (data.group as DocGroup) || 'Reference',
      order: Number(data.order || 99),
    }
  })
  return docs.sort((a, b) => a.order - b.order)
}

export function getDocBySlug(slug: string): DocPage | null {
  if (!fs.existsSync(DOCS_DIR)) return null
  const files = fs.readdirSync(DOCS_DIR).filter((f) => f.endsWith('.md'))
  const file = files.find((f) => f.replace(/^\d+-/, '').replace(/\.md$/, '') === slug)
  if (!file) return null
  const raw = fs.readFileSync(path.join(DOCS_DIR, file), 'utf8')
  const { data, body } = parseFrontmatter(raw)
  return {
    slug,
    title: data.title || slug,
    summary: data.summary || '',
    group: (data.group as DocGroup) || 'Reference',
    order: Number(data.order || 99),
    content: body,
    headings: extractHeadings(body),
  }
}

export function getPrevNextDocs(slug: string): { prev: DocMeta | null; next: DocMeta | null } {
  const all = getAllDocs()
  const idx = all.findIndex((d) => d.slug === slug)
  if (idx === -1) return { prev: null, next: null }
  return {
    prev: idx > 0 ? all[idx - 1] : null,
    next: idx < all.length - 1 ? all[idx + 1] : null,
  }
}
