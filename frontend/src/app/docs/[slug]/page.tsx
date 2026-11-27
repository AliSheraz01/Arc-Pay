import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getAllDocs, getDocBySlug, getPrevNextDocs } from '@/lib/docs'
import { DocsShell } from '@/components/DocsShell'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return getAllDocs().map((doc) => ({ slug: doc.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const doc = getDocBySlug(slug)
  if (!doc) {
    return { title: 'Docs — EasyZpay' }
  }
  return {
    title: `${doc.title} — EasyZpay Docs`,
    description: doc.summary,
  }
}

export default async function DocPage({ params }: Props) {
  const { slug } = await params
  const doc = getDocBySlug(slug)
  if (!doc) {
    notFound()
  }

  const allDocs = getAllDocs()
  const { prev, next } = getPrevNextDocs(slug)

  return (
    <DocsShell
      docs={allDocs}
      current={doc}
      content={doc.content}
      headings={doc.headings}
      prev={prev}
      next={next}
    />
  )
}
