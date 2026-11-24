import ClassicSite from '@/components/site/site-templates/classic-site'
import PortfolioSite from '@/components/site/site-templates/portfolio-site'
import PremiumSite from '@/components/site/site-templates/premium-site'
import type { PublicSiteInfo } from '@/lib/site/get-public-site-by-slug'
import { isPremiumSiteTemplate } from '@/lib/site/templates'
import { deriveBrandDarkGradient, deriveWeddingColorScale } from '@/lib/theme/wedding-color'

/**
 * Site do casal renderizado no estilo escolhido — usado pela página pública (/[slug])
 * e pela pré-visualização do rascunho (/site/previa), para as duas nunca divergirem.
 */
export default function PublicSiteView({ slug, site }: { slug: string; site: PublicSiteInfo }) {
  // Cor principal e secundária do casal — mesma derivação de escala (claro/escuro/fundo)
  // usada no app autenticado, aplicada aqui via CSS vars para todo o site público,
  // em QUALQUER template — nunca uma paleta fixa.
  const colorScale          = deriveWeddingColorScale(site.wedding.wedding_color)
  const colorScaleSecondary = deriveWeddingColorScale(site.wedding.wedding_color_secondary)
  const brandDarkGradient   = deriveBrandDarkGradient(site.wedding.wedding_color_secondary)
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
