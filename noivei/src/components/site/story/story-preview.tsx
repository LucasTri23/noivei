'use client'

import { ClassicStory } from '@/components/site/site-templates/classic-site'
import { PortfolioStory } from '@/components/site/site-templates/portfolio-site'
import { PremiumStory, PremiumStoryHeading } from '@/components/site/site-templates/premium-site'
import premiumStyles from '@/components/site/site-templates/premium-site.module.css'
import type { StoryView } from '@/lib/site/story/story-model'
import { isPremiumSiteTemplate } from '@/lib/site/templates'
import type { SiteTemplate } from '@/types/database'

interface StoryPreviewProps {
  template:    SiteTemplate
  view:        StoryView
  coupleNames: string
  markdown:    boolean
  heading?:    string
}

/**
 * Pré-visualização da seção Nossa História com os MESMOS componentes do site
 * público (ClassicStory / PortfolioStory / PremiumStory) e o mesmo
 * renderizador de texto — muda só o contêiner, que rola dentro do editor.
 */
export default function StoryPreview({ template, view, coupleNames, markdown, heading }: StoryPreviewProps) {
  if (view.layout === 'legacy') {
    return (
      <p style={{ fontSize: '13px', color: 'var(--muted-fg)', margin: 0, lineHeight: 1.6 }}>
        Com a apresentação original, a seção continua exatamente como no site publicado hoje.
        Escolha uma das apresentações acima para ver as fotos e os momentos aqui.
      </p>
    )
  }

  if (!view.hasContent) {
    return <p style={{ fontSize: '13px', color: 'var(--muted-fg)', margin: 0 }}>Escreva a história ou adicione fotos e momentos para visualizar.</p>
  }

  let body: React.ReactNode
  if (isPremiumSiteTemplate(template)) {
    body = (
      <div className={`${premiumStyles.site} ${premiumStyles[template === 'enveloped' ? 'invitation' : template]}`}>
        <section className={premiumStyles.storyNew}>
          <PremiumStoryHeading variant={template} heading={heading} />
          <PremiumStory view={view} coupleNames={coupleNames} markdown={markdown} />
        </section>
      </div>
    )
  } else if (template === 'portfolio') {
    body = <div style={{ padding: '28px 20px', background: 'var(--bg)' }}><PortfolioStory view={view} coupleNames={coupleNames} markdown={markdown} /></div>
  } else {
    body = <div style={{ padding: '28px 20px', background: 'var(--bg)' }}><ClassicStory view={view} coupleNames={coupleNames} markdown={markdown} /></div>
  }

  return (
    <div
      aria-label="Pré-visualização da seção Nossa História"
      style={{ maxHeight: '640px', overflow: 'auto', border: '1.5px solid #EBDDD0', borderRadius: '16px', background: 'var(--bg)' }}
    >
      {body}
    </div>
  )
}
