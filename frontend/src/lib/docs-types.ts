export type DocGroup = 'Get started' | 'Features' | 'Telegram' | 'Reference'

export interface DocHeading {
  id: string
  text: string
  level: 2 | 3
}

export interface DocMeta {
  slug: string
  title: string
  summary: string
  group: DocGroup
  order: number
}

export interface DocPage extends DocMeta {
  content: string
  headings: DocHeading[]
}

export const DOC_GROUPS: DocGroup[] = [
  'Get started',
  'Features',
  'Telegram',
  'Reference',
]
