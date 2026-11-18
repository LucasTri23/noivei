'use client'

/* eslint-disable @next/next/no-img-element -- miniaturas de URLs do Storage do casal. */
import { useEffect, useMemo, useRef, useState } from 'react'

import RichTextEditor from '@/components/site/rich-text-editor'
import StoryPreview from '@/components/site/story/story-preview'
import { sanitizeFileName } from '@/lib/files/upload-wedding-file'
import type { StoryPhotoRecord, StoryRecords } from '@/lib/site/story/load-story'
import { toStoryData } from '@/lib/site/story/load-story'
import { ImageOptimizationError, optimizeStoryImage } from '@/lib/site/story/optimize-image'
import type { StoryLayout } from '@/lib/site/story/story-layouts'
import { STORY_LIMITS } from '@/lib/site/story/story-limits'
import { buildStoryView } from '@/lib/site/story/story-model'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { toastError, toastSuccess } from '@/store/toast.store'
import type { SiteStoryMoment, SiteTemplate, StoryDatePrecision } from '@/types/database'

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
}

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string } }
    return body.error?.message ?? fallback
  } catch {
    return fallback
  }
}

function move<T>(list: T[], index: number, direction: -1 | 1): T[] | null {
  const target = index + direction
  if (target < 0 || target >= list.length) return null
  const next = [...list]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item as T)
  return next
}

const fieldStyle: React.CSSProperties = {
  border: '1.5px solid #EBDDD0', borderRadius: '10px', padding: '9px 11px', fontSize: '14px',
  color: 'var(--fg)', background: 'var(--surface)', width: '100%', minWidth: 0,
}
const smallButton: React.CSSProperties = {
  minWidth: '36px', minHeight: '36px', padding: '0 10px', border: '1px solid #EBDDD0', borderRadius: '9px',
  background: 'var(--surface)', color: 'var(--fg)', cursor: 'pointer', fontSize: '13px',
}
const sectionTitle: React.CSSProperties = { fontSize: '15px', fontWeight: 700, color: 'var(--fg)', margin: '0 0 4px' }
const hint: React.CSSProperties = { fontSize: '12.5px', color: 'var(--muted-fg)', margin: '0 0 12px', lineHeight: 1.5 }

export default function StoryEditor({
  weddingId, template, coupleNames, markdown, storyText, layout, heading, onStorageDelta,
}: StoryEditorProps) {
  const base = `/api/v1/weddings/${weddingId}/story`
  const [moments, setMoments] = useState<SiteStoryMoment[]>([])
  const [photos, setPhotos]   = useState<StoryPhotoRecord[]>([])
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

  const view = useMemo(
    () => buildStoryView(template, layout, storyText, toStoryData({ moments, photos })),
    [template, layout, storyText, moments, photos],
  )

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
  }

  async function saveMoment(id: string, patch: Partial<SiteStoryMoment>): Promise<SiteStoryMoment | null> {
    const res = await fetch(`${base}/moments/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    if (!res.ok) { toastError(await readApiError(res, 'Não foi possível salvar o momento.')); return null }
    const { data } = (await res.json()) as { data: SiteStoryMoment }
    setMoments((prev) => prev.map((m) => (m.id === id ? data : m)))
    return data
  }

  async function deleteMoment(moment: SiteStoryMoment) {
    if (!window.confirm(`Excluir o momento "${moment.title || 'sem título'}"? As fotos dele continuam na história.`)) return
    const res = await fetch(`${base}/moments/${moment.id}`, { method: 'DELETE' })
    if (!res.ok) { toastError(await readApiError(res, 'Não foi possível excluir o momento.')); return }
    setMoments((prev) => prev.filter((m) => m.id !== moment.id))
    setPhotos((prev) => prev.map((p) => (p.moment_id === moment.id ? { ...p, moment_id: null } : p)))
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

  async function patchPhoto(id: string, patch: { caption?: string | null; moment_id?: string | null }) {
    const previous = photos
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
    const res = await fetch(`${base}/photos/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    if (!res.ok) {
      setPhotos(previous)
      toastError(await readApiError(res, 'Não foi possível atualizar a foto.'))
    }
  }

  async function deletePhoto(photo: StoryPhotoRecord) {
    if (!window.confirm('Excluir esta foto da história? O arquivo também será removido do armazenamento.')) return
    const res = await fetch(`${base}/photos/${photo.id}`, { method: 'DELETE' })
    if (!res.ok) { toastError(await readApiError(res, 'Não foi possível excluir a foto.')); return }
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
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
              markdown={markdown}
              canMoveUp={index > 0}
              canMoveDown={index < moments.length - 1}
              onMove={(direction) => moveMoment(index, direction)}
              onSave={(patch) => saveMoment(moment.id, patch)}
              onDelete={() => deleteMoment(moment)}
            />
          ))}
        </div>
        <button type="button" style={{ ...smallButton, marginTop: '10px', fontWeight: 600 }} onClick={addMoment} disabled={moments.length >= STORY_LIMITS.moments}>
          + Adicionar momento
        </button>
      </section>

      {/* ── Fotos ── */}
      <section aria-labelledby="story-photos-title">
        <h3 id="story-photos-title" style={sectionTitle}>Fotos da história ({photos.length}/{STORY_LIMITS.photos})</h3>
        <p style={hint}>
          Até {STORY_LIMITS.photos} fotos, otimizadas antes do envio (máx. {STORY_LIMITS.maxDimension}px). Elas contam no armazenamento do plano,
          mas não aparecem na galeria do site. Associe uma foto a um momento para exibi-la junto dele.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '12px' }}>
          {photos.map((photo, index) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              index={index}
              moments={moments}
              canMoveUp={index > 0}
              canMoveDown={index < photos.length - 1}
              onMove={(direction) => movePhoto(index, direction)}
              onPatch={(patch) => patchPhoto(photo.id, patch)}
              onDelete={() => deletePhoto(photo)}
            />
          ))}
        </div>
        <button
          type="button"
          style={{ ...smallButton, marginTop: '10px', fontWeight: 600, background: 'var(--wedding-color-subtle)', color: 'var(--wedding-color-dark)', border: 'none' }}
          onClick={() => fileInputRef.current?.click()}
          disabled={progress !== null || photos.length >= STORY_LIMITS.photos}
        >
          {progress ? `Enviando ${progress.current} de ${progress.total}…` : '+ Enviar fotos'}
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
        <p style={hint}>Mostra a seção no estilo atual do site, com os textos ainda não salvos.</p>
        <StoryPreview template={template} view={view} coupleNames={coupleNames} markdown={markdown} heading={heading} />
      </section>
    </div>
  )
}

// ───────────────────────── Momento ─────────────────────────
interface MomentCardProps {
  moment:      SiteStoryMoment
  markdown:    boolean
  canMoveUp:   boolean
  canMoveDown: boolean
  onMove:      (direction: -1 | 1) => void
  onSave:      (patch: Partial<SiteStoryMoment>) => Promise<SiteStoryMoment | null>
  onDelete:    () => void
}

function MomentCard({ moment, markdown, canMoveUp, canMoveDown, onMove, onSave, onDelete }: MomentCardProps) {
  const [title, setTitle]             = useState(moment.title ?? '')
  const [description, setDescription] = useState(moment.description ?? '')
  const [date, setDate]               = useState(moment.happened_on ?? '')
  const [precision, setPrecision]     = useState<StoryDatePrecision>(moment.date_precision)
  const [saving, setSaving]           = useState(false)
  const dirty = title !== (moment.title ?? '') || description !== (moment.description ?? '') || date !== (moment.happened_on ?? '') || precision !== moment.date_precision
  const idPrefix = `moment-${moment.id}`

  async function save() {
    setSaving(true)
    const saved = await onSave({ title, description, happened_on: date || null, date_precision: precision })
    setSaving(false)
    if (!saved) return
    // Sincroniza com o valor normalizado pelo servidor (espaços aparados, vazio → nulo).
    setTitle(saved.title ?? '')
    setDescription(saved.description ?? '')
    setDate(saved.happened_on ?? '')
    setPrecision(saved.date_precision)
    toastSuccess('Momento salvo.')
  }

  return (
    <div style={{ border: '1.5px solid #EBDDD0', borderRadius: '14px', padding: '14px', background: 'var(--surface)' }}>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px_110px]" style={{ gap: '10px' }}>
        <div>
          <label htmlFor={`${idPrefix}-title`} style={{ fontSize: '12.5px', fontWeight: 600 }}>Título</label>
          <input id={`${idPrefix}-title`} style={fieldStyle} value={title} maxLength={STORY_LIMITS.titleLength} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: O primeiro encontro" />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-date`} style={{ fontSize: '12.5px', fontWeight: 600 }}>Data (opcional)</label>
          <input id={`${idPrefix}-date`} type="date" style={fieldStyle} value={date} min="1900-01-01" max="2100-12-31" onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-precision`} style={{ fontSize: '12.5px', fontWeight: 600 }}>Exibir</label>
          <select id={`${idPrefix}-precision`} style={fieldStyle} value={precision} onChange={(e) => setPrecision(e.target.value as StoryDatePrecision)} disabled={!date}>
            <option value="day">Dia</option>
            <option value="month">Mês e ano</option>
            <option value="year">Só o ano</option>
          </select>
        </div>
      </div>
      <div style={{ marginTop: '10px' }}>
        <label htmlFor={`${idPrefix}-description`} style={{ fontSize: '12.5px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Descrição</label>
        <RichTextEditor id={`${idPrefix}-description`} value={description} onChange={setDescription} markdown={markdown} maxLength={STORY_LIMITS.descriptionLength} rows={3} placeholder="O que aconteceu nesse dia?" />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px', alignItems: 'center' }}>
        <button type="button" style={{ ...smallButton, background: dirty ? 'var(--wedding-color)' : 'var(--surface)', color: dirty ? '#fff' : 'var(--muted-fg)', fontWeight: 600 }} onClick={save} disabled={!dirty || saving}>
          {saving ? 'Salvando…' : dirty ? 'Salvar momento' : 'Salvo'}
        </button>
        <button type="button" style={smallButton} onClick={() => onMove(-1)} disabled={!canMoveUp} aria-label="Mover momento para cima">↑</button>
        <button type="button" style={smallButton} onClick={() => onMove(1)} disabled={!canMoveDown} aria-label="Mover momento para baixo">↓</button>
        <button type="button" style={{ ...smallButton, marginLeft: 'auto', color: '#C0553F' }} onClick={onDelete}>Excluir</button>
      </div>
    </div>
  )
}

// ───────────────────────── Foto ─────────────────────────
interface PhotoCardProps {
  photo:       StoryPhotoRecord
  index:       number
  moments:     SiteStoryMoment[]
  canMoveUp:   boolean
  canMoveDown: boolean
  onMove:      (direction: -1 | 1) => void
  onPatch:     (patch: { caption?: string | null; moment_id?: string | null }) => void
  onDelete:    () => void
}

function PhotoCard({ photo, index, moments, canMoveUp, canMoveDown, onMove, onPatch, onDelete }: PhotoCardProps) {
  const [caption, setCaption] = useState(photo.caption ?? '')
  const idPrefix = `story-photo-${photo.id}`

  return (
    <div style={{ display: 'flex', gap: '10px', border: '1.5px solid #EBDDD0', borderRadius: '14px', padding: '10px', background: 'var(--surface)' }}>
      <img src={photo.url} alt={photo.caption ?? `Foto ${index + 1} da história`} loading="lazy" style={{ width: '84px', height: '84px', objectFit: 'cover', borderRadius: '10px', flexShrink: 0, background: '#F1E9DD' }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label htmlFor={`${idPrefix}-caption`} className="sr-only">Legenda</label>
        <input
          id={`${idPrefix}-caption`}
          style={fieldStyle}
          value={caption}
          maxLength={STORY_LIMITS.captionLength}
          placeholder="Legenda (opcional)"
          onChange={(e) => setCaption(e.target.value)}
          onBlur={() => { if (caption.trim() !== (photo.caption ?? '')) onPatch({ caption: caption.trim() || null }) }}
        />
        <label htmlFor={`${idPrefix}-moment`} className="sr-only">Momento</label>
        <select
          id={`${idPrefix}-moment`}
          style={fieldStyle}
          value={photo.moment_id ?? ''}
          onChange={(e) => onPatch({ moment_id: e.target.value || null })}
        >
          <option value="">Sem momento (junto do texto)</option>
          {moments.map((m, i) => <option key={m.id} value={m.id}>{m.title || `Momento ${i + 1}`}</option>)}
        </select>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button type="button" style={smallButton} onClick={() => onMove(-1)} disabled={!canMoveUp} aria-label="Mover foto para trás">←</button>
          <button type="button" style={smallButton} onClick={() => onMove(1)} disabled={!canMoveDown} aria-label="Mover foto para frente">→</button>
          <button type="button" style={{ ...smallButton, marginLeft: 'auto', color: '#C0553F' }} onClick={onDelete} aria-label="Excluir foto">Excluir</button>
        </div>
      </div>
    </div>
  )
}
