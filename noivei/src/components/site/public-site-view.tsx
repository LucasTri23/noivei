import ClassicSite from '@/components/site/site-templates/classic-site'
import PortfolioSite from '@/components/site/site-templates/portfolio-site'
import PremiumSite from '@/components/site/site-templates/premium-site'
import { siteFontPairStyle } from '@/components/site/site-fonts'
import { mixHex, SITE_TONE_COLORS, type SiteTone } from '@/lib/site/customization'
import type { PublicSiteInfo } from '@/lib/site/get-public-site-by-slug'
import { isPremiumSiteTemplate } from '@/lib/site/templates'
import { deriveBrandDarkGradient, deriveWeddingColorScale } from '@/lib/theme/wedding-color'

/**
 * Variáveis de cor do site: cor do casal (ou a cor de destaque escolhida só para
 * o site) e, quando o casal escolhe um fundo, as cores de fundo/texto do tom.
 * Sem personalização, o resultado é idêntico ao de antes.
 */
export function siteColorVars(site: Pick<PublicSiteInfo, 'wedding' | 'content' | 'template'>): Record<string, string> {
  const accent = site.content.palette?.accent ?? site.wedding.wedding_color
  const tone: SiteTone | undefined = site.content.palette?.tone
  const colorScale          = deriveWeddingColorScale(accent)
  const colorScaleSecondary = deriveWeddingColorScale(site.wedding.wedding_color_secondary)
  const brandDarkGradient   = deriveBrandDarkGradient(site.wedding.wedding_color_secondary)

  const vars: Record<string, string> = {
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
  }
  if (!tone) return vars

  const colors = SITE_TONE_COLORS[tone]
  Object.assign(vars, {
    '--bg': colors.bg, '--surface': colors.surface, '--fg': colors.fg,
    '--muted': colors.muted, '--muted-fg': colors.mutedFg, '--border': colors.border,
    '--site-tone-bg': colors.bg, '--site-tone-fg': colors.fg, '--site-tone-muted-fg': colors.mutedFg,
    '--site-tone-surface': colors.surface,
  })

  if (tone === 'dark') {
    // No fundo escuro, os tons "escuros" da paleta viram texto claro e os fundos
    // suaves viram superfícies escuras tingidas. Os estilos premium fazem essa
    // troca no próprio CSS (o envelope do Convite usa --wedding-color-dark e não
    // pode mudar), por isso aqui só para Clássico e Portfólio.
    vars['--site-tone-accent-ink'] = colorScale.light
    vars['--site-tone-tint'] = mixHex(colorScale.color, colors.bg, 0.16)
    if (!isPremiumSiteTemplate(site.template)) {
      vars['--wedding-color-dark'] = colorScale.light
      vars['--wedding-color-subtle'] = mixHex(colorScale.color, colors.bg, 0.16)
      vars['--wedding-color-secondary-dark'] = colorScaleSecondary.light
      vars['--wedding-color-secondary-subtle'] = mixHex(colorScaleSecondary.color, colors.bg, 0.16)
    }
  }
  return vars
}

/**
 * Site do casal renderizado no estilo escolhido — usado pela página pública (/[slug])
 * e pela pré-visualização do rascunho (/site/previa), para as duas nunca divergirem.
 */
export default function PublicSiteView({ slug, site }: { slug: string; site: PublicSiteInfo }) {
  const fonts = siteFontPairStyle(site.content.font_pair)
  const tone = site.content.palette?.tone

  return (
    <div
      className={fonts.className}
      data-site-tone={tone}
      style={{ ...siteColorVars(site), ...fonts.style, ...(tone ? { background: 'var(--bg)', color: 'var(--fg)' } : {}) } as React.CSSProperties}
    >
      {isPremiumSiteTemplate(site.template)
        ? <PremiumSite slug={slug} site={site} variant={site.template} />
        : site.template === 'portfolio'
        ? <PortfolioSite slug={slug} site={site} />
        : <ClassicSite slug={slug} site={site} />}
    </div>
  )
}
