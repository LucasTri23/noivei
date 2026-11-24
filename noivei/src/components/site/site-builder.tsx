'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { StoryEditorHandle } from '@/components/site/story/story-editor'
import { EyeIcon, GlobeIcon, ShareIcon } from '@/components/site/editor/icons'
import SaveBar from '@/components/site/editor/save-bar'
import SectionNav, { EDITOR_SECTIONS, sectionPanelId, sectionTabId, type SectionStatus } from '@/components/site/editor/section-nav'
import {
  CapaSection, CerimoniaSection, GaleriaSection, HistoriaSection, PresentesSection, RsvpSection,
  type DraftUpdater, type GiftStats, type RsvpStats,
} from '@/components/site/editor/sections'
import { AparenciaSection, InformacoesSection, SecoesSection } from '@/components/site/editor/customization-sections'
import SetupWizard from '@/components/site/editor/setup-wizard'
import ShareDialog from '@/components/site/editor/share-dialog'
import { primaryButtonStyle, secondaryButtonStyle } from '@/components/site/editor/styles'
import { useOrigin } from '@/hooks/use-origin'
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard'
import {
  deleteSitePhoto, isUploadedPhotoUrl, listSitePhotos, patchSitePhotoMeta, readApiError, uploadSitePhoto,
  type GalleryPhotoMeta, type GalleryPhotoRecord,
} from '@/lib/site/editor-photo-api'
import {
  buildSitePatch, dirtySections, draftFromConfig, referencedPhotoUrls, sectionIsFilled,
  type EditorSectionId, type SiteDraft,
} from '@/lib/site/site-draft'
import type { PlanId } from '@/constants/plans'
import { toastError, toastSuccess } from '@/store/toast.store'
import type { SiteConfig } from '@/types/database'

// Mantido para quem importava o seletor daqui (ex.: testes).
export { TemplatePicker } from '@/components/site/editor/template-picker'

interface SiteBuilderProps {
  weddingId:         string
  coupleNames:       string
  initialSite:       SiteConfig | null
  storageLimitBytes: number
  storageUsedBytes:  number
  planId:            PlanId
  rsvpStats:         RsvpStats
  giftStats:         GiftStats
}

const SECTION_HINTS: Record<EditorSectionId, string> = {
  capa:        'Estilo, monograma, foto de capa, endereço e publicação.',
  aparencia:   'Fontes, cor de destaque, fundo e acabamento do selo.',
  secoes:      'Escolha a ordem das seções e quais aparecem no site.',
  informacoes: 'Perguntas frequentes e sugestões de hospedagem para os convidados.',
  historia:  'A história de vocês, momentos especiais e um recado aos convidados.',
  cerimonia: 'Horários e detalhes da cerimônia e da festa.',
  rsvp:      'Como os convidados confirmam presença.',
  presentes: 'A lista de presentes que aparece no site.',
  galeria:   'As fotos da galeria do site.',
}

function metaChanged(a: GalleryPhotoMeta | undefined, b: GalleryPhotoMeta | undefined): boolean {
  return Boolean(a && b) && (a?.position_y !== b?.position_y || a?.fit_contain !== b?.fit_contain)
}

export default function SiteBuilder({
  weddingId, coupleNames, initialSite, storageLimitBytes, storageUsedBytes, planId, rsvpStats, giftStats,
}: SiteBuilderProps) {
  const origin = useOrigin()
  const [saved, setSaved] = useState<SiteDraft | null>(() => (initialSite ? draftFromConfig(initialSite) : null))
  const [draft, setDraft] = useState<SiteDraft | null>(saved)
  const [active, setActive] = useState<EditorSectionId>('capa')
  const [saving, setSaving] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [storyPending, setStoryPending] = useState(0)
  const storyRef = useRef<StoryEditorHandle>(null)

  // Cota de armazenamento e tamanhos por foto (bucket "wedding-photos") — compartilhados
  // entre capa, foto de destaque e galeria.
  const [usedBytes, setUsedBytes]   = useState(storageUsedBytes)
  const [photoSizes, setPhotoSizes] = useState<Record<string, number>>({})
  // Ajuste de recorte por foto enviada (indexado pela URL pública): salvo × rascunho.
  const [savedMeta, setSavedMeta] = useState<Record<string, GalleryPhotoMeta>>({})
  const [draftMeta, setDraftMeta] = useState<Record<string, GalleryPhotoMeta>>({})
  // Fotos enviadas desde o último salvar/descartar — candidatas a sair do armazenamento
  // se o casal descartar ou removê-las antes de salvar.
  const sessionUploads = useRef(new Set<string>())

  useEffect(() => {
    let cancelled = false
    void listSitePhotos(weddingId).then((photos) => {
      if (cancelled || !photos) return
      const sizes: Record<string, number> = {}
      const meta: Record<string, GalleryPhotoMeta> = {}
      for (const photo of photos) {
        sizes[photo.public_url] = photo.size_bytes
        meta[photo.public_url] = { id: photo.id, position_y: photo.position_y, fit_contain: photo.fit_contain }
      }
      setPhotoSizes((prev) => ({ ...sizes, ...prev }))
      setSavedMeta((prev) => ({ ...meta, ...prev }))
      setDraftMeta((prev) => ({ ...meta, ...prev }))
    })
    return () => { cancelled = true }
  }, [weddingId])

  const updateDraft: DraftUpdater = useCallback((update) => {
    setDraft((current) => (current ? update(current) : current))
  }, [])

  const dirty = useMemo(() => {
    const sections = draft && saved ? dirtySections(draft, saved) : new Set<EditorSectionId>()
    if (Object.keys(draftMeta).some((url) => metaChanged(draftMeta[url], savedMeta[url]))) sections.add('galeria')
    if (storyPending > 0) sections.add('historia')
    return sections
  }, [draft, saved, draftMeta, savedMeta, storyPending])
  const hasChanges = dirty.size > 0

  useUnsavedChangesGuard(hasChanges)

  async function handleUpload(file: File, purpose: 'gallery' | 'brand' = 'gallery'): Promise<GalleryPhotoRecord | null> {
    const uploaded = await uploadSitePhoto(weddingId, file, purpose)
    if (!uploaded) return null
    sessionUploads.current.add(uploaded.public_url)
    const meta = { id: uploaded.id, position_y: uploaded.position_y, fit_contain: uploaded.fit_contain }
    setPhotoSizes((prev) => ({ ...prev, [uploaded.public_url]: uploaded.size_bytes }))
    setSavedMeta((prev) => ({ ...prev, [uploaded.public_url]: meta }))
    setDraftMeta((prev) => ({ ...prev, [uploaded.public_url]: meta }))
    setUsedBytes((prev) => prev + uploaded.size_bytes)
    return uploaded
  }

  // Remoções só apagam o arquivo DEPOIS de salvar (ou ao descartar uma foto nova que
  // nunca foi salva) — remover e não salvar nunca deixa o site publicado com imagem quebrada.
  async function collectUnusedPhotos(previous: SiteDraft, next: SiteDraft) {
    const keep = referencedPhotoUrls(next)
    const candidates = new Set([...referencedPhotoUrls(previous), ...sessionUploads.current])
    sessionUploads.current = new Set()
    for (const url of candidates) {
      if (keep.has(url) || !isUploadedPhotoUrl(url)) continue
      if (!(await deleteSitePhoto(weddingId, url))) continue
      const size = photoSizes[url] ?? 0
      setUsedBytes((prev) => Math.max(0, prev - size))
      setPhotoSizes((prev) => { const copy = { ...prev }; delete copy[url]; return copy })
      setSavedMeta((prev) => { const copy = { ...prev }; delete copy[url]; return copy })
      setDraftMeta((prev) => { const copy = { ...prev }; delete copy[url]; return copy })
    }
  }

  async function save() {
    if (!draft || !saved || saving) return
    const result = buildSitePatch(draft, saved, planId)
    if (!result.ok) {
      toastError(result.message)
      setActive(result.section)
      return
    }

    setSaving(true)
    let allOk = true
    let nextSaved = saved

    if (result.body) {
      const res = await fetch(`/api/v1/weddings/${weddingId}/site`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(result.body),
      })
      if (!res.ok) {
        setSaving(false)
        const message = await readApiError(res, 'Não foi possível salvar. Tente novamente.')
        toastError(message)
        if (res.status === 409) setActive('capa')
        return
      }
      nextSaved = draftFromConfig(((await res.json()) as { data: SiteConfig }).data)
    }

    for (const [url, meta] of Object.entries(draftMeta)) {
      if (!metaChanged(meta, savedMeta[url])) continue
      if (await patchSitePhotoMeta(weddingId, meta)) setSavedMeta((prev) => ({ ...prev, [url]: meta }))
      else allOk = false
    }

    if (storyPending > 0 && storyRef.current) allOk = (await storyRef.current.saveAll()) && allOk

    setSaved(nextSaved)
    setDraft(nextSaved)
    await collectUnusedPhotos(saved, nextSaved)
    setSaving(false)

    if (!allOk) toastError('Parte das alterações não foi salva. Confira os avisos e tente de novo.')
    else if (nextSaved.published && !saved.published) toastSuccess('Site publicado! Agora é só compartilhar com os convidados.')
    else toastSuccess('Alterações salvas!')
  }

  function discard() {
    if (!saved) return
    setDraft(saved)
    setDraftMeta(savedMeta)
    storyRef.current?.discardAll()
    void collectUnusedPhotos(saved, saved)
  }

  // Ctrl+S / ⌘+S salva de qualquer aba.
  const saveRef = useRef(save)
  useEffect(() => { saveRef.current = save })
  useEffect(() => {
    if (!hasChanges) return
    function handleKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void saveRef.current()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [hasChanges])

  const handleStoryPending = useCallback((count: number) => setStoryPending(count), [])

  if (!draft || !saved) {
    return (
      <div>
        <h1 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(30px,4.2vw,42px)', lineHeight: 1.05, color: 'var(--fg)', marginBottom: '18px' }}>
          Site do casal
        </h1>
        <SetupWizard
          weddingId={weddingId}
          coupleNames={coupleNames}
          planId={planId}
          origin={origin}
          onStorageDelta={(bytes) => setUsedBytes((prev) => Math.max(0, prev + bytes))}
          onCreated={(site) => {
            const created = draftFromConfig(site)
            setSaved(created)
            setDraft(created)
          }}
        />
      </div>
    )
  }

  const publicUrl = `${origin || ''}/${saved.slug}`
  const statuses = Object.fromEntries(
    EDITOR_SECTIONS.map(({ id }) => [id, dirty.has(id) ? 'dirty' : sectionIsFilled(id, draft, giftStats.total) ? 'filled' : 'empty']),
  ) as Record<EditorSectionId, SectionStatus>
  const dirtySummary = EDITOR_SECTIONS.filter(({ id }) => dirty.has(id)).map(({ label }) => label).join(', ')

  return (
    <div>
      {/* Cabeçalho: estado do site + pré-visualizar + compartilhar */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div style={{ minWidth: 0 }}>
          <h1 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(30px,4.2vw,42px)', lineHeight: 1.05, color: 'var(--fg)' }}>
            Site do casal
          </h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginTop: '8px', fontSize: '14px', color: 'var(--muted-fg)' }}>
            <span
              style={{
                fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '99px',
                background: saved.published ? 'color-mix(in srgb, var(--color-success) 14%, transparent)' : 'var(--wedding-color-subtle)',
                color: saved.published ? 'var(--color-success)' : 'var(--wedding-color-dark)',
              }}
            >
              {saved.published ? '● Publicado' : 'Rascunho'}
            </span>
            <GlobeIcon />
            <span style={{ overflowWrap: 'anywhere' }}>{publicUrl.replace(/^https?:\/\//, '')}</span>
          </div>
        </div>

        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <a
            href="/site/previa"
            target="_blank"
            rel="noopener"
            title={hasChanges ? 'A prévia mostra a última versão salva.' : 'Ver o site como os convidados verão.'}
            style={{ ...secondaryButtonStyle, flex: '1 1 auto', padding: '11px 16px' }}
          >
            <EyeIcon /> Pré-visualizar{hasChanges ? ' (versão salva)' : ''}
          </a>
          <button
            type="button"
            aria-disabled={!saved.published}
            onClick={() => {
              if (saved.published) setShareOpen(true)
              else toastError('Publique o site primeiro: aba Capa → Endereço e publicação.')
            }}
            title={saved.published ? undefined : 'Publique o site para compartilhar.'}
            style={{ ...primaryButtonStyle, flex: '1 1 auto', opacity: saved.published ? 1 : 0.55 }}
          >
            <ShareIcon /> Compartilhar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[230px_1fr] lg:gap-5 xl:grid-cols-[260px_1fr]">
        <div className="lg:sticky lg:top-4 lg:self-start">
          <SectionNav active={active} statuses={statuses} onSelect={setActive} />
        </div>

        <div className="min-w-0 rounded-2xl" style={{ background: 'var(--surface)', boxShadow: '0 10px 28px rgba(60,40,24,0.10)' }}>
          {EDITOR_SECTIONS.map((section) => (
            // Todas as seções ficam montadas (só a ativa visível) para não perder estado local
            // como uploads em andamento e o editor de momentos ao trocar de aba.
            <div
              key={section.id}
              id={sectionPanelId(section.id)}
              role="tabpanel"
              aria-labelledby={sectionTabId(section.id)}
              hidden={active !== section.id}
              style={{ padding: 'clamp(16px, 3vw, 26px)' }}
            >
              <header style={{ marginBottom: '18px' }}>
                <h2 className="font-display" style={{ fontSize: '26px', fontWeight: 500, lineHeight: 1.1, margin: 0, color: 'var(--fg)' }}>{section.label}</h2>
                <p style={{ fontSize: '13.5px', color: 'var(--muted-fg)', margin: '4px 0 0' }}>{SECTION_HINTS[section.id]}</p>
              </header>

              {section.id === 'capa' && (
                <CapaSection
                  draft={draft}
                  saved={saved}
                  planId={planId}
                  weddingId={weddingId}
                  coupleNames={coupleNames}
                  origin={origin}
                  onChange={updateDraft}
                  onUploadPhoto={handleUpload}
                />
              )}
              {section.id === 'historia' && (
                <HistoriaSection
                  draft={draft}
                  weddingId={weddingId}
                  coupleNames={coupleNames}
                  onChange={updateDraft}
                  onUploadPhoto={handleUpload}
                  onStorageDelta={(bytes) => setUsedBytes((prev) => Math.max(0, prev + bytes))}
                  onStoryPendingChange={handleStoryPending}
                  storyRef={storyRef}
                />
              )}
              {section.id === 'aparencia' && <AparenciaSection draft={draft} planId={planId} onChange={updateDraft} />}
              {section.id === 'secoes' && <SecoesSection draft={draft} onChange={updateDraft} />}
              {section.id === 'cerimonia' && <CerimoniaSection draft={draft} onChange={updateDraft} />}
              {section.id === 'informacoes' && <InformacoesSection draft={draft} planId={planId} onChange={updateDraft} />}
              {section.id === 'rsvp' && <RsvpSection draft={draft} onChange={updateDraft} stats={rsvpStats} />}
              {section.id === 'presentes' && <PresentesSection draft={draft} onChange={updateDraft} stats={giftStats} />}
              {section.id === 'galeria' && (
                <GaleriaSection
                  draft={draft}
                  photoMeta={draftMeta}
                  savedPhotoMeta={savedMeta}
                  storageLimitBytes={storageLimitBytes}
                  usedBytes={usedBytes}
                  onChange={updateDraft}
                  onUploadPhoto={handleUpload}
                  onUpdatePhotoMeta={(url, patch) => setDraftMeta((prev) => {
                    const current = prev[url]
                    return current ? { ...prev, [url]: { ...current, ...patch } } : prev
                  })}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <SaveBar visible={hasChanges} saving={saving} summary={dirtySummary} onSave={() => void save()} onDiscard={discard} />

      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} url={publicUrl} coupleNames={coupleNames} slug={saved.slug} />
    </div>
  )
}
