'use client'

import { useEffect, useState } from 'react'

import { labelStyle, noticeStyle } from '@/components/site/editor/styles'
import { SITE_TEMPLATE_CONFIG } from '@/lib/site/template-config'
import { canUseSiteTemplate, isPremiumSiteTemplate } from '@/lib/site/templates'
import { STORY_LAYOUT_LABELS, STORY_LAYOUTS_BY_TEMPLATE, type StoryLayout } from '@/lib/site/story/story-layouts'
import type { PlanId } from '@/constants/plans'
import type { SiteTemplate } from '@/types/database'

export const TEMPLATE_OPTIONS: { id: SiteTemplate; label: string; description: string }[] = [
  { id: 'classic',   label: 'Clássico',  description: 'O estilo atual: capa elegante, história em polaroids, seções tradicionais.' },
  { id: 'portfolio', label: 'Portfólio', description: 'Visual ousado e editorial, com grade assimétrica de fotos e fotos em destaque.' },
  { id: 'editorial', label: 'Editorial', description: 'Composição de revista, fotografia em destaque e tipografia marcante.' },
  { id: 'garden', label: 'Jardim Romântico', description: 'Molduras em arco, ramos delicados e a cor do casal em cada detalhe.' },
  { id: 'enveloped', label: 'Envelopado', description: 'Envelope com selo e aba lateral, como um convite físico. Exclusivo.' },
  { id: 'photographic', label: 'Fotográfico', description: 'Capa em tela cheia e uma galeria ampla logo no início do site.' },
  { id: 'invitation', label: 'Convite Selado', description: 'Uma capa na cor do casamento, selo dourado e abertura animada ao toque. Exclusivo.' },
]

// Maquete animada de cada estilo — não é um screenshot real (o projeto não tem esse
// asset, e nenhuma foto real existe no repo: blocos de cor seguem fazendo as vezes de
// "foto"), mas reproduz em miniatura a estrutura de verdade de cada template (ver
// ClassicSite/PortfolioSite) — mesmas proporções, formas e cantos, com texto de
// demonstração fixo ("Ana & João") só pra ilustrar tipografia, nunca dado real do
// casamento. Troca de "quadro" a cada 2.5s em crossfade. As três telinhas simuladas
// (capa, fotos, informações) usam SEMPRE as variáveis de tema do casal
// (--wedding-color*), nunca uma cor fixa — a paleta muda dinamicamente por casamento.
type PreviewFrameId = 'hero' | 'gallery' | 'info'
const PREVIEW_FRAMES: PreviewFrameId[] = ['hero', 'gallery', 'info']
const PREVIEW_FRAME_MS = 2500

// Troca de quadro automática — só para a miniatura em destaque (selecionada, em hover ou
// com foco): sete animações simultâneas pesavam no celular e disputavam a atenção.
// Respeita `prefers-reduced-motion` checando o `matchMedia` antes de sequer criar o
// `setInterval` (a regra global em globals.css zera durações de CSS, mas não timers JS).
function useAutoAdvancingFrame(frameCount: number, intervalMs: number, enabled: boolean): number {
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (!enabled) return
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const id = setInterval(() => {
      setActive((prev) => (prev + 1) % frameCount)
    }, intervalMs)
    return () => {
      clearInterval(id)
      setActive(0)
    }
  }, [frameCount, intervalMs, enabled])

  return active
}

// Nomes de demonstração fixos — só decoram o card de seleção de estilo, nunca dado
// real do casal (que só existe depois de logado, e este seletor pode aparecer antes
// de qualquer preenchimento).
const PREVIEW_DEMO_NAMES = 'Ana & João'
const PREVIEW_DEMO_DATE  = '15 . 08 . 2026'

// Quadro "capa/hero": no clássico, kicker + nome do casal em serifada + data, tudo
// centralizado sobre o gradiente escuro — mesma composição de `ClassicSite` (ver
// "Casamento de" / <h1 className="font-display"> / data+local). No portfólio, texto
// editorial alinhado à esquerda/embaixo sobre um bloco "full-bleed" com overlay
// diagonal, como a capa de `PortfolioSite` (eyebrow + h1 grande + CTA em pílula),
// em vez de centralizado.
function PreviewHeroFrame({ template }: { template: SiteTemplate }) {
  if (isPremiumSiteTemplate(template) && template !== 'photographic') {
    return <div style={{ position: 'absolute', inset: 0, background: 'var(--wedding-color-subtle)', color: 'var(--wedding-color-dark)', padding: '12px', textAlign: 'center', overflow: 'hidden' }}>
      {(template === 'invitation' || template === 'enveloped') ? <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'var(--wedding-color-dark)', color: '#e8ca82' }}><span style={{ position: 'absolute', left: template === 'enveloped' ? '50%' : 0, right: 0, top: template === 'enveloped' ? 0 : '50%', height: template === 'enveloped' ? '100%' : '1px', background: template === 'enveloped' ? '#0003' : '#d8b660' }} /><span style={{ zIndex: 1, borderRadius: '50%', padding: '10px', border: '3px double #d8b660', background: 'linear-gradient(135deg,#f8e7a4,#bd913d)', color: 'var(--wedding-color-dark)', fontFamily: 'var(--font-display)', fontSize: '18px' }}>A & J</span></div>
      : <div style={{ height: '100%', border: template === 'garden' ? '1px solid var(--wedding-color)' : 0, borderRadius: template === 'garden' ? '50% 50% 0 0' : 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: template === 'editorial' ? 'flex-start' : 'center', padding: '6px 12px' }}><span style={{ fontSize: '6px', letterSpacing: '2px' }}>{template === 'garden' ? 'JARDIM ROMÂNTICO' : 'O NOSSO GRANDE DIA'}</span><span style={{ fontFamily: 'var(--font-display)', fontSize: '24px', lineHeight: 1.1 }}>Ana & João</span><span style={{ fontSize: '7px', marginTop: '5px' }}>15 · 08 · 2026</span></div>}
    </div>
  }
  if (template === 'portfolio' || template === 'photographic') {
    return (
      <div
        style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'flex-start', justifyContent: 'flex-end', gap: '4px', padding: '10px 12px',
          background: 'linear-gradient(to top right, rgba(10,6,2,0.8), rgba(10,6,2,0.15)), var(--wedding-color-secondary-light)',
        }}
      >
        <div style={{ fontSize: '6px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--wedding-color-light)' }}>
          Sejam bem-vindos
        </div>
        <div className="font-display" style={{ fontWeight: 500, fontSize: '17px', lineHeight: 1, color: '#FAF0E6' }}>
          {PREVIEW_DEMO_NAMES}
        </div>
        <div style={{ fontSize: '6.5px', fontStyle: 'italic', color: 'rgba(250,240,230,0.8)' }}>
          nosso grande dia está chegando!
        </div>
        <div style={{ display: 'inline-flex', borderRadius: '99px', background: 'var(--wedding-color)', color: '#241708', fontSize: '6.5px', fontWeight: 700, padding: '3px 9px', marginTop: '3px' }}>
          RSVP
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '5px',
        background: 'linear-gradient(150deg, var(--brand-dark-gradient-from), var(--brand-dark-gradient-to))',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(color-mix(in srgb, var(--wedding-color) 22%, transparent) 1px, transparent 1.2px)',
          backgroundSize: '13px 13px',
        }}
      />
      <div style={{ position: 'relative', fontSize: '6px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--wedding-color-light)' }}>
        Casamento de
      </div>
      <div className="font-display" style={{ position: 'relative', fontWeight: 500, fontSize: '19px', lineHeight: 1, color: '#FAF0E6' }}>
        {PREVIEW_DEMO_NAMES}
      </div>
      <div style={{ position: 'relative', fontSize: '6.5px', color: 'rgba(250,240,230,0.75)' }}>
        {PREVIEW_DEMO_DATE}
      </div>
    </div>
  )
}

// Linha curta e um pontinho em cada ponta — versão minúscula do `PhotoConnector` do
// clássico (linha curva + círculo de junção ligando cada polaroid à "linha do tempo").
function PreviewPhotoConnector({ flip }: { flip?: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      style={{ width: '16px', height: '16px', flexShrink: 0, transform: flip ? 'scaleY(-1)' : undefined }}
    >
      <path d="M 0 4 C 6 4, 8 12, 16 12" fill="none" stroke="var(--wedding-color-secondary)" strokeWidth="1.4" strokeLinecap="round" opacity="0.62" />
      <circle cx="16" cy="12" r="1.8" fill="var(--bg)" stroke="var(--wedding-color-secondary)" strokeWidth="1" />
    </svg>
  )
}

// Quadro "fotos": polaroids de verdade — moldura branca grossa embaixo (mesma
// proporção de `PolaroidPhoto`, padding assimétrico maior na base), levemente
// rotacionadas e ligadas por uma linha fina com pontinho de junção, no espírito da
// "linha do tempo" da história (clássico); grade em linhas de tamanho fixo 4/5/5
// sem cantos arredondados, replicando a proporção real de `.pf-gallery-row`/
// `PortfolioGalleryGrid` (portfólio).
function PreviewGalleryFrame({ template }: { template: SiteTemplate }) {
  if (template === 'photographic') {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '3px', padding: '6px' }}>
        {Array.from({ length: 13 }, (_, index) => <div key={index} style={{ gridColumn: index % 4 === 0 ? 'span 2' : undefined, background: index % 2 ? 'var(--wedding-color-secondary-light)' : 'var(--wedding-color-light)' }} />)}
      </div>
    )
  }
  if (template === 'portfolio') {
    const rowA = [0, 1, 2, 3]
    const rowB = [0, 1, 2, 3, 4]
    return (
      <div style={{ position: 'absolute', inset: 0, background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: '2px', padding: '5px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2px', height: '34px' }}>
          {rowA.map((i) => (
            <div key={i} style={{ background: i % 2 === 0 ? 'var(--wedding-color-light)' : 'var(--wedding-color-secondary-light)' }} />
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '2px', height: '20px' }}>
          {rowB.map((i) => (
            <div key={i} style={{ background: i % 2 === 0 ? 'var(--wedding-color-secondary-light)' : 'var(--wedding-color-light)' }} />
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '2px', height: '20px' }}>
          {rowB.map((i) => (
            <div key={i} style={{ background: i % 2 === 0 ? 'var(--wedding-color-light)' : 'var(--wedding-color-secondary-light)' }} />
          ))}
        </div>
      </div>
    )
  }

  const rotations = [-7, 4, -3]
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {rotations.map((rot, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
          {i > 0 && <PreviewPhotoConnector flip={i % 2 === 0} />}
          <div
            style={{
              width: '24px', height: '30px', padding: '3px 3px 10px', borderRadius: '2px',
              background: '#FFFCF6', boxShadow: '0 3px 6px rgba(60,40,24,0.18)', transform: `rotate(${rot}deg)`,
            }}
          >
            <div style={{ width: '100%', height: '100%', borderRadius: '1px', background: i % 2 === 0 ? 'var(--wedding-color-light)' : 'var(--wedding-color-secondary-light)' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// Quadro "informações": cartão pontilhado centralizado, já fiel à seção de RSVP real
// do clássico (borda tracejada + fundo `--wedding-color-subtle`) — mantido como está.
// No portfólio, duas colunas kicker+texto sem arredondamento ao lado de um bloco de
// cor, no espírito das seções "Cerimônia"/"Nossa história" editoriais — também mantido.
function PreviewInfoFrame({ template }: { template: SiteTemplate }) {
  if (template === 'portfolio') {
    return (
      <div style={{ position: 'absolute', inset: 0, background: 'var(--bg)', display: 'flex', gap: '8px', padding: '10px' }}>
        <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '5px' }}>
          <div style={{ width: '26px', height: '3px', background: 'var(--wedding-color-dark)' }} />
          <div style={{ width: '68px', height: '8px', background: 'var(--fg)', opacity: 0.85 }} />
          <div style={{ width: '58px', height: '3px', background: 'var(--muted-fg)', opacity: 0.5 }} />
          <div style={{ width: '46px', height: '3px', background: 'var(--muted-fg)', opacity: 0.5 }} />
        </div>
        <div style={{ flex: 1, background: 'var(--wedding-color-secondary-subtle)' }} />
      </div>
    )
  }

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px' }}>
      <div
        style={{
          width: '100%', height: '100%', borderRadius: '10px', border: '1.5px dashed var(--wedding-color-secondary)',
          background: 'var(--wedding-color-subtle)', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '5px',
        }}
      >
        <div style={{ width: '66px', height: '6px', borderRadius: '2px', background: 'var(--wedding-color-dark)', opacity: 0.7 }} />
        <div style={{ width: '86px', height: '4px', borderRadius: '2px', background: 'var(--muted-fg)', opacity: 0.5 }} />
        <div style={{ width: '74px', height: '4px', borderRadius: '2px', background: 'var(--muted-fg)', opacity: 0.5 }} />
      </div>
    </div>
  )
}

// Mockup de "janela de navegador" (barrinha com 3 bolinhas) por cima do quadro animado —
// reforça a leitura de "isso é uma prévia de site", não um card decorativo qualquer.
function MiniSitePreview({ template, animate }: { template: SiteTemplate; animate: boolean }) {
  const active  = useAutoAdvancingFrame(PREVIEW_FRAMES.length, PREVIEW_FRAME_MS, animate)
  const rounded = template === 'classic'

  return (
    <div
      aria-hidden
      style={{
        borderRadius: rounded ? '10px' : '6px', overflow: 'hidden',
        border: '1px solid var(--border)', marginBottom: '10px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 8px', background: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--muted-fg)', opacity: 0.4 }} />
        ))}
      </div>
      <div style={{ position: 'relative', height: '96px', overflow: 'hidden' }}>
        {PREVIEW_FRAMES.map((frame, index) => (
          <div
            key={frame}
            style={{ position: 'absolute', inset: 0, opacity: index === active ? 1 : 0, transition: 'opacity 700ms ease' }}
          >
            {frame === 'hero'    && <PreviewHeroFrame template={template} />}
            {frame === 'gallery' && <PreviewGalleryFrame template={template} />}
            {frame === 'info'    && <PreviewInfoFrame template={template} />}
          </div>
        ))}
      </div>
    </div>
  )
}

interface TemplatePickerProps {
  value:    SiteTemplate
  planId:   PlanId
  onChange: (template: SiteTemplate) => void
  /** Fotos atualmente na galeria — avisa nos cards cujo estilo mostra menos que isso. */
  galleryCount?: number
}

export function TemplatePicker({ value, planId, onChange, galleryCount = 0 }: TemplatePickerProps) {
  const [highlighted, setHighlighted] = useState<SiteTemplate | null>(null)

  return (
    <div>
      <span id="site-template-label" style={labelStyle}>Estilo do site</span>
      <div role="group" aria-labelledby="site-template-label" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TEMPLATE_OPTIONS.filter((opt) => canUseSiteTemplate(planId, opt.id)).map((opt) => {
          const selected = value === opt.id
          const limit    = SITE_TEMPLATE_CONFIG[opt.id].galleryLimit
          const overLimit = limit !== null && galleryCount > limit
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(opt.id)}
              onMouseEnter={() => setHighlighted(opt.id)}
              onMouseLeave={() => setHighlighted((current) => (current === opt.id ? null : current))}
              onFocus={() => setHighlighted(opt.id)}
              onBlur={() => setHighlighted((current) => (current === opt.id ? null : current))}
              style={{
                textAlign: 'left', padding: '14px 16px', borderRadius: '14px',
                border: selected ? '1.5px solid var(--wedding-color)' : '1.5px solid var(--border)',
                background: selected ? 'var(--wedding-color-subtle)' : 'var(--surface)',
                cursor: 'pointer', color: 'var(--fg)',
              }}
            >
              <MiniSitePreview template={opt.id} animate={selected || highlighted === opt.id} />

              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 700, color: 'var(--fg)', marginBottom: '4px' }}>
                {opt.label}
                {selected && <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--wedding-color-dark)' }}>· Selecionado</span>}
              </span>
              <span style={{ display: 'block', fontSize: '12.5px', color: 'var(--muted-fg)', lineHeight: 1.5 }}>
                {opt.description}
              </span>
              {overLimit && (
                <span style={{ display: 'block', fontSize: '12px', color: 'var(--color-accent-dark)', marginTop: '6px', fontWeight: 600 }}>
                  Mostra até {limit} fotos na galeria (vocês têm {galleryCount}).
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface TemplateImpactNoticeProps {
  template:      SiteTemplate
  savedTemplate: SiteTemplate
  galleryCount:  number
  storyLayout:   StoryLayout | undefined
  hasStoryPhoto: boolean
}

/** Avisa, no momento da escolha, o que muda nas outras abas ao trocar de estilo. */
export function TemplateImpactNotice({ template, savedTemplate, galleryCount, storyLayout, hasStoryPhoto }: TemplateImpactNoticeProps) {
  if (template === savedTemplate) return null

  const config = SITE_TEMPLATE_CONFIG[template]
  const layouts = STORY_LAYOUTS_BY_TEMPLATE[template]
  const notes: string[] = []

  if (config.galleryLimit !== null && galleryCount > config.galleryLimit) {
    const hidden = galleryCount - config.galleryLimit
    notes.push(`A galeria do ${config.label} mostra até ${config.galleryLimit} fotos; vocês têm ${galleryCount}. ${hidden === 1 ? 'A última fica guardada' : `As ${hidden} últimas ficam guardadas`}, mas não aparece${hidden === 1 ? '' : 'm'} no site.`)
  }
  if (storyLayout && !layouts.supported.includes(storyLayout)) {
    notes.push(`A apresentação "${STORY_LAYOUT_LABELS[storyLayout].label}" da história não existe neste estilo; o site usa "${STORY_LAYOUT_LABELS[layouts.default].label}".`)
  }
  if (hasStoryPhoto && !config.storyPhoto) {
    notes.push('A foto de destaque da história não aparece neste estilo (ela continua guardada).')
  }

  return (
    <div role="status" style={{ ...noticeStyle, display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <strong>Ao trocar para {config.label}:</strong>
      {notes.length === 0
        ? <span>Todo o conteúdo atual continua aparecendo. Nada é apagado ao trocar de estilo.</span>
        : notes.map((note) => <span key={note}>• {note}</span>)}
      <span style={{ opacity: 0.85 }}>A troca só vale para o site depois de salvar.</span>
    </div>
  )
}
