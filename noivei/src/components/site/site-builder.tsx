'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import Spinner from '@/components/ui/spinner'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { useOrigin } from '@/hooks/use-origin'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { toastError, toastSuccess } from '@/store/toast.store'
import { SiteSlugSchema } from '@/lib/api/validation/site.schema'
import { coverPhotoZoomScale } from '@/lib/site/cover-photo-zoom'
import { parseSiteContent, type SiteContent } from '@/lib/site/site-content'
import { GALLERY_PHOTO_LIMIT_BY_TEMPLATE } from '@/lib/site/template-limits'
import type { SiteConfig, SiteTemplate } from '@/types/database'

// Marcador do endpoint público do bucket "wedding-photos" — presente numa URL indica que
// ela veio de um upload (não de uma URL externa colada manualmente), e o que vem depois
// dele é o storage_path do objeto, usado pra localizar o registro na hora de excluir.
const GALLERY_BUCKET_URL_MARKER = '/storage/v1/object/public/wedding-photos/'

interface GalleryPhotoRecord {
  id:           string
  storage_path: string
  size_bytes:   number
  position_y:   number
  fit_contain:  boolean
  public_url:   string
}

// Metadados de ajuste de recorte por foto, indexados pela URL pública (mesma chave usada
// em `content.gallery_urls`) — só existem pra fotos enviadas do computador (registradas em
// wedding_gallery_photos); URLs externas coladas manualmente não têm registro e não
// ganham o controle de ajuste.
interface GalleryPhotoMeta {
  id:          string
  position_y:  number
  fit_contain: boolean
}

// Mesma sanitização/formatação usadas em FileArchiveManager (Central de arquivos) —
// duplicadas aqui por serem poucas linhas e a Galeria não depender desse módulo.
function sanitizeFileName(name: string): string {
  return name.normalize('NFKD').replace(/[^a-zA-Z0-9.\-_]/g, '-')
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function UploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

type SectionId = 'capa' | 'historia' | 'cerimonia' | 'rsvp' | 'presentes' | 'galeria'

interface Section {
  id:    SectionId
  label: string
  icon:  React.ReactNode
}

interface SiteBuilderProps {
  weddingId:         string
  coupleNames:       string
  initialSite:       SiteConfig | null
  storageLimitBytes: number
  storageUsedBytes:  number
  // Se o plano do casamento libera o módulo Álbum de fotos (plan_module_access,
  // module='album') — mesmo módulo que libera o mural. Controla só se o estilo
  // "portfolio" aparece SELECIONÁVEL aqui; a Route Handler PATCH /site
  // reforça a mesma regra do lado do servidor, e a renderização pública em
  // /[slug] nunca confia no valor salvo (sempre reavalia o plano atual).
  albumEnabled:      boolean
}

interface ApiErrorBody {
  error?: { code?: string; message?: string }
}

interface PatchResult {
  ok:      boolean
  message: string
}

function ImageIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
}
function HeartIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
}
function MapPinIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
}
function MailCheckIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/><path d="m16 19 2 2 4-4"/></svg>
}
function GiftIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
}
function CameraIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
}
function GlobeIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
}
function ExternalLinkIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
}
function PlusIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
}
function TrashIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
}
function CropIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>
}
function ArrowUpIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
}
function ArrowDownIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
}
const SECTIONS: Section[] = [
  { id: 'capa',      label: 'Capa',              icon: <ImageIcon /> },
  { id: 'historia',  label: 'Nossa história',     icon: <HeartIcon /> },
  { id: 'cerimonia', label: 'Cerimônia & festa',  icon: <MapPinIcon /> },
  { id: 'rsvp',      label: 'Confirmar presença', icon: <MailCheckIcon /> },
  { id: 'presentes', label: 'Lista de presentes', icon: <GiftIcon /> },
  { id: 'galeria',   label: 'Galeria',            icon: <CameraIcon /> },
]

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as ApiErrorBody
    return body.error?.message ?? fallback
  } catch {
    return fallback
  }
}

const inputStyle: React.CSSProperties = {
  border: '1.5px solid #EBDDD0', borderRadius: '12px', padding: '12px 14px',
  fontSize: '15px', color: 'var(--fg)', background: 'var(--surface)', outline: 'none', width: '100%',
}

const labelStyle: React.CSSProperties = {
  fontSize: '13px', fontWeight: 600, color: 'var(--fg)', marginBottom: '6px', display: 'block',
}

const saveButtonStyle = (saving: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: '8px',
  background: 'var(--wedding-color)', color: '#fff', border: 'none',
  borderRadius: '12px', padding: '11px 20px',
  fontWeight: 600, fontSize: '14px',
  cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1,
  alignSelf: 'flex-start',
})

function GuardNotice({ onGoToCapa }: { onGoToCapa: () => void }) {
  return (
    <div
      style={{
        padding: '18px 20px', borderRadius: '14px',
        background: 'var(--wedding-color-subtle)', border: '1px dashed #D8C6A6',
        fontSize: '14px', color: 'var(--muted-fg)', lineHeight: 1.6,
      }}
    >
      Antes de editar esta seção, defina o endereço (slug) do seu site na aba{' '}
      <button
        type="button"
        onClick={onGoToCapa}
        style={{ border: 'none', background: 'none', padding: 0, color: 'var(--wedding-color)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
      >
        Capa
      </button>.
    </div>
  )
}

interface CapaSectionProps {
  coupleNames:         string
  slug:                string
  published:           boolean
  template:            SiteTemplate
  albumEnabled:        boolean
  coverTitle:          string
  coverPhotoUrl:       string | null
  coverPhotoPosition:  number
  coverPhotoZoom:      number
  publicUrl:           string | null
  saving:              boolean
  onUploadPhoto: (file: File) => Promise<GalleryPhotoRecord | null>
  onDeletePhoto: (url: string) => Promise<boolean>
  onSave: (values: {
    slug: string; published: boolean; template: SiteTemplate
    coverTitle: string; coverPhotoUrl: string | null; coverPhotoPosition: number; coverPhotoZoom: number
  }) => Promise<PatchResult>
}

const TEMPLATE_OPTIONS: { id: SiteTemplate; label: string; description: string }[] = [
  { id: 'classic',   label: 'Clássico',  description: 'O estilo atual: capa elegante, história em polaroids, seções tradicionais.' },
  { id: 'portfolio', label: 'Portfólio', description: 'Visual ousado e editorial, com grade assimétrica de fotos e o mural de fotos em destaque.' },
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

// Troca de quadro automática — respeita `prefers-reduced-motion` checando o `matchMedia`
// antes de sequer criar o `setInterval` (a regra global em globals.css zera durações de
// `animation`/`transition` do CSS, mas não interrompe timers em JS puro, então aqui a
// checagem é manual).
function useAutoAdvancingFrame(frameCount: number, intervalMs: number): number {
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const id = setInterval(() => {
      setActive((prev) => (prev + 1) % frameCount)
    }, intervalMs)
    return () => clearInterval(id)
  }, [frameCount, intervalMs])

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
  if (template === 'portfolio') {
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
function MiniSitePreview({ template }: { template: SiteTemplate }) {
  const active  = useAutoAdvancingFrame(PREVIEW_FRAMES.length, PREVIEW_FRAME_MS)
  const rounded = template === 'classic'

  return (
    <div
      aria-hidden
      style={{
        borderRadius: rounded ? '10px' : '6px', overflow: 'hidden',
        border: '1px solid #EBDDD0', marginBottom: '10px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 8px', background: 'var(--muted)', borderBottom: '1px solid #EBDDD0' }}>
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

function TemplatePicker({ value, albumEnabled, onChange }: { value: SiteTemplate; albumEnabled: boolean; onChange: (t: SiteTemplate) => void }) {
  return (
    <div>
      <label style={labelStyle}>Estilo do site</label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TEMPLATE_OPTIONS.map((opt) => {
          const locked   = opt.id === 'portfolio' && !albumEnabled
          const selected = value === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              disabled={locked}
              onClick={() => !locked && onChange(opt.id)}
              style={{
                textAlign: 'left', padding: '14px 16px', borderRadius: '14px',
                border: selected ? '1.5px solid var(--wedding-color)' : '1.5px solid #EBDDD0',
                background: selected ? 'var(--wedding-color-subtle)' : 'var(--surface)',
                cursor: locked ? 'not-allowed' : 'pointer',
                opacity: locked ? 0.55 : 1,
              }}
            >
              <MiniSitePreview template={opt.id} />

              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--fg)', marginBottom: '4px' }}>
                {opt.label}
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--muted-fg)', lineHeight: 1.5 }}>
                {locked ? 'Disponível no plano que libera o álbum de fotos.' : opt.description}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CapaSection({
  coupleNames, slug, published, template, albumEnabled, coverTitle, coverPhotoUrl, coverPhotoPosition, coverPhotoZoom, publicUrl, saving,
  onUploadPhoto, onDeletePhoto, onSave,
}: CapaSectionProps) {
  const [slugDraft, setSlugDraft]   = useState(slug)
  const [titleDraft, setTitleDraft] = useState(coverTitle)
  const [publishedDraft, setPublishedDraft] = useState(published)
  const [templateDraft, setTemplateDraft] = useState<SiteTemplate>(template)
  const [coverDraft, setCoverDraft] = useState<string | null>(coverPhotoUrl)
  const [positionDraft, setPositionDraft] = useState(coverPhotoPosition)
  const [zoomDraft, setZoomDraft]   = useState(coverPhotoZoom)
  const [uploading, setUploading]   = useState(false)
  // Erro de validação do slug fica local ao campo — não é resultado de uma ação de rede
  const [error, setError]     = useState('')
  const inputRef      = useRef<HTMLInputElement>(null)
  const showSpinner       = useDelayedLoading(saving)
  const showUploadSpinner = useDelayedLoading(uploading)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || uploading) return

    setUploading(true)
    const uploaded = await onUploadPhoto(file)
    setUploading(false)
    if (!uploaded) return

    setCoverDraft(uploaded.public_url)
    setPositionDraft(50) // Foto nova: volta pro centro/sem zoom, em vez de manter o ajuste da foto anterior
    setZoomDraft(0)
  }

  async function handleRemoveCover() {
    if (!coverDraft) return
    const url = coverDraft
    setCoverDraft(null)
    await onDeletePhoto(url)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const parsedSlug = SiteSlugSchema.safeParse(slugDraft)
    if (!parsedSlug.success) {
      setError(parsedSlug.error.issues[0]?.message ?? 'Slug inválido.')
      return
    }

    const result = await onSave({
      slug: parsedSlug.data, published: publishedDraft, template: templateDraft,
      coverTitle: titleDraft.trim(), coverPhotoUrl: coverDraft, coverPhotoPosition: positionDraft, coverPhotoZoom: zoomDraft,
    })
    if (!result.ok) {
      toastError(result.message)
      return
    }
    toastSuccess('Capa salva com sucesso!')
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <TemplatePicker value={templateDraft} albumEnabled={albumEnabled} onChange={setTemplateDraft} />

      <div>
        <label htmlFor="site-cover-title" style={labelStyle}>Título da capa</label>
        <input
          id="site-cover-title"
          type="text"
          maxLength={160}
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          placeholder={coupleNames}
          style={inputStyle}
        />
        <p style={{ fontSize: '12.5px', color: 'var(--muted-fg)', marginTop: '6px' }}>
          Se deixar em branco, usamos &ldquo;{coupleNames}&rdquo;.
        </p>
      </div>

      <div>
        <label style={labelStyle}>Foto de capa</label>
        {coverDraft ? (
          <>
            <div className="relative overflow-hidden rounded-2xl" style={{ border: '1.5px solid #EBDDD0' }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- URL do Storage, sem domínio fixo para configurar no next/image */}
              <img
                src={coverDraft}
                alt="Foto de capa"
                style={{
                  width: '100%', height: '150px', objectFit: 'cover',
                  objectPosition: `center ${positionDraft}%`, display: 'block',
                  transform: `scale(${coverPhotoZoomScale(zoomDraft)})`,
                  transformOrigin: `center ${positionDraft}%`,
                }}
              />
              <button
                type="button"
                onClick={handleRemoveCover}
                aria-label="Remover foto de capa"
                style={{
                  position: 'absolute', top: '10px', right: '10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '30px', height: '30px', border: 'none', borderRadius: '10px',
                  background: 'rgba(20,12,4,0.55)', color: '#fff', cursor: 'pointer',
                }}
              >
                <TrashIcon />
              </button>
            </div>

            <div style={{ marginTop: '12px' }}>
              <label htmlFor="site-cover-position" style={{ ...labelStyle, marginBottom: '4px' }}>
                Posição vertical da foto
              </label>
              <input
                id="site-cover-position"
                type="range"
                min={0}
                max={100}
                value={positionDraft}
                onChange={(e) => setPositionDraft(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--wedding-color)' }}
              />
              <p style={{ fontSize: '12.5px', color: 'var(--muted-fg)', marginTop: '2px' }}>
                {positionDraft === 0 ? 'Topo' : positionDraft === 100 ? 'Base' : positionDraft === 50 ? 'Centro' : `${positionDraft}%`}
                {' — '}ajuste se o casal ficar cortado na prévia acima.
              </p>
            </div>

            <div style={{ marginTop: '12px' }}>
              <label htmlFor="site-cover-zoom" style={{ ...labelStyle, marginBottom: '4px' }}>
                Zoom da foto
              </label>
              <input
                id="site-cover-zoom"
                type="range"
                min={0}
                max={100}
                value={zoomDraft}
                onChange={(e) => setZoomDraft(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--wedding-color)' }}
              />
              <p style={{ fontSize: '12.5px', color: 'var(--muted-fg)', marginTop: '2px' }}>
                {zoomDraft === 0 ? 'Sem zoom extra' : `${zoomDraft}%`}
                {' — '}aumente se a foto estiver aparecendo pequena/afastada demais no estilo Portfólio
                {templateDraft === 'portfolio' ? ' (capa em tela cheia).' : ' (também vale para o estilo Clássico, em fotos com composição ruim).'}
              </p>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'var(--wedding-color-subtle)', color: 'var(--wedding-color-dark)', border: 'none',
              borderRadius: '12px', padding: '10px 16px',
              fontWeight: 600, fontSize: '14px', cursor: uploading ? 'wait' : 'pointer',
              opacity: uploading ? 0.7 : 1,
            }}
          >
            {showUploadSpinner ? <Spinner color="var(--wedding-color-dark)" /> : <UploadIcon />}
            {uploading ? 'Enviando…' : 'Enviar foto de capa'}
          </button>
        )}
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
        <p style={{ fontSize: '12.5px', color: 'var(--muted-fg)', marginTop: '6px' }}>
          Aparece atrás do nome de vocês na capa do site. O ideal é uma foto na horizontal — mas qualquer formato funciona.
        </p>
      </div>

      <div>
        <label htmlFor="site-slug" style={labelStyle}>Endereço do site</label>
        <input
          id="site-slug"
          type="text"
          required
          maxLength={60}
          value={slugDraft}
          onChange={(e) => setSlugDraft(e.target.value)}
          placeholder="ana-e-joao"
          style={inputStyle}
        />
        <p style={{ fontSize: '12.5px', color: 'var(--muted-fg)', marginTop: '6px' }}>
          {publicUrl ?? 'Apenas letras minúsculas, números e hífens.'}
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '4px 0' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--fg)' }}>Publicar site</div>
          <div style={{ fontSize: '13px', color: 'var(--muted-fg)', marginTop: '2px' }}>
            Enquanto estiver desligado, apenas você vê o site.
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={publishedDraft}
          aria-label="Publicar site"
          onClick={() => setPublishedDraft((v) => !v)}
          style={{
            width: '46px', height: '26px', borderRadius: '99px', border: 'none', flexShrink: 0,
            background: publishedDraft ? 'var(--wedding-color)' : '#D8CCC0',
            position: 'relative', cursor: 'pointer', transition: 'background 0.2s ease',
          }}
        >
          <span
            style={{
              position: 'absolute', top: '3px', left: publishedDraft ? '23px' : '3px',
              width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
              boxShadow: '0 1px 3px rgba(60,40,24,0.25)', transition: 'left 0.2s ease',
            }}
          />
        </button>
      </div>

      {error && <p role="alert" style={{ fontSize: '13.5px', color: '#C0553F', margin: 0 }}>{error}</p>}

      <button type="submit" disabled={saving} style={saveButtonStyle(saving)}>
        {showSpinner && <Spinner color="#fff" />} Salvar capa
      </button>
    </form>
  )
}

interface HistoriaSectionProps {
  ourStory:      string
  customMessage: string
  storyPhotoUrl: string | null
  saving:        boolean
  siteExists:    boolean
  template:      SiteTemplate
  onUploadPhoto: (file: File) => Promise<GalleryPhotoRecord | null>
  onDeletePhoto: (url: string) => Promise<boolean>
  onSave:        (values: { our_story: string; custom_message: string; story_photo_url: string }) => Promise<PatchResult>
  onGoToCapa:    () => void
}

function HistoriaSection({
  ourStory, customMessage, storyPhotoUrl, saving, siteExists, template, onUploadPhoto, onDeletePhoto, onSave, onGoToCapa,
}: HistoriaSectionProps) {
  const [storyDraft, setStoryDraft]     = useState(ourStory)
  const [messageDraft, setMessageDraft] = useState(customMessage)
  const [photoDraft, setPhotoDraft]     = useState<string | null>(storyPhotoUrl)
  const [uploading, setUploading]       = useState(false)
  const inputRef           = useRef<HTMLInputElement>(null)
  const showSpinner        = useDelayedLoading(saving)
  const showUploadSpinner  = useDelayedLoading(uploading)

  if (!siteExists) return <GuardNotice onGoToCapa={onGoToCapa} />

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || uploading) return

    setUploading(true)
    const uploaded = await onUploadPhoto(file)
    setUploading(false)
    if (!uploaded) return

    setPhotoDraft(uploaded.public_url)
  }

  async function handleRemovePhoto() {
    if (!photoDraft) return
    const url = photoDraft
    setPhotoDraft(null)
    await onDeletePhoto(url)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const result = await onSave({
      our_story: storyDraft.trim(), custom_message: messageDraft.trim(), story_photo_url: photoDraft ?? '',
    })
    if (!result.ok) {
      toastError(result.message)
      return
    }
    toastSuccess('História salva com sucesso!')
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="site-our-story" style={labelStyle}>Nossa história</label>
        <textarea
          id="site-our-story"
          rows={8}
          maxLength={4000}
          value={storyDraft}
          onChange={(e) => setStoryDraft(e.target.value)}
          placeholder="Como vocês se conheceram, o pedido, curiosidades sobre o casal…"
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font-body)' }}
        />
      </div>

      {/* Só o Portfólio lê story_photo_url (portfolio-site.tsx) — no Clássico o campo não teria efeito nenhum */}
      {template === 'portfolio' && (
        <div>
          <label style={labelStyle}>Foto de destaque desta seção</label>
          <p style={{ fontSize: '12.5px', color: 'var(--muted-fg)', margin: '-2px 0 8px' }}>
            Aparece ao lado da sua história no site — escolha a que mais representa vocês.
          </p>
          {photoDraft ? (
            <div className="relative overflow-hidden rounded-2xl" style={{ border: '1.5px solid #EBDDD0' }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- URL do Storage, sem domínio fixo para configurar no next/image */}
              <img
                src={photoDraft}
                alt="Foto de destaque da história"
                style={{ width: '100%', height: '150px', objectFit: 'cover', display: 'block' }}
              />
              <button
                type="button"
                onClick={handleRemovePhoto}
                aria-label="Remover foto de destaque"
                style={{
                  position: 'absolute', top: '10px', right: '10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '30px', height: '30px', border: 'none', borderRadius: '10px',
                  background: 'rgba(20,12,4,0.55)', color: '#fff', cursor: 'pointer',
                }}
              >
                <TrashIcon />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'var(--wedding-color-subtle)', color: 'var(--wedding-color-dark)', border: 'none',
                borderRadius: '12px', padding: '10px 16px',
                fontWeight: 600, fontSize: '14px', cursor: uploading ? 'wait' : 'pointer',
                opacity: uploading ? 0.7 : 1,
              }}
            >
              {showUploadSpinner ? <Spinner color="var(--wedding-color-dark)" /> : <UploadIcon />}
              {uploading ? 'Enviando…' : 'Enviar foto de destaque'}
            </button>
          )}
          <input ref={inputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
        </div>
      )}

      <div>
        <label htmlFor="site-custom-message" style={labelStyle}>Mensagem para os convidados</label>
        <textarea
          id="site-custom-message"
          rows={3}
          maxLength={600}
          value={messageDraft}
          onChange={(e) => setMessageDraft(e.target.value)}
          placeholder="Um recado especial para quem visitar o site."
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font-body)' }}
        />
      </div>

      <button type="submit" disabled={saving} style={saveButtonStyle(saving)}>
        {showSpinner && <Spinner color="#fff" />} Salvar história
      </button>
    </form>
  )
}

interface CerimoniaSectionProps {
  ceremonyInfo:  string
  receptionInfo: string
  dressCode:     string
  saving:        boolean
  siteExists:    boolean
  onSave:        (values: { ceremony_info: string; reception_info: string; dress_code: string }) => Promise<PatchResult>
  onGoToCapa:    () => void
}

function CerimoniaSection({ ceremonyInfo, receptionInfo, dressCode, saving, siteExists, onSave, onGoToCapa }: CerimoniaSectionProps) {
  const [ceremonyDraft, setCeremonyDraft]   = useState(ceremonyInfo)
  const [receptionDraft, setReceptionDraft] = useState(receptionInfo)
  const [dressCodeDraft, setDressCodeDraft] = useState(dressCode)
  const showSpinner = useDelayedLoading(saving)

  if (!siteExists) return <GuardNotice onGoToCapa={onGoToCapa} />

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const result = await onSave({
      ceremony_info: ceremonyDraft.trim(),
      reception_info: receptionDraft.trim(),
      dress_code: dressCodeDraft.trim(),
    })
    if (!result.ok) {
      toastError(result.message)
      return
    }
    toastSuccess('Informações salvas com sucesso!')
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="site-ceremony-info" style={labelStyle}>Cerimônia</label>
        <textarea
          id="site-ceremony-info"
          rows={4}
          maxLength={2000}
          value={ceremonyDraft}
          onChange={(e) => setCeremonyDraft(e.target.value)}
          placeholder="Endereço, horário e observações da cerimônia."
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font-body)' }}
        />
      </div>
      <div>
        <label htmlFor="site-reception-info" style={labelStyle}>Festa</label>
        <textarea
          id="site-reception-info"
          rows={4}
          maxLength={2000}
          value={receptionDraft}
          onChange={(e) => setReceptionDraft(e.target.value)}
          placeholder="Endereço, horário e observações da recepção/festa."
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font-body)' }}
        />
      </div>
      <div>
        <label htmlFor="site-dress-code" style={labelStyle}>Dress code (opcional)</label>
        <textarea
          id="site-dress-code"
          rows={2}
          maxLength={300}
          value={dressCodeDraft}
          onChange={(e) => setDressCodeDraft(e.target.value)}
          placeholder="Ex: Traje esporte fino. Evitem branco e tons de verde-militar."
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font-body)' }}
        />
      </div>

      <button type="submit" disabled={saving} style={saveButtonStyle(saving)}>
        {showSpinner && <Spinner color="#fff" />} Salvar cerimônia & festa
      </button>
    </form>
  )
}

function RsvpSection() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <p style={{ fontSize: '14px', color: 'var(--fg)', lineHeight: 1.6, margin: 0 }}>
        Não há um formulário público de confirmação de presença. Cada convidado recebe um link pessoal
        de RSVP por WhatsApp, gerado a partir da sua lista de convidados.
      </p>
      <p style={{ fontSize: '13.5px', color: 'var(--muted-fg)', lineHeight: 1.6, margin: 0 }}>
        Gerencie os convites e envie os links em{' '}
        <Link href="/convidados" style={{ color: 'var(--wedding-color)', fontWeight: 600, textDecoration: 'underline' }}>
          Convidados
        </Link>.
      </p>
    </div>
  )
}

function PresentesSection() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <p style={{ fontSize: '14px', color: 'var(--fg)', lineHeight: 1.6, margin: 0 }}>
        Os itens da sua lista de presentes aparecem automaticamente no site público — não é preciso
        cadastrá-los aqui novamente.
      </p>
      <p style={{ fontSize: '13.5px', color: 'var(--muted-fg)', lineHeight: 1.6, margin: 0 }}>
        Gerencie os itens em{' '}
        <Link href="/presentes" style={{ color: 'var(--wedding-color)', fontWeight: 600, textDecoration: 'underline' }}>
          Lista de presentes
        </Link>.
      </p>
    </div>
  )
}

interface GaleriaSectionProps {
  galleryUrls:       string[]
  photoMeta:         Record<string, GalleryPhotoMeta>
  saving:            boolean
  siteExists:        boolean
  storageLimitBytes: number
  usedBytes:         number
  // Estilo do site ATUALMENTE selecionado na aba Capa (não necessariamente o publicado) —
  // decide o teto de fotos exibido aqui via GALLERY_PHOTO_LIMIT_BY_TEMPLATE. `null` = sem
  // teto (estilo clássico).
  template:          SiteTemplate
  onUploadPhoto:     (file: File) => Promise<GalleryPhotoRecord | null>
  onDeletePhoto:     (url: string) => Promise<boolean>
  onUpdatePhotoMeta: (url: string, patch: { position_y?: number; fit_contain?: boolean }) => void
  onSave:            (values: { gallery_urls: string[] }) => Promise<PatchResult>
  onGoToCapa:        () => void
}

function GaleriaSection({
  galleryUrls, photoMeta, saving, siteExists, storageLimitBytes, usedBytes, template,
  onUploadPhoto, onDeletePhoto, onUpdatePhotoMeta, onSave, onGoToCapa,
}: GaleriaSectionProps) {
  const [urls, setUrls]           = useState<string[]>(galleryUrls)
  const [newUrl, setNewUrl]       = useState('')
  const [uploading, setUploading] = useState(false)
  // Progresso do lote de upload (múltiplos arquivos selecionados de uma vez) — null fora de um upload
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null)
  // Qual item da lista tem o painel de ajuste (posição/recorte) aberto — só um por vez, pra
  // não poluir a grade toda de miniaturas com sliders sempre visíveis.
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null)
  const inputRef     = useRef<HTMLInputElement>(null)
  const showSpinner  = useDelayedLoading(saving)
  const showUploadSpinner = useDelayedLoading(uploading)

  if (!siteExists) return <GuardNotice onGoToCapa={onGoToCapa} />

  const usedPct = storageLimitBytes > 0 ? Math.min(100, (usedBytes / storageLimitBytes) * 100) : 0

  // Teto de fotos do estilo escolhido — a grade do portfólio foi desenhada pra uma
  // quantidade controlada de fotos (ver template-limits.ts). O clássico não tem teto.
  const galleryLimit = GALLERY_PHOTO_LIMIT_BY_TEMPLATE[template]
  const atGalleryLimit = galleryLimit !== null && urls.length >= galleryLimit

  function addUrl() {
    if (atGalleryLimit) return
    const trimmed = newUrl.trim()
    if (!trimmed) return
    setUrls((prev) => [...prev, trimmed])
    setNewUrl('')
  }

  // Upload em lote: envia um arquivo de cada vez (sequencial, não em paralelo) para que a
  // checagem de cota de armazenamento (checkStorageLimit, feita a cada POST) sempre veja o
  // uso já atualizado pelos uploads anteriores do mesmo lote. Decisão de UX: continuamos o
  // lote mesmo se um arquivo estourar a cota ou falhar — os que couberem são enviados
  // normalmente, e o resumo ao final avisa quantos não couberam (em vez de abortar o lote
  // inteiro no primeiro erro, o que descartaria uploads que já eram válidos).
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (selected.length === 0 || uploading || atGalleryLimit) return

    // Corta o lote no que ainda cabe no teto do estilo atual — melhor enviar os primeiros
    // arquivos válidos do que rejeitar o lote inteiro por causa dos últimos.
    const remainingSlots = galleryLimit !== null ? Math.max(0, galleryLimit - urls.length) : selected.length
    const files          = selected.slice(0, remainingSlots)
    const skippedCount   = selected.length - files.length

    setUploading(true)
    let successCount = 0
    const failedNames: string[] = []

    for (let i = 0; i < files.length; i++) {
      setUploadProgress({ current: i + 1, total: files.length })
      const file = files[i]
      if (!file) continue

      const uploaded = await onUploadPhoto(file)
      if (uploaded) {
        setUrls((prev) => [...prev, uploaded.public_url])
        successCount++
      } else {
        failedNames.push(file.name)
      }
    }

    setUploadProgress(null)
    setUploading(false)

    if (successCount > 0) {
      toastSuccess(
        files.length === 1
          ? 'Foto enviada com sucesso!'
          : `${successCount} de ${files.length} fotos enviadas com sucesso!`,
      )
    }
    if (failedNames.length > 0) {
      toastError(`Não foi possível enviar: ${failedNames.join(', ')}.`)
    }
    if (skippedCount > 0) {
      toastError(
        skippedCount === 1
          ? '1 foto não foi enviada: limite de fotos do estilo atual atingido.'
          : `${skippedCount} fotos não foram enviadas: limite de fotos do estilo atual atingido.`,
      )
    }
  }

  async function removeUrl(index: number) {
    const url = urls[index]
    setUrls((prev) => prev.filter((_, i) => i !== index))
    setExpandedUrl((prev) => (prev === url ? null : prev))
    if (url === undefined) return

    // Best-effort: a foto já saiu da lista visível independente do resultado da chamada —
    // uma falha aqui deixa o objeto órfão no storage/tabela, mas não deve travar o usuário.
    await onDeletePhoto(url)
  }

  // Reordena localmente só trocando a posição no array — a ORDEM de `gallery_urls` é a
  // única forma hoje de controlar onde cada foto aparece nos templates (as 8 primeiras
  // viram "Nossa história" no clássico; a primeira vira o destaque em "Sobre os noivos"
  // no portfólio quando não há `story_photo_url` definido). Só grava no servidor quando o
  // formulário é submetido, como as outras mudanças desta seção.
  function moveUrl(index: number, direction: -1 | 1) {
    setUrls((prev) => {
      const target = index + direction
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      const temp = next[index]
      next[index] = next[target] as string
      next[target] = temp as string
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const result = await onSave({ gallery_urls: urls })
    if (!result.ok) {
      toastError(result.message)
      return
    }
    toastSuccess('Galeria salva com sucesso!')
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div
        className="rounded-2xl bg-[var(--surface)] p-4"
        style={{ boxShadow: '0 6px 18px rgba(60,40,24,0.07)' }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--fg)' }}>Armazenamento usado</span>
          <span style={{ fontSize: '13px', color: 'var(--muted-fg)' }}>
            {formatBytes(usedBytes)} de {formatBytes(storageLimitBytes)} usados
          </span>
        </div>
        <div style={{ height: '8px', borderRadius: '99px', background: 'var(--wedding-color-subtle)', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%', width: `${usedPct}%`, borderRadius: '99px',
              background: usedPct >= 90 ? '#C0553F' : 'var(--wedding-color)',
              transition: 'width 0.3s',
            }}
          />
        </div>
      </div>

      {/* Teto de fotos do estilo atual (só o portfólio tem um) — a grade dele foi desenhada
          pra uma quantidade controlada, então o limite existe pra manter o equilíbrio visual,
          não é uma cota de armazenamento (essa já aparece acima). */}
      {galleryLimit !== null && (
        <div
          className="flex items-center justify-between rounded-2xl p-4"
          style={{
            background:  atGalleryLimit ? '#FBEEE6' : 'var(--wedding-color-subtle)',
            border:      atGalleryLimit ? '1px solid #E0B89A' : '1px solid transparent',
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: 600, color: atGalleryLimit ? '#A87050' : 'var(--wedding-color-dark)' }}>
            {urls.length} de {galleryLimit} fotos
          </span>
          {atGalleryLimit && (
            <span style={{ fontSize: '12.5px', color: '#A87050' }}>
              Limite do estilo Portfólio atingido — remova uma foto ou troque de estilo na aba Capa.
            </span>
          )}
        </div>
      )}

      <div>
        <label htmlFor="site-gallery-url" style={labelStyle}>Adicionar imagem (URL)</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            id="site-gallery-url"
            type="url"
            maxLength={2048}
            value={newUrl}
            disabled={atGalleryLimit}
            onChange={(e) => setNewUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addUrl() } }}
            placeholder="https://..."
            style={{ ...inputStyle, opacity: atGalleryLimit ? 0.6 : 1 }}
          />
          <button
            type="button"
            onClick={addUrl}
            disabled={atGalleryLimit}
            aria-label="Adicionar imagem"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '46px', flexShrink: 0, border: 'none', borderRadius: '12px',
              background: 'var(--wedding-color-subtle)', color: 'var(--wedding-color-dark)',
              cursor: atGalleryLimit ? 'not-allowed' : 'pointer', opacity: atGalleryLimit ? 0.6 : 1,
            }}
          >
            <PlusIcon />
          </button>
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || atGalleryLimit}
          title={atGalleryLimit ? `Limite de ${galleryLimit} fotos do estilo Portfólio atingido.` : undefined}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'var(--wedding-color-subtle)', color: 'var(--wedding-color-dark)', border: 'none',
            borderRadius: '12px', padding: '10px 16px',
            fontWeight: 600, fontSize: '14px',
            cursor: atGalleryLimit ? 'not-allowed' : uploading ? 'wait' : 'pointer',
            opacity: uploading || atGalleryLimit ? 0.6 : 1,
          }}
        >
          {showUploadSpinner ? <Spinner color="var(--wedding-color-dark)" /> : <UploadIcon />}
          {uploadProgress ? `Enviando ${uploadProgress.current} de ${uploadProgress.total}…` : uploading ? 'Enviando…' : 'Enviar do computador'}
        </button>
        <input ref={inputRef} type="file" accept="image/*" multiple disabled={atGalleryLimit} onChange={handleFileChange} style={{ display: 'none' }} />
      </div>

      {urls.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--muted-fg)', margin: 0 }}>Nenhuma imagem adicionada ainda.</p>
      ) : (
        <>
        <p style={{ fontSize: '12.5px', color: 'var(--muted-fg)', margin: '0 0 -4px' }}>
          Use as setas para reordenar — a ordem define quais fotos aparecem primeiro no site.
        </p>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {urls.map((url, index) => {
            const meta       = photoMeta[url]
            const isExpanded = expandedUrl === url

            return (
              <li key={`${url}-${index}`} style={{ borderRadius: '10px', border: '1px solid #EBDDD0', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- URL do Storage ou externa, sem domínio fixo para configurar no next/image */}
                  <img
                    src={url}
                    alt=""
                    style={{
                      width: '44px', height: '44px', borderRadius: '8px', flexShrink: 0,
                      objectFit:      meta?.fit_contain ? 'contain' : 'cover',
                      objectPosition: `center ${meta?.position_y ?? 50}%`,
                      background: '#F1E9DD',
                    }}
                  />
                  <span style={{ flex: 1, fontSize: '13px', color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {url}
                  </span>
                  <button
                    type="button"
                    onClick={() => moveUrl(index, -1)}
                    disabled={index === 0}
                    aria-label="Mover foto para cima"
                    style={{
                      display: 'flex', border: 'none', cursor: index === 0 ? 'not-allowed' : 'pointer', padding: '6px', borderRadius: '8px',
                      background: 'transparent', color: 'var(--wedding-color-dark)', opacity: index === 0 ? 0.35 : 1,
                    }}
                  >
                    <ArrowUpIcon />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveUrl(index, 1)}
                    disabled={index === urls.length - 1}
                    aria-label="Mover foto para baixo"
                    style={{
                      display: 'flex', border: 'none', cursor: index === urls.length - 1 ? 'not-allowed' : 'pointer', padding: '6px', borderRadius: '8px',
                      background: 'transparent', color: 'var(--wedding-color-dark)', opacity: index === urls.length - 1 ? 0.35 : 1,
                    }}
                  >
                    <ArrowDownIcon />
                  </button>
                  {meta && (
                    <button
                      type="button"
                      onClick={() => setExpandedUrl(isExpanded ? null : url)}
                      aria-label="Ajustar posição e recorte da foto"
                      aria-expanded={isExpanded}
                      style={{
                        display: 'flex', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '8px',
                        background: isExpanded ? 'var(--wedding-color-subtle)' : 'transparent',
                        color: 'var(--wedding-color-dark)',
                      }}
                    >
                      <CropIcon />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeUrl(index)}
                    aria-label="Remover imagem"
                    style={{ border: 'none', background: 'transparent', color: '#C0553F', cursor: 'pointer', padding: '4px' }}
                  >
                    <TrashIcon />
                  </button>
                </div>

                {isExpanded && meta && (
                  <div style={{ padding: '4px 14px 14px', borderTop: '1px solid #EBDDD0', background: '#FBF7F2' }}>
                    <label htmlFor={`gallery-position-${meta.id}`} style={{ ...labelStyle, fontSize: '12px', marginTop: '10px', marginBottom: '4px' }}>
                      Posição vertical
                    </label>
                    <input
                      id={`gallery-position-${meta.id}`}
                      type="range"
                      min={0}
                      max={100}
                      value={meta.position_y}
                      disabled={meta.fit_contain}
                      onChange={(e) => onUpdatePhotoMeta(url, { position_y: Number(e.target.value) })}
                      style={{ width: '100%', accentColor: 'var(--wedding-color)', opacity: meta.fit_contain ? 0.5 : 1 }}
                    />
                    <p style={{ fontSize: '12px', color: 'var(--muted-fg)', margin: '2px 0 10px' }}>
                      {meta.fit_contain
                        ? 'Desative "ajustar sem cortar" para usar a posição.'
                        : meta.position_y === 0 ? 'Topo' : meta.position_y === 100 ? 'Base' : meta.position_y === 50 ? 'Centro' : `${meta.position_y}%`}
                    </p>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--fg)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={meta.fit_contain}
                        onChange={(e) => onUpdatePhotoMeta(url, { fit_contain: e.target.checked })}
                      />
                      Ajustar sem cortar (mostra a foto inteira, sem recorte)
                    </label>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        </>
      )}

      <button type="submit" disabled={saving} style={saveButtonStyle(saving)}>
        {showSpinner && <Spinner color="#fff" />} Salvar galeria
      </button>
    </form>
  )
}

export default function SiteBuilder({
  weddingId, coupleNames, initialSite, storageLimitBytes, storageUsedBytes, albumEnabled,
}: SiteBuilderProps) {
  const [active, setActive]       = useState<SectionId>('capa')
  const [siteId, setSiteId]       = useState<string | null>(initialSite?.id ?? null)
  const [slug, setSlug]           = useState(initialSite?.slug ?? '')
  const [published, setPublished] = useState(initialSite?.published ?? false)
  const [template, setTemplate]   = useState<SiteTemplate>(initialSite?.template ?? 'classic')
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string | null>(initialSite?.cover_photo_url ?? null)
  const [coverPhotoPosition, setCoverPhotoPosition] = useState(initialSite?.cover_photo_position ?? 50)
  const [coverPhotoZoom, setCoverPhotoZoom] = useState(initialSite?.cover_photo_zoom ?? 0)
  const [content, setContent]     = useState<SiteContent>(() => parseSiteContent(initialSite?.content))
  const [saving, setSaving]       = useState(false)
  const origin                    = useOrigin()

  // Cota de armazenamento e tamanhos por foto (bucket "wedding-photos") são compartilhados
  // entre a foto de capa e a galeria — ambas usam o mesmo endpoint de registro de metadados.
  const [usedBytes, setUsedBytes]   = useState(storageUsedBytes)
  const [photoSizes, setPhotoSizes] = useState<Record<string, number>>({})
  // Ajuste de posição/recorte por foto, indexado pela URL pública — só existe pra fotos
  // enviadas do computador (ver GalleryPhotoMeta). Debounce de PATCH por foto, pra não
  // disparar uma requisição a cada tick do slider de posição.
  const [photoMeta, setPhotoMeta]   = useState<Record<string, GalleryPhotoMeta>>({})
  const photoMetaPatchTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    let cancelled = false

    fetch(`/api/v1/weddings/${weddingId}/gallery-photos`)
      .then((res) => (res.ok ? (res.json() as Promise<{ data: GalleryPhotoRecord[] }>) : null))
      .then((body) => {
        if (cancelled || !body) return
        setPhotoSizes((prev) => {
          const next = { ...prev }
          for (const photo of body.data) next[photo.public_url] = photo.size_bytes
          return next
        })
        setPhotoMeta((prev) => {
          const next = { ...prev }
          for (const photo of body.data) {
            next[photo.public_url] = { id: photo.id, position_y: photo.position_y, fit_contain: photo.fit_contain }
          }
          return next
        })
      })
      .catch(() => {
        // Melhor esforço: sem esses dados, a barra de uso fica só ligeiramente
        // desatualizada até o próximo carregamento da página — não é crítico.
      })

    return () => { cancelled = true }
  }, [weddingId])

  const apiBase  = `/api/v1/weddings/${weddingId}/site`
  const publicUrl = slug ? `${origin || 'https://…'}/${slug}` : null

  // Upload compartilhado por CapaSection e GaleriaSection: sobe os bytes direto pro
  // Storage (client -> bucket, mesmo padrão de FileArchiveManager) e registra os
  // metadados via API, o que soma a foto na cota de armazenamento do plano.
  async function uploadPhoto(file: File): Promise<GalleryPhotoRecord | null> {
    const path = `${weddingId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`
    const supabase = createSupabaseBrowser()

    const { error: uploadError } = await supabase.storage.from('wedding-photos').upload(path, file)
    if (uploadError) {
      toastError('Não foi possível enviar a foto. Verifique o tamanho (máx. 8 MB) e o formato (PNG, JPG, WEBP, HEIC ou GIF).')
      return null
    }

    const res = await fetch(`/api/v1/weddings/${weddingId}/gallery-photos`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storage_path: path,
        size_bytes:   file.size,
        mime_type:    file.type || null,
      }),
    })

    if (!res.ok) {
      // O upload já subiu pro storage; sem o registro de metadados ele fica órfão — remove.
      await supabase.storage.from('wedding-photos').remove([path])
      toastError(await readApiError(res, 'Não foi possível salvar a foto.'))
      return null
    }

    const { data } = (await res.json()) as { data: GalleryPhotoRecord }
    setPhotoSizes((prev) => ({ ...prev, [data.public_url]: data.size_bytes }))
    setPhotoMeta((prev) => ({ ...prev, [data.public_url]: { id: data.id, position_y: data.position_y, fit_contain: data.fit_contain } }))
    setUsedBytes((prev) => prev + data.size_bytes)
    return data
  }

  async function deletePhoto(url: string): Promise<boolean> {
    const markerIndex = url.indexOf(GALLERY_BUCKET_URL_MARKER)
    // URL externa colada manualmente: só remove da lista de quem chamou, sem tocar na API.
    if (markerIndex === -1) return true

    const storagePath = url.slice(markerIndex + GALLERY_BUCKET_URL_MARKER.length)
    const removedSize = photoSizes[url] ?? 0

    const res = await fetch(
      `/api/v1/weddings/${weddingId}/gallery-photos?storage_path=${encodeURIComponent(storagePath)}`,
      { method: 'DELETE' },
    )

    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível remover a foto do armazenamento.'))
      return false
    }

    setPhotoSizes((prev) => {
      const next = { ...prev }
      delete next[url]
      return next
    })
    setPhotoMeta((prev) => {
      const next = { ...prev }
      delete next[url]
      return next
    })
    setUsedBytes((prev) => Math.max(0, prev - removedSize))
    return true
  }

  // Atualiza local imediatamente (prévia ao vivo do slider/toggle) e debounça o PATCH de
  // rede em 400ms — evita disparar uma requisição a cada tick do slider durante o arrasto.
  function updateGalleryPhotoMeta(url: string, patch: { position_y?: number; fit_contain?: boolean }): void {
    const meta = photoMeta[url]
    if (!meta) return

    const next = { ...meta, ...patch }
    setPhotoMeta((prev) => ({ ...prev, [url]: next }))

    const existingTimer = photoMetaPatchTimers.current[url]
    if (existingTimer) clearTimeout(existingTimer)

    photoMetaPatchTimers.current[url] = setTimeout(() => {
      void (async () => {
        const res = await fetch(`/api/v1/weddings/${weddingId}/gallery-photos/${next.id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ position_y: next.position_y, fit_contain: next.fit_contain }),
        })
        if (!res.ok) {
          toastError(await readApiError(res, 'Não foi possível salvar o ajuste da foto.'))
        }
      })()
    }, 400)
  }

  async function patchSite(
    body: {
      slug?: string; published?: boolean; template?: SiteTemplate; cover_photo_url?: string | null
      cover_photo_position?: number; cover_photo_zoom?: number; content?: SiteContent
    },
  ): Promise<PatchResult> {
    setSaving(true)
    const res = await fetch(apiBase, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    setSaving(false)

    if (!res.ok) {
      return { ok: false, message: await readApiError(res, 'Não foi possível salvar. Tente novamente.') }
    }

    const { data } = (await res.json()) as { data: SiteConfig }
    setSiteId(data.id)
    setSlug(data.slug)
    setPublished(data.published)
    setTemplate(data.template)
    setCoverPhotoUrl(data.cover_photo_url)
    setCoverPhotoPosition(data.cover_photo_position)
    setCoverPhotoZoom(data.cover_photo_zoom)
    setContent(parseSiteContent(data.content))
    return { ok: true, message: '' }
  }

  async function saveCapa(
    values: {
      slug: string; published: boolean; template: SiteTemplate
      coverTitle: string; coverPhotoUrl: string | null; coverPhotoPosition: number; coverPhotoZoom: number
    },
  ): Promise<PatchResult> {
    const nextContent: SiteContent = { ...content }
    if (values.coverTitle) nextContent.cover_title = values.coverTitle
    else delete nextContent.cover_title

    return patchSite({
      slug: values.slug, published: values.published, template: values.template, cover_photo_url: values.coverPhotoUrl,
      cover_photo_position: values.coverPhotoPosition, cover_photo_zoom: values.coverPhotoZoom, content: nextContent,
    })
  }

  async function saveContentPatch(patch: Partial<SiteContent>): Promise<PatchResult> {
    const nextContent: SiteContent = { ...content }

    const textKeys = ['cover_title', 'our_story', 'story_photo_url', 'ceremony_info', 'reception_info', 'custom_message', 'dress_code'] as const
    for (const key of textKeys) {
      if (!(key in patch)) continue
      const value = patch[key]
      if (value) nextContent[key] = value
      else delete nextContent[key]
    }

    if ('gallery_urls' in patch) {
      if (patch.gallery_urls && patch.gallery_urls.length > 0) nextContent.gallery_urls = patch.gallery_urls
      else delete nextContent.gallery_urls
    }

    return patchSite({ content: nextContent })
  }

  const siteExists = siteId !== null

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            className="font-display"
            style={{ fontWeight: 500, fontSize: 'clamp(30px,4.2vw,42px)', lineHeight: 1.05, color: 'var(--fg)' }}
          >
            Site do casal
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '14px', color: 'var(--muted-fg)' }}>
            <GlobeIcon />
            <span>{publicUrl ?? `${origin || 'https://…'}/seu-slug`}</span>
          </div>
        </div>
        {published && publicUrl ? (
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'var(--wedding-color)', color: '#fff', textDecoration: 'none',
              borderRadius: '12px', padding: '11px 18px',
              fontWeight: 600, fontSize: '14px',
              boxShadow: '0 6px 16px color-mix(in srgb, var(--wedding-color) 32%, transparent)',
            }}
          >
            <ExternalLinkIcon /> Ver site publicado
          </a>
        ) : (
          <span
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'var(--wedding-color-subtle)', color: 'var(--wedding-color-dark)',
              borderRadius: '12px', padding: '11px 18px', fontWeight: 600, fontSize: '14px',
            }}
          >
            {siteExists ? 'Rascunho — ainda não publicado' : 'Configure a capa para criar seu site'}
          </span>
        )}
      </div>

      {/* Two columns */}
      <div className="grid gap-5 grid-cols-1 md:grid-cols-[260px_1fr]">
        {/* Sections list */}
        <div className="flex flex-col gap-2">
          {SECTIONS.map((s) => {
            const isActive = active === s.id
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '13px 16px', borderRadius: '14px',
                  border: isActive ? '1.5px solid color-mix(in srgb, var(--wedding-color) 35%, transparent)' : '1px solid transparent',
                  background: isActive ? 'var(--wedding-color-subtle)' : '#FFFFFF',
                  color: isActive ? 'var(--wedding-color-dark)' : '#3C2818',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '14px', cursor: 'pointer',
                  textAlign: 'left',
                  boxShadow: isActive ? '0 4px 12px color-mix(in srgb, var(--wedding-color) 12%, transparent)' : '0 2px 8px rgba(60,40,24,0.05)',
                  transition: 'all 0.18s',
                }}
              >
                <span style={{ color: isActive ? 'var(--wedding-color)' : '#9A7A60' }}>{s.icon}</span>
                {s.label}
              </button>
            )
          })}
        </div>

        {/* Editor panel */}
        <div className="rounded-2xl bg-[var(--surface)] overflow-hidden" style={{ boxShadow: '0 10px 28px rgba(60,40,24,0.10)' }}>
          {/* Browser bar */}
          <div
            style={{
              padding: '12px 16px',
              background: '#F8F3EE',
              borderBottom: '1px solid #EBDDD0',
              display: 'flex', alignItems: 'center', gap: '10px',
            }}
          >
            <div style={{ display: 'flex', gap: '6px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#EBDDD0' }} />
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--wedding-color-light)' }} />
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--wedding-color)' }} />
            </div>
            <div
              style={{
                flex: 1, padding: '5px 14px', borderRadius: '8px',
                background: '#FFFFFF', border: '1px solid #EBDDD0',
                fontSize: '12.5px', color: 'var(--muted-fg)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {publicUrl ?? `${origin || 'https://…'}/seu-slug`}
            </div>
          </div>

          {/* Editor content */}
          <div style={{ padding: '26px' }}>
            {active === 'capa' && (
              <CapaSection
                coupleNames={coupleNames}
                slug={slug}
                published={published}
                template={template}
                albumEnabled={albumEnabled}
                coverTitle={content.cover_title ?? ''}
                coverPhotoUrl={coverPhotoUrl}
                coverPhotoPosition={coverPhotoPosition}
                coverPhotoZoom={coverPhotoZoom}
                publicUrl={publicUrl}
                saving={saving}
                onUploadPhoto={uploadPhoto}
                onDeletePhoto={deletePhoto}
                onSave={saveCapa}
              />
            )}
            {active === 'historia' && (
              <HistoriaSection
                ourStory={content.our_story ?? ''}
                customMessage={content.custom_message ?? ''}
                storyPhotoUrl={content.story_photo_url ?? null}
                saving={saving}
                siteExists={siteExists}
                template={template}
                onUploadPhoto={uploadPhoto}
                onDeletePhoto={deletePhoto}
                onSave={saveContentPatch}
                onGoToCapa={() => setActive('capa')}
              />
            )}
            {active === 'cerimonia' && (
              <CerimoniaSection
                ceremonyInfo={content.ceremony_info ?? ''}
                receptionInfo={content.reception_info ?? ''}
                dressCode={content.dress_code ?? ''}
                saving={saving}
                siteExists={siteExists}
                onSave={saveContentPatch}
                onGoToCapa={() => setActive('capa')}
              />
            )}
            {active === 'rsvp' && <RsvpSection />}
            {active === 'presentes' && <PresentesSection />}
            {active === 'galeria' && (
              <GaleriaSection
                galleryUrls={content.gallery_urls ?? []}
                photoMeta={photoMeta}
                saving={saving}
                siteExists={siteExists}
                storageLimitBytes={storageLimitBytes}
                usedBytes={usedBytes}
                template={template}
                onUploadPhoto={uploadPhoto}
                onDeletePhoto={deletePhoto}
                onUpdatePhotoMeta={updateGalleryPhotoMeta}
                onSave={saveContentPatch}
                onGoToCapa={() => setActive('capa')}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
