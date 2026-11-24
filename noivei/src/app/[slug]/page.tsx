import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import PublicSiteView from '@/components/site/public-site-view'
import { getPublicSiteBySlug } from '@/lib/site/get-public-site-by-slug'
import { createSupabaseService } from '@/lib/supabase/service'

interface PublicSitePageProps {
  params: Promise<{ slug: string }>
}

const loadPublishedSite = cache(async (slug: string) => {
  try {
    return await getPublicSiteBySlug(createSupabaseService(), slug)
  } catch {
    return null
  }
})

export async function generateMetadata({ params }: PublicSitePageProps): Promise<Metadata> {
  const { slug } = await params
  const site = await loadPublishedSite(slug)

  return {
    title: site?.wedding.couple_names.trim() || 'Site do casal',
    robots: { index: false, follow: false },
  }
}

export default async function PublicSitePage({ params }: PublicSitePageProps) {
  const { slug } = await params
  const site = await loadPublishedSite(slug)

  if (!site) notFound()

  return <PublicSiteView slug={slug} site={site} />
}
