'use client'

/* eslint-disable @next/next/no-img-element -- URLs do Storage ou externas, sem domínio fixo para configurar no next/image */
import Link from 'next/link'
import { useRef, useState } from 'react'

import RichTextEditor from '@/components/site/rich-text-editor'
import StoryEditor, { type StoryEditorHandle } from '@/components/site/story/story-editor'
import StyleContentFields from '@/components/site/style-content-fields'
import CoverPhotoEditor from '@/components/site/editor/cover-photo-editor'
import EditorGroup from '@/components/site/editor/editor-group'
import SlugField from '@/components/site/editor/slug-field'
import { TemplateImpactNotice, TemplatePicker } from '@/components/site/editor/template-picker'
import { ArrowDownIcon, ArrowUpIcon, CropIcon, PlusIcon, TrashIcon, UploadIcon } from '@/components/site/editor/icons'
import {
  cardStyle, dangerColor, disabledStyle, hintStyle, iconButtonStyle, inputStyle, labelStyle, noticeStyle,
  secondaryButtonStyle,
} from '@/components/site/editor/styles'
import Spinner from '@/components/ui/spinner'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import type { GalleryPhotoMeta, GalleryPhotoRecord } from '@/lib/site/editor-photo-api'
import { isUploadedPhotoUrl } from '@/lib/site/editor-photo-api'
import { normalizeContent, type SiteDraft } from '@/lib/site/site-draft'
import type { SiteContent } from '@/lib/site/site-content'
import { SITE_TEMPLATE_CONFIG } from '@/lib/site/template-config'
import { allowsSiteMonogram } from '@/lib/site/templates'
import { STORY_LAYOUT_LABELS, STORY_LAYOUTS_BY_TEMPLATE, type StoryLayout } from '@/lib/site/story/story-layouts'
import type { PlanId } from '@/constants/plans'
import { toastError, toastSuccess } from '@/store/toast.store'

export type DraftUpdater = (update: (draft: SiteDraft) => SiteDraft) => void

function contentPatch(onChange: DraftUpdater, patch: Partial<SiteContent>) {
  onChange((draft) => ({ ...draft, content: { ...draft.content, ...patch } }))
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function changed(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) !== JSON.stringify(b)
}

function Switch({ checked, onChange, label, id }: { checked: boolean; onChange: (value: boolean) => void; label: string; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      style={{
        width: '46px', height: '26px', borderRadius: '99px', border: 'none', flexShrink: 0,
        background: checked ? 'var(--wedding-color)' : 'var(--border)',
        position: 'relative', cursor: 'pointer', transition: 'background 0.2s ease',
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute', top: '3px', left: checked ? '23px' : '3px',
          width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
          boxShadow: '0 1px 3px rgba(60,40,24,0.25)', transition: 'left 0.2s ease',
        }}
      />
    </button>
  )
}

// ───────────────────────── Capa ─────────────────────────

interface CapaSectionProps {
  draft:        SiteDraft
  saved:        SiteDraft
  planId:       PlanId
  weddingId:    string
  coupleNames:  string
  origin:       string
  onChange:     DraftUpdater
  onUploadPhoto: (file: File) => Promise<GalleryPhotoRecord | null>
}

export function CapaSection({ draft, saved, planId, weddingId, coupleNames, origin, onChange, onUploadPhoto }: CapaSectionProps) {
  const [uploading, setUploading] = useState(false)
  const config = SITE_TEMPLATE_CONFIG[draft.template]
  const a = normalizeContent(draft.content)
  const b = normalizeContent(saved.content)
  const styleKeys = ['hero_subtitle', 'story_heading', 'gallery_heading', 'envelope_caption', 'opening_hint', 'envelope_monogram'] as const

  const styleDirty = draft.template !== saved.template || styleKeys.some((key) => a[key] !== b[key])
  const coverDirty = a.cover_title !== b.cover_title || draft.coverPhotoUrl !== saved.coverPhotoUrl
    || draft.coverPhotoPosition !== saved.coverPhotoPosition || draft.coverPhotoZoom !== saved.coverPhotoZoom
  const addressDirty = draft.slug.trim() !== saved.slug || draft.published !== saved.published

  async function handlePickCover(file: File) {
    if (uploading) return
    setUploading(true)
    const uploaded = await onUploadPhoto(file)
    setUploading(false)
    if (!uploaded) return
    // Foto nova: volta pro centro/sem zoom, em vez de manter o ajuste da foto anterior.
    onChange((current) => ({ ...current, coverPhotoUrl: uploaded.public_url, coverPhotoPosition: 50, coverPhotoZoom: 0 }))
  }

  return (
    <div className="flex flex-col gap-4">
      <EditorGroup title="Estilo do site" summary={config.label} defaultOpen={false} dirty={styleDirty}>
        <TemplatePicker
          value={draft.template}
          planId={planId}
          galleryCount={draft.content.gallery_urls?.length ?? 0}
          onChange={(template) => onChange((current) => ({ ...current, template }))}
        />
        <TemplateImpactNotice
          template={draft.template}
          savedTemplate={saved.template}
          galleryCount={draft.content.gallery_urls?.length ?? 0}
          storyLayout={draft.content.story_layout}
          hasStoryPhoto={Boolean(draft.content.story_photo_url)}
        />
        <StyleContentFields
          monogramEnabled={allowsSiteMonogram(planId)}
          template={draft.template}
          content={draft.content}
          onChange={(key, value) => contentPatch(onChange, { [key]: value })}
        />
      </EditorGroup>

      <EditorGroup
        title="Capa"
        summary={`${draft.content.cover_title?.trim() || coupleNames} · ${draft.coverPhotoUrl ? 'com foto' : 'sem foto'}`}
        dirty={coverDirty}
      >
        <div>
          <label htmlFor="site-cover-title" style={labelStyle}>Título da capa</label>
          <input
            id="site-cover-title"
            type="text"
            maxLength={160}
            value={draft.content.cover_title ?? ''}
            onChange={(e) => contentPatch(onChange, { cover_title: e.target.value })}
            placeholder={coupleNames}
            style={inputStyle}
          />
          <p style={hintStyle}>Se deixar em branco, usamos &ldquo;{coupleNames}&rdquo;.</p>
        </div>

        <CoverPhotoEditor
          url={draft.coverPhotoUrl}
          position={draft.coverPhotoPosition}
          zoom={draft.coverPhotoZoom}
          uploading={uploading}
          onPosition={(coverPhotoPosition) => onChange((current) => ({ ...current, coverPhotoPosition }))}
          onZoom={(coverPhotoZoom) => onChange((current) => ({ ...current, coverPhotoZoom }))}
          onPickFile={handlePickCover}
          onRemove={() => onChange((current) => ({ ...current, coverPhotoUrl: null }))}
        />
      </EditorGroup>

      <EditorGroup
        title="Endereço e publicação"
        summary={`/${draft.slug} · ${draft.published ? 'Publicado' : 'Rascunho'}`}
        dirty={addressDirty}
      >
        <SlugField
          weddingId={weddingId}
          value={draft.slug}
          savedSlug={saved.slug}
          origin={origin}
          onChange={(slug) => onChange((current) => ({ ...current, slug }))}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '4px 0' }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="site-published" style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--fg)' }}>Publicar site</label>
            <p style={{ ...hintStyle, marginTop: '2px' }}>
              {draft.published
                ? 'Qualquer pessoa com o link pode ver o site.'
                : 'Desligado: só vocês veem o site, pelo botão "Pré-visualizar".'}
            </p>
          </div>
          <Switch id="site-published" checked={draft.published} onChange={(published) => onChange((current) => ({ ...current, published }))} label="Publicar site" />
        </div>
      </EditorGroup>
    </div>
  )
}

// ───────────────────────── Nossa história ─────────────────────────

function StoryLayoutPicker({ template, value, onChange }: { template: SiteDraft['template']; value: StoryLayout | undefined; onChange: (value: StoryLayout | undefined) => void }) {
  const config = STORY_LAYOUTS_BY_TEMPLATE[template]
  const unsupported = value !== undefined && !config.supported.includes(value)
  const options: { value: StoryLayout | undefined; label: string; description: string }[] = [
    { value: undefined, label: 'Apresentação original', description: 'Como o site está hoje. Os momentos e as fotos da história ficam guardados e não aparecem.' },
    ...config.supported.map((layout) => ({
      value: layout,
      label: STORY_LAYOUT_LABELS[layout].label + (layout === config.default ? ' (recomendado)' : ''),
      description: STORY_LAYOUT_LABELS[layout].description,
    })),
  ]

  return (
    <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
      <legend style={labelStyle}>Apresentação da história</legend>
      {unsupported && (
        <p role="status" style={{ ...noticeStyle, marginBottom: '8px' }}>
          O estilo {SITE_TEMPLATE_CONFIG[template].label} não tem {STORY_LAYOUT_LABELS[value].label.toLowerCase()}; o site usa {STORY_LAYOUT_LABELS[config.default].label.toLowerCase()}.
          Sua escolha continua salva e volta se você trocar para um estilo compatível.
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '8px' }}>
        {options.map((option) => {
          const checked = option.value === value
          return (
            <label
              key={option.value ?? 'legacy'}
              style={{
                display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer', padding: '10px 12px', borderRadius: '12px',
                border: `1.5px solid ${checked ? 'var(--wedding-color)' : 'var(--border)'}`, background: checked ? 'var(--wedding-color-subtle)' : 'var(--surface)',
              }}
            >
              <input type="radio" name="story-layout" checked={checked} onChange={() => onChange(option.value)} style={{ marginTop: '3px', accentColor: 'var(--wedding-color)' }} />
              <span>
                <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: 'var(--fg)' }}>{option.label}</span>
                <span style={{ display: 'block', fontSize: '12px', color: 'var(--muted-fg)', lineHeight: 1.45 }}>{option.description}</span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

interface HistoriaSectionProps {
  draft:          SiteDraft
  weddingId:      string
  coupleNames:    string
  onChange:       DraftUpdater
  onUploadPhoto:  (file: File) => Promise<GalleryPhotoRecord | null>
  onStorageDelta: (bytes: number) => void
  onStoryPendingChange: (count: number) => void
  storyRef:       React.Ref<StoryEditorHandle>
}

export function HistoriaSection({ draft, weddingId, coupleNames, onChange, onUploadPhoto, onStorageDelta, onStoryPendingChange, storyRef }: HistoriaSectionProps) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const showUploadSpinner = useDelayedLoading(uploading)
  const { content, template } = draft
  const richText = content.rich_text === true
  const isEnvelope = template === 'invitation' || template === 'enveloped'

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || uploading) return
    setUploading(true)
    const uploaded = await onUploadPhoto(file)
    setUploading(false)
    if (uploaded) contentPatch(onChange, { story_photo_url: uploaded.public_url })
  }

  return (
    <div className="flex flex-col gap-5">
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', ...cardStyle, padding: '12px 14px' }}>
        <div style={{ flex: 1 }}>
          <label htmlFor="site-rich-text" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--fg)' }}>Formatação de texto</label>
          <p style={{ ...hintStyle, marginTop: '2px' }}>
            {richText
              ? 'Negrito, itálico, tachado e links na história, nos momentos, na mensagem e em cerimônia, festa e traje.'
              : 'Ative para usar negrito, itálico, tachado e links nos textos do site. Desligada, marcações como **texto** aparecem literalmente.'}
          </p>
        </div>
        <Switch id="site-rich-text" checked={richText} onChange={(value) => contentPatch(onChange, { rich_text: value })} label="Formatação de texto" />
      </div>

      <div>
        <label htmlFor="site-our-story" style={labelStyle}>{SITE_TEMPLATE_CONFIG[template].storyLabel}</label>
        <RichTextEditor
          id="site-our-story"
          rows={8}
          maxLength={4000}
          value={content.our_story ?? ''}
          onChange={(our_story) => contentPatch(onChange, { our_story })}
          markdown={richText}
          placeholder={isEnvelope ? 'Escreva uma mensagem de convite para as pessoas que vão celebrar com vocês.' : 'Como vocês se conheceram, o pedido, curiosidades sobre o casal…'}
        />
      </div>

      <StoryLayoutPicker template={template} value={content.story_layout} onChange={(story_layout) => contentPatch(onChange, { story_layout })} />

      {/* Exibe apenas campos de foto usados pelo modelo escolhido. */}
      {SITE_TEMPLATE_CONFIG[template].storyPhoto && (
        <div>
          <span style={labelStyle}>Foto de destaque desta seção</span>
          <p style={{ ...hintStyle, margin: '-2px 0 8px' }}>Aparece ao lado da história no site — escolha a que mais representa vocês.</p>
          {content.story_photo_url ? (
            <div className="relative overflow-hidden rounded-2xl" style={{ border: '1.5px solid var(--border)' }}>
              <img src={content.story_photo_url} alt="Foto de destaque da história" style={{ width: '100%', height: '180px', objectFit: 'cover', display: 'block' }} />
              <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '6px' }}>
                <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} style={{ ...secondaryButtonStyle, padding: '6px 12px', fontSize: '13px', background: 'rgba(20,12,4,0.6)', color: '#fff' }}>
                  {showUploadSpinner ? <Spinner color="#fff" /> : <UploadIcon />} Trocar
                </button>
                <button type="button" onClick={() => contentPatch(onChange, { story_photo_url: '' })} aria-label="Remover foto de destaque" style={{ ...iconButtonStyle, background: 'rgba(20,12,4,0.6)', color: '#fff' }}>
                  <TrashIcon />
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} style={{ ...secondaryButtonStyle, cursor: uploading ? 'wait' : 'pointer' }}>
              {showUploadSpinner ? <Spinner color="var(--wedding-color-dark)" /> : <UploadIcon />}
              {uploading ? 'Enviando…' : 'Enviar foto de destaque'}
            </button>
          )}
          <input ref={inputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
        </div>
      )}

      <div>
        <label htmlFor="site-custom-message" style={labelStyle}>Mensagem para os convidados</label>
        <RichTextEditor
          id="site-custom-message"
          rows={3}
          maxLength={600}
          value={content.custom_message ?? ''}
          onChange={(custom_message) => contentPatch(onChange, { custom_message })}
          markdown={richText}
          placeholder="Um recado especial para quem visitar o site."
        />
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '18px' }}>
        <StoryEditor
          ref={storyRef}
          weddingId={weddingId}
          template={template}
          coupleNames={coupleNames}
          markdown={richText}
          storyText={content.our_story ?? ''}
          layout={content.story_layout}
          heading={content.story_heading}
          onStorageDelta={onStorageDelta}
          onPendingChange={onStoryPendingChange}
        />
      </div>
    </div>
  )
}

// ───────────────────────── Cerimônia & festa ─────────────────────────

export function CerimoniaSection({ draft, onChange }: { draft: SiteDraft; onChange: DraftUpdater }) {
  const { content } = draft
  const richText = content.rich_text === true

  return (
    <div className="flex flex-col gap-4">
      <p style={{ ...noticeStyle }}>
        A data e o local cadastrados no casamento já aparecem no site, com o botão &ldquo;Como chegar&rdquo;. Use os campos abaixo para horários e detalhes.
      </p>
      <div>
        <label htmlFor="site-ceremony-info" style={labelStyle}>Cerimônia</label>
        <RichTextEditor id="site-ceremony-info" rows={4} maxLength={2000} value={content.ceremony_info ?? ''} onChange={(ceremony_info) => contentPatch(onChange, { ceremony_info })} markdown={richText} placeholder="Endereço, horário e observações da cerimônia." />
      </div>
      <div>
        <label htmlFor="site-reception-info" style={labelStyle}>Festa</label>
        <RichTextEditor id="site-reception-info" rows={4} maxLength={2000} value={content.reception_info ?? ''} onChange={(reception_info) => contentPatch(onChange, { reception_info })} markdown={richText} placeholder="Endereço, horário e observações da recepção/festa." />
      </div>
      <div>
        <label htmlFor="site-dress-code" style={labelStyle}>Dress code (opcional)</label>
        <RichTextEditor id="site-dress-code" rows={2} maxLength={300} value={content.dress_code ?? ''} onChange={(dress_code) => contentPatch(onChange, { dress_code })} markdown={richText} placeholder="Ex: Traje esporte fino. Evitem branco e tons de verde-militar." />
      </div>
    </div>
  )
}

// ───────────────────────── RSVP e Presentes ─────────────────────────

export interface RsvpStats { total: number; confirmed: number; declined: number; pending: number }
export interface GiftStats { total: number; purchased: number }

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <div style={{ flex: '1 1 110px', borderRadius: '12px', background: 'var(--muted)', border: '1px solid var(--border)', padding: '12px 14px' }}>
      <div className="font-display" style={{ fontSize: '28px', fontWeight: 500, lineHeight: 1, color: 'var(--fg)' }}>{value}</div>
      <div style={{ fontSize: '12.5px', color: 'var(--muted-fg)', marginTop: '4px' }}>{label}</div>
    </div>
  )
}

function VisibilityToggle({ id, title, description, visible, onChange }: { id: string; title: string; description: string; visible: boolean; onChange: (visible: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', ...cardStyle }}>
      <div style={{ flex: 1 }}>
        <label htmlFor={id} style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--fg)' }}>{title}</label>
        <p style={{ ...hintStyle, marginTop: '2px' }}>{description}</p>
      </div>
      <Switch id={id} checked={visible} onChange={onChange} label={title} />
    </div>
  )
}

export function RsvpSection({ draft, onChange, stats }: { draft: SiteDraft; onChange: DraftUpdater; stats: RsvpStats }) {
  const visible = !draft.content.hide_rsvp
  return (
    <div className="flex flex-col gap-4">
      <VisibilityToggle
        id="site-show-rsvp"
        title="Mostrar no site"
        description={visible ? 'O site explica que cada convidado confirma pelo próprio link pessoal.' : 'A seção e os atalhos de "Confirmar presença" ficam ocultos no site.'}
        visible={visible}
        onChange={(value) => contentPatch(onChange, { hide_rsvp: !value })}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <StatTile value={stats.confirmed} label="confirmados" />
        <StatTile value={stats.pending} label="aguardando resposta" />
        <StatTile value={stats.declined} label="não vão" />
      </div>
      <p style={{ ...hintStyle, marginTop: 0 }}>
        {stats.total === 0 ? 'Nenhum convidado cadastrado ainda. ' : `${stats.total} convidados na lista. `}
        Cada convidado recebe um link pessoal de RSVP por WhatsApp. Gerencie os convites em{' '}
        <Link href="/convidados" style={{ color: 'var(--wedding-color-dark)', fontWeight: 700, textDecoration: 'underline' }}>Convidados</Link>.
      </p>
    </div>
  )
}

export function PresentesSection({ draft, onChange, stats }: { draft: SiteDraft; onChange: DraftUpdater; stats: GiftStats }) {
  const visible = !draft.content.hide_gifts
  return (
    <div className="flex flex-col gap-4">
      <VisibilityToggle
        id="site-show-gifts"
        title="Mostrar no site"
        description={stats.total === 0
          ? 'A seção só aparece quando houver itens na lista de presentes.'
          : visible ? 'Os itens da lista aparecem automaticamente no site.' : 'A lista de presentes fica oculta no site.'}
        visible={visible}
        onChange={(value) => contentPatch(onChange, { hide_gifts: !value })}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <StatTile value={stats.total} label={stats.total === 1 ? 'presente na lista' : 'presentes na lista'} />
        <StatTile value={stats.purchased} label={stats.purchased === 1 ? 'já foi dado' : 'já foram dados'} />
      </div>
      <p style={{ ...hintStyle, marginTop: 0 }}>
        Não é preciso cadastrar os itens aqui. Gerencie a lista em{' '}
        <Link href="/presentes" style={{ color: 'var(--wedding-color-dark)', fontWeight: 700, textDecoration: 'underline' }}>Lista de presentes</Link>.
      </p>
    </div>
  )
}

// ───────────────────────── Galeria ─────────────────────────

interface GaleriaSectionProps {
  draft:             SiteDraft
  photoMeta:         Record<string, GalleryPhotoMeta>
  savedPhotoMeta:    Record<string, GalleryPhotoMeta>
  storageLimitBytes: number
  usedBytes:         number
  onChange:          DraftUpdater
  onUploadPhoto:     (file: File) => Promise<GalleryPhotoRecord | null>
  onUpdatePhotoMeta: (url: string, patch: Partial<Pick<GalleryPhotoMeta, 'position_y' | 'fit_contain'>>) => void
}

export function GaleriaSection({
  draft, photoMeta, savedPhotoMeta, storageLimitBytes, usedBytes, onChange, onUploadPhoto, onUpdatePhotoMeta,
}: GaleriaSectionProps) {
  const [newUrl, setNewUrl]       = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null)
  // Qual item tem o painel de ajuste (posição/recorte) aberto — só um por vez.
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const showUploadSpinner = useDelayedLoading(uploading)

  const urls = draft.content.gallery_urls ?? []
  const template = draft.template
  const usedPct = storageLimitBytes > 0 ? Math.min(100, (usedBytes / storageLimitBytes) * 100) : 0
  const galleryLimit = SITE_TEMPLATE_CONFIG[template].galleryLimit
  const atGalleryLimit = galleryLimit !== null && urls.length >= galleryLimit
  const overGalleryLimit = galleryLimit !== null && urls.length > galleryLimit

  function setUrls(update: (urls: string[]) => string[]) {
    onChange((current) => ({ ...current, content: { ...current.content, gallery_urls: update(current.content.gallery_urls ?? []) } }))
  }

  function addUrl() {
    if (atGalleryLimit) return
    const trimmed = newUrl.trim()
    if (!trimmed) return
    if (!URL.canParse(trimmed) || !/^https?:/.test(trimmed)) {
      toastError('Cole um link de imagem começando com https://')
      return
    }
    setUrls((prev) => [...prev, trimmed])
    setNewUrl('')
  }

  // Upload em lote, um arquivo por vez — a checagem de cota (feita a cada POST) sempre vê
  // o uso já atualizado pelos anteriores. O lote continua mesmo se um arquivo falhar.
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (selected.length === 0 || uploading || atGalleryLimit) return

    const remainingSlots = galleryLimit !== null ? Math.max(0, galleryLimit - urls.length) : selected.length
    const files          = selected.slice(0, remainingSlots)
    const skippedCount   = selected.length - files.length

    setUploading(true)
    let successCount = 0
    for (let i = 0; i < files.length; i++) {
      setUploadProgress({ current: i + 1, total: files.length })
      const file = files[i]
      if (!file) continue
      const uploaded = await onUploadPhoto(file)
      if (uploaded) {
        setUrls((prev) => [...prev, uploaded.public_url])
        successCount++
      }
    }
    setUploadProgress(null)
    setUploading(false)

    if (successCount > 0) {
      toastSuccess(files.length === 1 ? 'Foto adicionada. Salve para publicar na galeria.' : `${successCount} de ${files.length} fotos adicionadas. Salve para publicar na galeria.`)
    }
    if (skippedCount > 0) {
      toastError(skippedCount === 1
        ? '1 foto não foi enviada: limite de fotos do estilo atual atingido.'
        : `${skippedCount} fotos não foram enviadas: limite de fotos do estilo atual atingido.`)
    }
  }

  function removeUrl(index: number) {
    const url = urls[index]
    setUrls((prev) => prev.filter((_, i) => i !== index))
    setExpandedUrl((prev) => (prev === url ? null : prev))
  }

  function moveUrl(index: number, direction: -1 | 1) {
    setUrls((prev) => {
      const target = index + direction
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      const temp = next[index] as string
      next[index] = next[target] as string
      next[target] = temp
      return next
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div style={{ ...cardStyle, padding: '12px 14px' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '8px', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--fg)' }}>Armazenamento</span>
          <span style={{ fontSize: '12.5px', color: 'var(--muted-fg)' }}>{formatBytes(usedBytes)} de {formatBytes(storageLimitBytes)}</span>
        </div>
        <div role="progressbar" aria-label="Armazenamento usado" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(usedPct)} style={{ height: '6px', borderRadius: '99px', background: 'var(--wedding-color-subtle)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${usedPct}%`, borderRadius: '99px', background: usedPct >= 90 ? 'var(--color-error)' : 'var(--wedding-color)', transition: 'width 0.3s' }} />
        </div>
      </div>

      {galleryLimit !== null && (
        <p role="status" style={{ ...noticeStyle, ...(overGalleryLimit ? { color: 'var(--color-error)', background: 'color-mix(in srgb, var(--color-error) 10%, transparent)' } : {}) }}>
          <strong>{urls.length} de {galleryLimit} fotos</strong> no estilo {SITE_TEMPLATE_CONFIG[template].label}.
          {overGalleryLimit && ` Remova ${urls.length - galleryLimit} para salvar a galeria, ou troque de estilo na aba Capa.`}
          {atGalleryLimit && !overGalleryLimit && ' Limite atingido.'}
        </p>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end' }}>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || atGalleryLimit}
          title={atGalleryLimit ? `Limite de ${galleryLimit} fotos do estilo ${SITE_TEMPLATE_CONFIG[template].label} atingido.` : undefined}
          style={{ ...secondaryButtonStyle, ...disabledStyle(atGalleryLimit), ...(uploading ? { cursor: 'wait' } : {}) }}
        >
          {showUploadSpinner ? <Spinner color="var(--wedding-color-dark)" /> : <UploadIcon />}
          {uploadProgress ? `Enviando ${uploadProgress.current} de ${uploadProgress.total}…` : uploading ? 'Enviando…' : 'Enviar fotos do dispositivo'}
        </button>
        <input ref={inputRef} type="file" accept="image/*" multiple disabled={atGalleryLimit} onChange={handleFileChange} style={{ display: 'none' }} />
      </div>

      <div>
        <label htmlFor="site-gallery-url" style={labelStyle}>Ou adicione por link</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            id="site-gallery-url"
            type="url"
            inputMode="url"
            maxLength={2048}
            value={newUrl}
            disabled={atGalleryLimit}
            onChange={(e) => setNewUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addUrl() } }}
            placeholder="https://..."
            style={{ ...inputStyle, ...disabledStyle(atGalleryLimit) }}
          />
          <button type="button" onClick={addUrl} disabled={atGalleryLimit} aria-label="Adicionar imagem pelo link" style={{ ...secondaryButtonStyle, width: '46px', padding: 0, flexShrink: 0, ...disabledStyle(atGalleryLimit) }}>
            <PlusIcon />
          </button>
        </div>
      </div>

      {urls.length === 0 ? (
        <p style={{ ...hintStyle, marginTop: 0 }}>Nenhuma foto na galeria ainda.</p>
      ) : (
        <>
          <p style={{ ...hintStyle, margin: '0 0 -6px' }}>A ordem define quais fotos aparecem primeiro no site.</p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {urls.map((url, index) => {
              const meta = photoMeta[url]
              const metaDirty = meta && changed(meta, savedPhotoMeta[url])
              const isExpanded = expandedUrl === url
              const hiddenByLimit = galleryLimit !== null && index >= galleryLimit

              return (
                <li key={`${url}-${index}`} style={{ borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--surface)', opacity: hiddenByLimit ? 0.6 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px' }}>
                    <img
                      src={url}
                      alt=""
                      style={{
                        width: '52px', height: '52px', borderRadius: '8px', flexShrink: 0, background: 'var(--muted)',
                        objectFit: meta?.fit_contain ? 'contain' : 'cover', objectPosition: `center ${meta?.position_y ?? 50}%`,
                      }}
                    />
                    <span style={{ flex: 1, minWidth: 0, fontSize: '13px', color: 'var(--fg)' }}>
                      <span style={{ display: 'block', fontWeight: 600 }}>Foto {index + 1}{metaDirty ? ' • ajuste não salvo' : ''}</span>
                      <span style={{ display: 'block', fontSize: '12px', color: 'var(--muted-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {hiddenByLimit ? 'Fora do limite do estilo — não aparece no site' : isUploadedPhotoUrl(url) ? 'Enviada do dispositivo' : (URL.canParse(url) ? new URL(url).hostname : url)}
                      </span>
                    </span>
                    <button type="button" onClick={() => moveUrl(index, -1)} disabled={index === 0} aria-label={`Mover foto ${index + 1} para cima`} style={{ ...iconButtonStyle, ...disabledStyle(index === 0) }}>
                      <ArrowUpIcon />
                    </button>
                    <button type="button" onClick={() => moveUrl(index, 1)} disabled={index === urls.length - 1} aria-label={`Mover foto ${index + 1} para baixo`} style={{ ...iconButtonStyle, ...disabledStyle(index === urls.length - 1) }}>
                      <ArrowDownIcon />
                    </button>
                    {meta && (
                      <button
                        type="button"
                        onClick={() => setExpandedUrl(isExpanded ? null : url)}
                        aria-label={`Ajustar posição e recorte da foto ${index + 1}`}
                        aria-expanded={isExpanded}
                        style={{ ...iconButtonStyle, background: isExpanded ? 'var(--wedding-color-subtle)' : 'transparent' }}
                      >
                        <CropIcon />
                      </button>
                    )}
                    <button type="button" onClick={() => removeUrl(index)} aria-label={`Remover foto ${index + 1}`} style={{ ...iconButtonStyle, color: dangerColor }}>
                      <TrashIcon />
                    </button>
                  </div>

                  {isExpanded && meta && (
                    <div style={{ padding: '4px 14px 14px', borderTop: '1px solid var(--border)', background: 'var(--muted)' }}>
                      <label htmlFor={`gallery-position-${meta.id}`} style={{ ...labelStyle, fontSize: '12px', marginTop: '10px', marginBottom: '4px' }}>Posição vertical</label>
                      <input
                        id={`gallery-position-${meta.id}`}
                        type="range"
                        min={0}
                        max={100}
                        value={meta.position_y}
                        disabled={meta.fit_contain}
                        onChange={(e) => onUpdatePhotoMeta(url, { position_y: Number(e.target.value) })}
                        style={{ width: '100%', accentColor: 'var(--wedding-color)', ...disabledStyle(meta.fit_contain) }}
                      />
                      <p style={{ ...hintStyle, margin: '2px 0 10px' }}>
                        {meta.fit_contain
                          ? 'Desative "ajustar sem cortar" para usar a posição.'
                          : meta.position_y === 0 ? 'Topo' : meta.position_y === 100 ? 'Base' : meta.position_y === 50 ? 'Centro' : `${meta.position_y}%`}
                      </p>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--fg)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={meta.fit_contain} onChange={(e) => onUpdatePhotoMeta(url, { fit_contain: e.target.checked })} style={{ accentColor: 'var(--wedding-color)' }} />
                        Ajustar sem cortar (mostra a foto inteira)
                      </label>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
