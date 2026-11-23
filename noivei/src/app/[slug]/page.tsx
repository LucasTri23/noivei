import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import PremiumSite from '@/components/site/site-templates/premium-site'
import { isPremiumSiteTemplate } from '@/lib/site/templates'
import ClassicSite from '@/components/site/site-templates/classic-site'
import PortfolioSite from '@/components/site/site-templates/portfolio-site'
import { getPublicSiteBySlug } from '@/lib/site/get-public-site-by-slug'
import { createSupabaseService } from '@/lib/supabase/service'
import { deriveWeddingColorScale, deriveBrandDarkGradient } from '@/lib/theme/wedding-color'

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

  // Cor principal e secundária do casal — mesma derivação de escala (claro/escuro/fundo)
  // usada no app autenticado, aplicada aqui via CSS vars para todo o site público,
  // em QUALQUER template (classic ou portfolio) — nunca uma paleta fixa.
  const colorScale          = deriveWeddingColorScale(site.wedding.wedding_color)
  const colorScaleSecondary = deriveWeddingColorScale(site.wedding.wedding_color_secondary)
  const brandDarkGradient = deriveBrandDarkGradient(site.wedding.wedding_color_secondary)
  const weddingColorVars = {
    '--wedding-color':                  colorScale.color,
    '--wedding-color-light':            colorScale.light,
    '--wedding-color-dark':             colorScale.dark,
    '--wedding-color-subtle':           colorScale.subtle,
    '--wedding-color-secondary':        colorScaleSecondary.color,
    '--wedding-color-secondary-light':  colorScaleSecondary.light,
    '--wedding-color-secondary-dark':   colorScaleSecondary.dark,
    '--wedding-color-secondary-subtle': colorScaleSecondary.subtle,
    '--brand-dark-gradient-from':       brandDarkGradient.from,
    '--brand-dark-gradient-to':         brandDarkGradient.to,
  } as React.CSSProperties

  return (
    <div style={weddingColorVars}>
      {isPremiumSiteTemplate(site.template)
        ? <PremiumSite slug={slug} site={site} variant={site.template} />
        : site.template === 'portfolio'
        ? <PortfolioSite slug={slug} site={site} />
        : <ClassicSite slug={slug} site={site} />}
    </div>
  )
}
