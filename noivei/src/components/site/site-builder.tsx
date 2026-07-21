'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import Spinner from '@/components/ui/spinner'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { useOrigin } from '@/hooks/use-origin'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { toastError, toastSuccess } from '@/store/toast.store'
import { SiteSlugSchema } from '@/lib/api/validation/site.schema'
import { parseSiteContent, type SiteContent } from '@/lib/site/site-content'
import type { SiteConfig } from '@/types/database'

// Marcador do endpoint público do bucket "wedding-photos" — presente numa URL indica que
// ela veio de um upload (não de uma URL externa colada manualmente), e o que vem depois
// dele é o storage_path do objeto, usado pra localizar o registro na hora de excluir.
const GALLERY_BUCKET_URL_MARKER = '/storage/v1/object/public/wedding-photos/'

interface GalleryPhotoRecord {
  storage_path: string
  size_bytes:   number
  public_url:   string
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
  coupleNames: string
  slug:        string
  published:   boolean
  coverTitle:  string
  publicUrl:   string | null
  saving:      boolean
  onSave:      (values: { slug: string; published: boolean; coverTitle: string }) => Promise<PatchResult>
}

function CapaSection({ coupleNames, slug, published, coverTitle, publicUrl, saving, onSave }: CapaSectionProps) {
  const [slugDraft, setSlugDraft]   = useState(slug)
  const [titleDraft, setTitleDraft] = useState(coverTitle)
  const [publishedDraft, setPublishedDraft] = useState(published)
  // Erro de validação do slug fica local ao campo — não é resultado de uma ação de rede
  const [error, setError]     = useState('')
  const showSpinner = useDelayedLoading(saving)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const parsedSlug = SiteSlugSchema.safeParse(slugDraft)
    if (!parsedSlug.success) {
      setError(parsedSlug.error.issues[0]?.message ?? 'Slug inválido.')
      return
    }

    const result = await onSave({ slug: parsedSlug.data, published: publishedDraft, coverTitle: titleDraft.trim() })
    if (!result.ok) {
      toastError(result.message)
      return
    }
    toastSuccess('Capa salva com sucesso!')
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
  saving:        boolean
  siteExists:    boolean
  onSave:        (values: { our_story: string; custom_message: string }) => Promise<PatchResult>
  onGoToCapa:    () => void
}

function HistoriaSection({ ourStory, customMessage, saving, siteExists, onSave, onGoToCapa }: HistoriaSectionProps) {
  const [storyDraft, setStoryDraft]     = useState(ourStory)
  const [messageDraft, setMessageDraft] = useState(customMessage)
  const showSpinner = useDelayedLoading(saving)

  if (!siteExists) return <GuardNotice onGoToCapa={onGoToCapa} />

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const result = await onSave({ our_story: storyDraft.trim(), custom_message: messageDraft.trim() })
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
  saving:        boolean
  siteExists:    boolean
  onSave:        (values: { ceremony_info: string; reception_info: string }) => Promise<PatchResult>
  onGoToCapa:    () => void
}

function CerimoniaSection({ ceremonyInfo, receptionInfo, saving, siteExists, onSave, onGoToCapa }: CerimoniaSectionProps) {
  const [ceremonyDraft, setCeremonyDraft]   = useState(ceremonyInfo)
  const [receptionDraft, setReceptionDraft] = useState(receptionInfo)
  const showSpinner = useDelayedLoading(saving)

  if (!siteExists) return <GuardNotice onGoToCapa={onGoToCapa} />

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const result = await onSave({ ceremony_info: ceremonyDraft.trim(), reception_info: receptionDraft.trim() })
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
  weddingId:         string
  galleryUrls:       string[]
  saving:            boolean
  siteExists:        boolean
  storageLimitBytes: number
  storageUsedBytes:  number
  onSave:            (values: { gallery_urls: string[] }) => Promise<PatchResult>
  onGoToCapa:        () => void
}

function GaleriaSection({
  weddingId, galleryUrls, saving, siteExists, storageLimitBytes, storageUsedBytes, onSave, onGoToCapa,
}: GaleriaSectionProps) {
  const [urls, setUrls]           = useState<string[]>(galleryUrls)
  const [newUrl, setNewUrl]       = useState('')
  const [usedBytes, setUsedBytes] = useState(storageUsedBytes)
  // Tamanho de cada foto vinda de upload, por URL pública — populado pelo GET inicial
  // (fotos de sessões anteriores) e por cada novo upload. Sem isso não dá pra descontar
  // o valor certo da barra de uso ao excluir uma foto enviada em outra sessão.
  const [photoSizes, setPhotoSizes] = useState<Record<string, number>>({})
  const [uploading, setUploading] = useState(false)
  const inputRef     = useRef<HTMLInputElement>(null)
  const showSpinner  = useDelayedLoading(saving)
  const showUploadSpinner = useDelayedLoading(uploading)

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
      })
      .catch(() => {
        // Melhor esforço: sem esses dados, a barra de uso fica só ligeiramente
        // desatualizada até o próximo carregamento da página — não é crítico.
      })

    return () => { cancelled = true }
  }, [weddingId])

  if (!siteExists) return <GuardNotice onGoToCapa={onGoToCapa} />

  const usedPct = storageLimitBytes > 0 ? Math.min(100, (usedBytes / storageLimitBytes) * 100) : 0

  function addUrl() {
    const trimmed = newUrl.trim()
    if (!trimmed) return
    setUrls((prev) => [...prev, trimmed])
    setNewUrl('')
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || uploading) return

    setUploading(true)

    const path = `${weddingId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`
    const supabase = createSupabaseBrowser()

    // Upload direto do browser pro Storage (não passa pela Route Handler) — mesmo
    // padrão de FileArchiveManager: evita limite de body da Route Handler e usa a RLS
    // de storage.objects (posse pelo prefixo do path) em vez de reimplementar isso na API.
    const { error: uploadError } = await supabase.storage.from('wedding-photos').upload(path, file)
    if (uploadError) {
      setUploading(false)
      toastError('Não foi possível enviar a foto. Verifique o tamanho (máx. 8 MB) e o formato (PNG, JPG, WEBP, HEIC ou GIF).')
      return
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
      setUploading(false)
      toastError(await readApiError(res, 'Não foi possível salvar a foto.'))
      return
    }

    const { data } = (await res.json()) as { data: GalleryPhotoRecord }
    setUrls((prev) => [...prev, data.public_url])
    setPhotoSizes((prev) => ({ ...prev, [data.public_url]: data.size_bytes }))
    setUsedBytes((prev) => prev + data.size_bytes)
    setUploading(false)
    toastSuccess('Foto enviada com sucesso!')
  }

  async function removeUrl(index: number) {
    const url = urls[index]
    setUrls((prev) => prev.filter((_, i) => i !== index))
    if (url === undefined) return

    const markerIndex = url.indexOf(GALLERY_BUCKET_URL_MARKER)
    // URL externa colada manualmente: só remove da lista, sem chamar a API.
    if (markerIndex === -1) return

    const storagePath = url.slice(markerIndex + GALLERY_BUCKET_URL_MARKER.length)
    const removedSize = photoSizes[url] ?? 0

    // Best-effort: a foto já saiu da lista visível independente do resultado da chamada —
    // uma falha aqui deixa o objeto órfão no storage/tabela, mas não deve travar o usuário.
    const res = await fetch(
      `/api/v1/weddings/${weddingId}/gallery-photos?storage_path=${encodeURIComponent(storagePath)}`,
      { method: 'DELETE' },
    )

    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível remover a foto do armazenamento.'))
      return
    }

    setPhotoSizes((prev) => {
      const next = { ...prev }
      delete next[url]
      return next
    })
    setUsedBytes((prev) => Math.max(0, prev - removedSize))
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

      <div>
        <label htmlFor="site-gallery-url" style={labelStyle}>Adicionar imagem (URL)</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            id="site-gallery-url"
            type="url"
            maxLength={2048}
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addUrl() } }}
            placeholder="https://..."
            style={inputStyle}
          />
          <button
            type="button"
            onClick={addUrl}
            aria-label="Adicionar imagem"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '46px', flexShrink: 0, border: 'none', borderRadius: '12px',
              background: 'var(--wedding-color-subtle)', color: 'var(--wedding-color-dark)', cursor: 'pointer',
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
          {uploading ? 'Enviando…' : 'Enviar do computador'}
        </button>
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
      </div>

      {urls.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--muted-fg)', margin: 0 }}>Nenhuma imagem adicionada ainda.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {urls.map((url, index) => (
            <li
              key={`${url}-${index}`}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 10px', borderRadius: '10px', border: '1px solid #EBDDD0',
              }}
            >
              <span style={{ flex: 1, fontSize: '13px', color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {url}
              </span>
              <button
                type="button"
                onClick={() => removeUrl(index)}
                aria-label="Remover imagem"
                style={{ border: 'none', background: 'transparent', color: '#C0553F', cursor: 'pointer', padding: '4px' }}
              >
                <TrashIcon />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="submit" disabled={saving} style={saveButtonStyle(saving)}>
        {showSpinner && <Spinner color="#fff" />} Salvar galeria
      </button>
    </form>
  )
}

export default function SiteBuilder({
  weddingId, coupleNames, initialSite, storageLimitBytes, storageUsedBytes,
}: SiteBuilderProps) {
  const [active, setActive]       = useState<SectionId>('capa')
  const [siteId, setSiteId]       = useState<string | null>(initialSite?.id ?? null)
  const [slug, setSlug]           = useState(initialSite?.slug ?? '')
  const [published, setPublished] = useState(initialSite?.published ?? false)
  const [content, setContent]     = useState<SiteContent>(() => parseSiteContent(initialSite?.content))
  const [saving, setSaving]       = useState(false)
  const origin                    = useOrigin()

  const apiBase  = `/api/v1/weddings/${weddingId}/site`
  const publicUrl = slug ? `${origin || 'https://…'}/${slug}` : null

  async function patchSite(body: { slug?: string; published?: boolean; content?: SiteContent }): Promise<PatchResult> {
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
    setContent(parseSiteContent(data.content))
    return { ok: true, message: '' }
  }

  async function saveCapa(values: { slug: string; published: boolean; coverTitle: string }): Promise<PatchResult> {
    const nextContent: SiteContent = { ...content }
    if (values.coverTitle) nextContent.cover_title = values.coverTitle
    else delete nextContent.cover_title

    return patchSite({ slug: values.slug, published: values.published, content: nextContent })
  }

  async function saveContentPatch(patch: Partial<SiteContent>): Promise<PatchResult> {
    const nextContent: SiteContent = { ...content }

    const textKeys = ['cover_title', 'our_story', 'ceremony_info', 'reception_info', 'custom_message'] as const
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
                coverTitle={content.cover_title ?? ''}
                publicUrl={publicUrl}
                saving={saving}
                onSave={saveCapa}
              />
            )}
            {active === 'historia' && (
              <HistoriaSection
                ourStory={content.our_story ?? ''}
                customMessage={content.custom_message ?? ''}
                saving={saving}
                siteExists={siteExists}
                onSave={saveContentPatch}
                onGoToCapa={() => setActive('capa')}
              />
            )}
            {active === 'cerimonia' && (
              <CerimoniaSection
                ceremonyInfo={content.ceremony_info ?? ''}
                receptionInfo={content.reception_info ?? ''}
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
                weddingId={weddingId}
                galleryUrls={content.gallery_urls ?? []}
                saving={saving}
                siteExists={siteExists}
                storageLimitBytes={storageLimitBytes}
                storageUsedBytes={storageUsedBytes}
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
