'use client'

/* eslint-disable @next/next/no-img-element -- miniaturas de URLs do Storage do casal. */
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'

import RichTextEditor from '@/components/site/rich-text-editor'
import StoryPreview from '@/components/site/story/story-preview'
import { ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon, ArrowUpIcon, PlusIcon, TrashIcon, UploadIcon } from '@/components/site/editor/icons'
import { cardStyle, compactInputStyle, dangerColor, ghostButtonStyle, hintStyle, secondaryButtonStyle } from '@/components/site/editor/styles'
import { sanitizeFileName } from '@/lib/files/upload-wedding-file'
import type { StoryPhotoRecord, StoryRecords } from '@/lib/site/story/load-story'
import { toStoryData } from '@/lib/site/story/load-story'
import { ImageOptimizationError, optimizeStoryImage } from '@/lib/site/story/optimize-image'
import type { StoryLayout } from '@/lib/site/story/story-layouts'
import { STORY_LIMITS } from '@/lib/site/story/story-limits'
import { buildStoryView } from '@/lib/site/story/story-model'
import { readApiError } from '@/lib/site/editor-photo-api'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { toastError, toastSuccess } from '@/store/toast.store'
import type { SiteStoryMoment, SiteTemplate, StoryDatePrecision } from '@/types/database'

/** Controle exposto ao editor do site, para a barra única de "Salvar/Descartar". */
export interface StoryEditorHandle {
  saveAll:    () => Promise<boolean>
  discardAll: () => void
}

interface StoryEditorProps {
  weddingId:   string
  template:    SiteTemplate
  coupleNames: string
  /** content.rich_text — formatação nos textos dos momentos e na pré-visualização. */
  markdown:    boolean
  /** Rascunhos ainda não salvos da seção (texto e apresentação), para a pré-visualização. */
  storyText:   string
  layout:      StoryLayout | undefined
  heading?:    string
  /** Atualiza a barra de uso de armazenamento do editor. */
  onStorageDelta: (bytes: number) => void
  /** Quantos momentos/fotos têm alterações não salvas. */
  onPendingChange?: (count: number) => void
  ref?: React.Ref<StoryEditorHandle>
}

interface MomentDraft {
  title:          string
  description:    string
  happened_on:    string
  date_precision: StoryDatePrecision
}

interface PhotoDraft {
  caption:   string
  moment_id: string | null
}

function momentToDraft(moment: SiteStoryMoment): MomentDraft {
  return { title: moment.title ?? '', description: moment.description ?? '', happened_on: moment.happened_on ?? '', date_precision: moment.date_precision }
}

function photoToDraft(photo: StoryPhotoRecord): PhotoDraft {
  return { caption: photo.caption ?? '', moment_id: photo.moment_id }
}

function momentChanged(moment: SiteStoryMoment, draft: MomentDraft | undefined): boolean {
  if (!draft) return false
  const saved = momentToDraft(moment)
  return draft.title.trim() !== saved.title || draft.description.trim() !== saved.description
    || draft.happened_on !== saved.happened_on || draft.date_precision !== saved.date_precision
}

function photoChanged(photo: StoryPhotoRecord, draft: PhotoDraft | undefined): boolean {
  if (!draft) return false
  return draft.caption.trim() !== (photo.caption ?? '') || draft.moment_id !== photo.moment_id
}

function move<T>(list: T[], index: number, direction: -1 | 1): T[] | null {
  const target = index + direction
  if (target < 0 || target >= list.length) return null
  const next = [...list]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item as T)
  return next
}

const sectionTitle: React.CSSProperties = { fontSize: '15px', fontWeight: 700, color: 'var(--fg)', margin: '0 0 4px' }
const hint: React.CSSProperties = { ...hintStyle, margin: '0 0 12px' }
const fieldLabel: React.CSSProperties = { fontSize: '12.5px', fontWeight: 600, color: 'var(--fg)', display: 'block', marginBottom: '4px' }

export default function StoryEditor({
  weddingId, template, coupleNames, markdown, storyText, layout, heading, onStorageDelta, onPendingChange, ref,
}: StoryEditorProps) {
  const base = `/api/v1/weddings/${weddingId}/story`
  const [moments, setMoments] = useState<SiteStoryMoment[]>([])
  const [photos, setPhotos]   = useState<StoryPhotoRecord[]>([])
  const [momentDrafts, setMomentDrafts] = useState<Record<string, MomentDraft>>({})
  const [photoDrafts, setPhotoDrafts]   = useState<Record<string, PhotoDraft>>({})
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    fetch(base)
      .then(async (res) => (res.ok ? ((await res.json()) as { data: StoryRecords }).data : null))
      .then((data) => {
        if (cancelled) return
        if (data) {
          setMoments(data.moments)
          setPhotos(data.photos)
        } else {
          toastError('Não foi possível carregar os momentos e fotos da história.')
        }
        setLoading(false)
      })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [base])

  const pendingCount = moments.filter((m) => momentChanged(m, momentDrafts[m.id])).length
    + photos.filter((p) => photoChanged(p, photoDrafts[p.id])).length

  useEffect(() => { onPendingChange?.(pendingCount) }, [pendingCount, onPendingChange])

  // A pré-visualização mostra o rascunho: textos dos momentos e legendas ainda não salvos.
  const view = useMemo(() => {
    const draftMoments = moments.map((m) => {
      const draft = momentDrafts[m.id]
      return draft ? { ...m, title: draft.title || null, description: draft.description || null, happened_on: draft.happened_on || null, date_precision: draft.date_precision } : m
    })
    const draftPhotos = photos.map((p) => {
      const draft = photoDrafts[p.id]
      return draft ? { ...p, caption: draft.caption || null, moment_id: draft.moment_id } : p
    })
    return buildStoryView(template, layout, storyText, toStoryData({ moments: draftMoments, photos: draftPhotos }))
  }, [template, layout, storyText, moments, photos, momentDrafts, photoDrafts])

  const saveAll = useCallback(async (): Promise<boolean> => {
    let allOk = true

    for (const moment of moments) {
      const draft = momentDrafts[moment.id]
      if (!draft || !momentChanged(moment, draft)) continue
      const res = await fetch(`${base}/moments/${moment.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: draft.title, description: draft.description, happened_on: draft.happened_on || null, date_precision: draft.date_precision }),
      })
      if (!res.ok) {
        allOk = false
        toastError(`Momento "${draft.title || 'sem título'}": ${await readApiError(res, 'não foi possível salvar.')}`)
        continue
      }
      const { data } = (await res.json()) as { data: SiteStoryMoment }
      setMoments((prev) => prev.map((m) => (m.id === data.id ? data : m)))
      setMomentDrafts((prev) => { const next = { ...prev }; delete next[data.id]; return next })
    }

    for (const photo of photos) {
      const draft = photoDrafts[photo.id]
      if (!draft || !photoChanged(photo, draft)) continue
      const patch = { caption: draft.caption.trim() || null, moment_id: draft.moment_id }
      const res = await fetch(`${base}/photos/${photo.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
      if (!res.ok) {
        allOk = false
        toastError(await readApiError(res, 'Não foi possível atualizar uma foto da história.'))
        continue
      }
      setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, ...patch } : p)))
      setPhotoDrafts((prev) => { const next = { ...prev }; delete next[photo.id]; return next })
    }

    return allOk
  }, [base, moments, photos, momentDrafts, photoDrafts])

  const discardAll = useCallback(() => {
    setMomentDrafts({})
    setPhotoDrafts({})
  }, [])

  useImperativeHandle(ref, () => ({ saveAll, discardAll }), [saveAll, discardAll])

  async function reorder(kind: 'moments' | 'photos', ids: string[], revert: () => void) {
    const res = await fetch(`${base}/reorder`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, ids }) })
    if (!res.ok) {
      revert()
      toastError(await readApiError(res, 'Não foi possível reordenar.'))
    }
  }

  // ── Momentos ──
  async function addMoment() {
    const res = await fetch(`${base}/moments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    if (!res.ok) { toastError(await readApiError(res, 'Não foi possível adicionar o momento.')); return }
    const { data } = (await res.json()) as { data: SiteStoryMoment }
    setMoments((prev) => [...prev, data])
    requestAnimationFrame(() => document.getElementById(`moment-${data.id}-title`)?.focus())
  }

  function updateMomentDraft(moment: SiteStoryMoment, patch: Partial<MomentDraft>) {
    setMomentDrafts((prev) => ({ ...prev, [moment.id]: { ...(prev[moment.id] ?? momentToDraft(moment)), ...patch } }))
  }

  async function deleteMoment(moment: SiteStoryMoment) {
    const title = momentDrafts[moment.id]?.title || moment.title || 'sem título'
    if (!window.confirm(`Excluir o momento "${title}"? As fotos dele continuam na história.`)) return
    const res = await fetch(`${base}/moments/${moment.id}`, { method: 'DELETE' })
    if (!res.ok) { toastError(await readApiError(res, 'Não foi possível excluir o momento.')); return }
    setMoments((prev) => prev.filter((m) => m.id !== moment.id))
    setMomentDrafts((prev) => { const next = { ...prev }; delete next[moment.id]; return next })
    setPhotos((prev) => prev.map((p) => (p.moment_id === moment.id ? { ...p, moment_id: null } : p)))
    setPhotoDrafts((prev) => Object.fromEntries(Object.entries(prev).map(([id, d]) => [id, d.moment_id === moment.id ? { ...d, moment_id: null } : d])))
  }

  function moveMoment(index: number, direction: -1 | 1) {
    const next = move(moments, index, direction)
    if (!next) return
    const previous = moments
    setMoments(next.map((m, i) => ({ ...m, sort_order: i })))
    void reorder('moments', next.map((m) => m.id), () => setMoments(previous))
  }

  // ── Fotos ──
  async function uploadFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const remaining = STORY_LIMITS.photos - photos.length
    if (remaining <= 0) { toastError(`A história aceita até ${STORY_LIMITS.photos} fotos.`); return }
    const files = Array.from(fileList).slice(0, remaining)
    if (fileList.length > remaining) toastError(`Só ${remaining} foto(s) foram enviadas — a história aceita até ${STORY_LIMITS.photos}.`)

    const supabase = createSupabaseBrowser()
    let added = 0
    for (const [index, file] of files.entries()) {
      setProgress({ current: index + 1, total: files.length })
      let optimized
      try {
        optimized = await optimizeStoryImage(file)
      } catch (error) {
        toastError(error instanceof ImageOptimizationError ? error.message : `Não foi possível preparar "${file.name}".`)
        continue
      }
      if (optimized.blob.size > STORY_LIMITS.maxFileBytes) {
        toastError(`"${file.name}" continua acima de 8 MB mesmo depois de otimizada.`)
        continue
      }

      const baseName = sanitizeFileName(file.name.replace(/\.[^.]+$/, '')).slice(0, 60) || 'foto'
      const path = `${weddingId}/${crypto.randomUUID()}-${baseName}.${optimized.extension}`
      const { error: uploadError } = await supabase.storage.from('wedding-photos').upload(path, optimized.blob, { contentType: optimized.mimeType })
      if (uploadError) { toastError(`Não foi possível enviar "${file.name}".`); continue }

      const res = await fetch(`${base}/photos`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ storage_path: path, size_bytes: optimized.blob.size, mime_type: optimized.mimeType, width: optimized.width, height: optimized.height }),
      })
      if (!res.ok) {
        // A API já descarta o arquivo na maioria das recusas; remover de novo é inofensivo.
        await supabase.storage.from('wedding-photos').remove([path])
        toastError(`"${file.name}": ${await readApiError(res, 'Não foi possível salvar a foto.')}`)
        continue
      }
      const { data } = (await res.json()) as { data: StoryPhotoRecord }
      setPhotos((prev) => [...prev, data])
      onStorageDelta(data.size_bytes)
      added += 1
    }
    setProgress(null)
    if (added > 0) toastSuccess(added === 1 ? 'Foto adicionada à história.' : `${added} fotos adicionadas à história.`)
  }

  function updatePhotoDraft(photo: StoryPhotoRecord, patch: Partial<PhotoDraft>) {
    setPhotoDrafts((prev) => ({ ...prev, [photo.id]: { ...(prev[photo.id] ?? photoToDraft(photo)), ...patch } }))
  }

  async function deletePhoto(photo: StoryPhotoRecord) {
    if (!window.confirm('Excluir esta foto da história? O arquivo também será removido do armazenamento.')) return
    const res = await fetch(`${base}/photos/${photo.id}`, { method: 'DELETE' })
    if (!res.ok) { toastError(await readApiError(res, 'Não foi possível excluir a foto.')); return }
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
    setPhotoDrafts((prev) => { const next = { ...prev }; delete next[photo.id]; return next })
    onStorageDelta(-photo.size_bytes)
  }

  function movePhoto(index: number, direction: -1 | 1) {
    const next = move(photos, index, direction)
    if (!next) return
    const previous = photos
    setPhotos(next.map((p, i) => ({ ...p, sort_order: i })))
    void reorder('photos', next.map((p) => p.id), () => setPhotos(previous))
  }

  if (loading) return <p style={hint}>Carregando momentos e fotos…</p>

  return (
    <div className="flex flex-col gap-6">
      {/* ── Momentos ── */}
      <section aria-labelledby="story-moments-title">
        <h3 id="story-moments-title" style={sectionTitle}>Momentos especiais ({moments.length}/{STORY_LIMITS.moments})</h3>
        <p style={hint}>Título, data e descrição são opcionais. Na linha do tempo, os momentos com data aparecem em ordem cronológica.</p>
        <div className="flex flex-col gap-3">
          {moments.map((moment, index) => (
            <MomentCard
              key={moment.id}
              moment={moment}
              draft={momentDrafts[moment.id] ?? momentToDraft(moment)}
              dirty={momentChanged(moment, momentDrafts[moment.id])}
              markdown={markdown}
              canMoveUp={index > 0}
              canMoveDown={index < moments.length - 1}
              onMove={(direction) => moveMoment(index, direction)}
              onChange={(patch) => updateMomentDraft(moment, patch)}
              onDelete={() => deleteMoment(moment)}
            />
          ))}
        </div>
        <button type="button" style={{ ...ghostButtonStyle, marginTop: '10px', fontWeight: 600 }} onClick={addMoment} disabled={moments.length >= STORY_LIMITS.moments}>
          <PlusIcon /> Adicionar momento
        </button>
      </section>

      {/* ── Fotos ── */}
      <section aria-labelledby="story-photos-title">
        <h3 id="story-photos-title" style={sectionTitle}>Fotos da história ({photos.length}/{STORY_LIMITS.photos})</h3>
        <p style={hint}>
          Até {STORY_LIMITS.photos} fotos, otimizadas antes do envio. Elas contam no armazenamento do plano,
          mas não aparecem na galeria do site. Associe uma foto a um momento para exibi-la junto dele.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '12px' }}>
          {photos.map((photo, index) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              draft={photoDrafts[photo.id] ?? photoToDraft(photo)}
              index={index}
              moments={moments}
              canMoveUp={index > 0}
              canMoveDown={index < photos.length - 1}
              onMove={(direction) => movePhoto(index, direction)}
              onChange={(patch) => updatePhotoDraft(photo, patch)}
              onDelete={() => deletePhoto(photo)}
            />
          ))}
        </div>
        <button
          type="button"
          style={{ ...secondaryButtonStyle, marginTop: '10px' }}
          onClick={() => fileInputRef.current?.click()}
          disabled={progress !== null || photos.length >= STORY_LIMITS.photos}
        >
          <UploadIcon /> {progress ? `Enviando ${progress.current} de ${progress.total}…` : 'Enviar fotos'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          onChange={(e) => { void uploadFiles(e.target.files); e.target.value = '' }}
          style={{ display: 'none' }}
        />
      </section>

      {/* ── Pré-visualização ── */}
      <section aria-labelledby="story-preview-title">
        <h3 id="story-preview-title" style={sectionTitle}>Pré-visualização</h3>
        <p style={hint}>Mostra a seção no estilo atual do site, já com as alterações ainda não salvas.</p>
        <StoryPreview template={template} view={view} coupleNames={coupleNames} markdown={markdown} heading={heading} />
      </section>
    </div>
  )
}

// ───────────────────────── Momento ─────────────────────────
interface MomentCardProps {
  moment:      SiteStoryMoment
  draft:       MomentDraft
  dirty:       boolean
  markdown:    boolean
  canMoveUp:   boolean
  canMoveDown: boolean
  onMove:      (direction: -1 | 1) => void
  onChange:    (patch: Partial<MomentDraft>) => void
  onDelete:    () => void
}

function MomentCard({ moment, draft, dirty, markdown, canMoveUp, canMoveDown, onMove, onChange, onDelete }: MomentCardProps) {
  const idPrefix = `moment-${moment.id}`

  return (
    <div style={{ ...cardStyle, borderColor: dirty ? 'color-mix(in srgb, var(--wedding-color) 55%, var(--border))' : 'var(--border)' }}>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px_110px]" style={{ gap: '10px' }}>
        <div>
          <label htmlFor={`${idPrefix}-title`} style={fieldLabel}>Título</label>
          <input id={`${idPrefix}-title`} style={compactInputStyle} value={draft.title} maxLength={STORY_LIMITS.titleLength} onChange={(e) => onChange({ title: e.target.value })} placeholder="Ex: O primeiro encontro" />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-date`} style={fieldLabel}>Data (opcional)</label>
          <input id={`${idPrefix}-date`} type="date" style={compactInputStyle} value={draft.happened_on} min="1900-01-01" max="2100-12-31" onChange={(e) => onChange({ happened_on: e.target.value })} />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-precision`} style={fieldLabel}>Exibir</label>
          <select id={`${idPrefix}-precision`} style={compactInputStyle} value={draft.date_precision} onChange={(e) => onChange({ date_precision: e.target.value as StoryDatePrecision })} disabled={!draft.happened_on}>
            <option value="day">Dia</option>
            <option value="month">Mês e ano</option>
            <option value="year">Só o ano</option>
          </select>
        </div>
      </div>
      <div style={{ marginTop: '10px' }}>
        <label htmlFor={`${idPrefix}-description`} style={fieldLabel}>Descrição</label>
        <RichTextEditor id={`${idPrefix}-description`} value={draft.description} onChange={(description) => onChange({ description })} markdown={markdown} maxLength={STORY_LIMITS.descriptionLength} rows={3} placeholder="O que aconteceu nesse dia?" />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px', alignItems: 'center' }}>
        {dirty && <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--wedding-color-dark)' }}>• Alterado — salve na barra abaixo</span>}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
          <button type="button" style={ghostButtonStyle} onClick={() => onMove(-1)} disabled={!canMoveUp} aria-label="Mover momento para cima"><ArrowUpIcon /></button>
          <button type="button" style={ghostButtonStyle} onClick={() => onMove(1)} disabled={!canMoveDown} aria-label="Mover momento para baixo"><ArrowDownIcon /></button>
          <button type="button" style={{ ...ghostButtonStyle, color: dangerColor }} onClick={onDelete} aria-label="Excluir momento"><TrashIcon /> Excluir</button>
        </span>
      </div>
    </div>
  )
}

// ───────────────────────── Foto ─────────────────────────
interface PhotoCardProps {
  photo:       StoryPhotoRecord
  draft:       PhotoDraft
  index:       number
  moments:     SiteStoryMoment[]
  canMoveUp:   boolean
  canMoveDown: boolean
  onMove:      (direction: -1 | 1) => void
  onChange:    (patch: Partial<PhotoDraft>) => void
  onDelete:    () => void
}

function PhotoCard({ photo, draft, index, moments, canMoveUp, canMoveDown, onMove, onChange, onDelete }: PhotoCardProps) {
  const idPrefix = `story-photo-${photo.id}`

  return (
    <div style={{ ...cardStyle, display: 'flex', gap: '10px', padding: '10px' }}>
      <img src={photo.url} alt={photo.caption ?? `Foto ${index + 1} da história`} loading="lazy" style={{ width: '84px', height: '84px', objectFit: 'cover', borderRadius: '10px', flexShrink: 0, background: 'var(--muted)' }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label htmlFor={`${idPrefix}-caption`} className="sr-only">Legenda</label>
        <input
          id={`${idPrefix}-caption`}
          style={compactInputStyle}
          value={draft.caption}
          maxLength={STORY_LIMITS.captionLength}
          placeholder="Legenda (opcional)"
          onChange={(e) => onChange({ caption: e.target.value })}
        />
        <label htmlFor={`${idPrefix}-moment`} className="sr-only">Momento</label>
        <select id={`${idPrefix}-moment`} style={compactInputStyle} value={draft.moment_id ?? ''} onChange={(e) => onChange({ moment_id: e.target.value || null })}>
          <option value="">Sem momento (junto do texto)</option>
          {moments.map((m, i) => <option key={m.id} value={m.id}>{m.title || `Momento ${i + 1}`}</option>)}
        </select>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button type="button" style={ghostButtonStyle} onClick={() => onMove(-1)} disabled={!canMoveUp} aria-label="Mover foto para trás"><ArrowLeftIcon /></button>
          <button type="button" style={ghostButtonStyle} onClick={() => onMove(1)} disabled={!canMoveDown} aria-label="Mover foto para frente"><ArrowRightIcon /></button>
          <button type="button" style={{ ...ghostButtonStyle, marginLeft: 'auto', color: dangerColor }} onClick={onDelete} aria-label="Excluir foto"><TrashIcon /></button>
        </div>
      </div>
    </div>
  )
}
