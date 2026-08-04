import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import ClassicSite from '@/components/site/site-templates/classic-site'
import PortfolioSite from '@/components/site/site-templates/portfolio-site'
import { getPublicSiteBySlug } from '@/lib/site/get-public-site-by-slug'
import { createSupabaseService } from '@/lib/supabase/service'
import { deriveWeddingColorScale, deriveBrandDarkGradient } from '@/lib/theme/wedding-color'

// Sites de casal ainda não entraram no roadmap de SEO/indexação do produto
export const metadata: Metadata = {
  title:  'Site do casal',
  robots: { index: false, follow: false },
}

interface PublicSitePageProps {
  params: Promise<{ slug: string }>
}

export default async function PublicSitePage({ params }: PublicSitePageProps) {
  const { slug } = await params

  let site: Awaited<ReturnType<typeof getPublicSiteBySlug>> = null
  try {
    const supabase = createSupabaseService()
    site = await getPublicSiteBySlug(supabase, slug)
  } catch {
    // Ambiente sem service role configurado — trata como site indisponível
    site = null
  }

  if (!site) notFound()

  // Cor principal e secundária do casal — mesma derivação de escala (claro/escuro/fundo)
  // usada no app autenticado, aplicada aqui via CSS vars para todo o site público,
  // em QUALQUER template (classic ou portfolio) — nunca uma paleta fixa.
  const colorScale          = deriveWeddingColorScale(site.wedding.wedding_color)
  const colorScaleSecondary = deriveWeddingColorScale(site.wedding.wedding_color_secondary)
  // Site do casal é recurso Premium (ver PaywallGate em (app)/site) — só chega a existir
  // publicado para um plano pago, então a cor (e o gradiente escuro derivado dela) já
  // pode ser aplicada sem checagem extra de plano aqui, igual ao restante desta página.
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
      {/* `site.template` já vem com o fail-safe de plano resolvido em
          get-public-site-by-slug.ts — nunca é 'portfolio' se o plano ATUAL não
          libera mais o módulo 'album', mesmo que o valor salvo esteja
          'portfolio' (downgrade de plano depois de escolher o template). */}
      {site.template === 'portfolio'
        ? <PortfolioSite slug={slug} site={site} />
        : <ClassicSite slug={slug} site={site} />}
    </div>
  )
}
