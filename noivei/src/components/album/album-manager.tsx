'use client'

import { useEffect, useState } from 'react'

import Modal from '@/components/ui/modal'
import Spinner from '@/components/ui/spinner'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { buildAlbumWhatsAppUrl } from '@/lib/rsvp/build-whatsapp-link'
import { toastError, toastSuccess } from '@/store/toast.store'

// Espelha o shape devolvido por GET /api/v1/weddings/[wid]/album (ver
// AlbumPhotoWithUrl na Route Handler) — não importado de lá de propósito,
// Route Handlers (route.ts) não são pensados pra serem importados por
// componentes client.
interface AlbumPhotoWithUrl {
  id:                        string
  size_bytes:                number
  mime_type:                 string
  created_at:                string
  contributor_name:          string | null
  contributor_relationship:  string | null
  url:                       string | null
}

interface AlbumManagerProps {
  weddingId:   string
  coupleNames: string
  albumLink:   string
  qrDataUrl:   string
}

interface ApiErrorBody {
  error?: { message?: string }
}

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as ApiErrorBody
    return body.error?.message ?? fallback
  } catch {
    return fallback
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}
function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.004 2.003c-5.514 0-9.997 4.483-9.997 9.997 0 1.763.462 3.486 1.34 5.003l-1.42 5.187 5.31-1.393a9.96 9.96 0 0 0 4.767 1.213h.004c5.514 0 9.997-4.483 9.997-9.997 0-2.671-1.04-5.182-2.929-7.071a9.935 9.935 0 0 0-7.072-2.939zm0 18.183h-.003a8.18 8.18 0 0 1-4.166-1.14l-.299-.177-3.15.826.841-3.07-.194-.316a8.186 8.186 0 0 1-1.256-4.393c0-4.529 3.685-8.213 8.23-8.213 2.198 0 4.264.857 5.818 2.413a8.161 8.161 0 0 1 2.408 5.812c0 4.529-3.685 8.213-8.23 8.213z" />
    </svg>
  )
}
function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  )
}

export default function AlbumManager({ weddingId, coupleNames, albumLink, qrDataUrl }: AlbumManagerProps) {
  const [photos, setPhotos]   = useState<AlbumPhotoWithUrl[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting]     = useState<AlbumPhotoWithUrl | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const showSpinner = useDelayedLoading(loading)

  const apiBase = `/api/v1/weddings/${weddingId}/album`

  useEffect(() => {
    let cancelled = false

    async function loadPhotos() {
      const res = await fetch(apiBase)
      if (cancelled) return
      setLoading(false)
      if (!res.ok) {
        toastError(await readApiError(res, 'Não foi possível carregar as fotos do álbum.'))
        return
      }
      const { data } = (await res.json()) as { data: AlbumPhotoWithUrl[] }
      setPhotos(data)
    }

    void loadPhotos()
    return () => { cancelled = true }
  }, [apiBase])

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(albumLink)
      toastSuccess('Link copiado!')
    } catch {
      toastError('Não foi possível copiar o link.')
    }
  }

  function handleShareWhatsApp() {
    const url = buildAlbumWhatsAppUrl({ coupleNames, albumLink })
    window.open(url, '_blank')
  }

  async function handleDelete() {
    if (!deleting || deletingId) return
    setDeletingId(deleting.id)

    const res = await fetch(`${apiBase}/photos/${deleting.id}`, { method: 'DELETE' })

    setDeletingId(null)
    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível excluir a foto.'))
      setDeleting(null)
      return
    }

    setPhotos((prev) => prev.filter((p) => p.id !== deleting.id))
    setDeleting(null)
  }

  return (
    <div>
      <div className="mb-6">
        <h1
          className="font-display"
          style={{ fontWeight: 500, fontSize: 'clamp(30px,4.2vw,42px)', lineHeight: 1.05, color: 'var(--fg)' }}
        >
          Álbum de fotos
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--muted-fg)', marginTop: '4px' }}>
          Compartilhe o QR code no salão para os convidados enviarem fotos do casamento em tempo real
        </p>
      </div>

      {/* QR + link de compartilhamento */}
      <div
        className="mb-6 flex flex-wrap items-center gap-6 rounded-2xl bg-[var(--surface)] p-6"
        style={{ boxShadow: '0 6px 18px rgba(60,40,24,0.07)' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL gerado no servidor, sem domínio fixo pra configurar no next/image */}
        <img
          src={qrDataUrl}
          alt="QR code do mural de fotos"
          width={140}
          height={140}
          style={{ borderRadius: '12px', border: '1px solid #EBDDD0', flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: '220px' }}>
          <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--fg)', marginBottom: '6px' }}>
            Link público do mural
          </div>
          <div
            style={{
              fontSize: '13px', color: 'var(--muted-fg)', wordBreak: 'break-all',
              background: 'var(--wedding-color-subtle)', borderRadius: '10px', padding: '10px 12px', marginBottom: '12px',
            }}
          >
            {albumLink}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCopyLink}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                background: 'var(--wedding-color)', color: '#fff', border: 'none',
                borderRadius: '10px', padding: '9px 14px', fontWeight: 600, fontSize: '13.5px', cursor: 'pointer',
              }}
            >
              <CopyIcon /> Copiar link
            </button>
            <button
              onClick={handleShareWhatsApp}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                background: '#25D366', color: '#fff', border: 'none',
                borderRadius: '10px', padding: '9px 14px', fontWeight: 600, fontSize: '13.5px', cursor: 'pointer',
              }}
            >
              <WhatsAppIcon /> Compartilhar
            </button>
          </div>
        </div>
      </div>

      {/* Grid de fotos enviadas pelos convidados */}
      <div
        className="overflow-hidden rounded-2xl bg-[var(--surface)] p-5"
        style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)' }}
      >
        <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--fg)', marginBottom: '14px' }}>
          Fotos recebidas {photos.length > 0 && `(${photos.length})`}
        </div>

        {showSpinner && (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <Spinner size={22} color="var(--wedding-color)" />
          </div>
        )}

        {!loading && photos.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted-fg)', fontSize: '14px' }}>
            Nenhuma foto enviada ainda. Compartilhe o link ou o QR code acima com os convidados.
          </div>
        )}

        {!loading && photos.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((photo) => (
              <div key={photo.id} className="overflow-hidden rounded-xl" style={{ border: '1px solid #F0E6D8' }}>
                <div style={{ position: 'relative', aspectRatio: '1', background: 'var(--wedding-color-subtle)' }}>
                  {photo.url && (
                    // eslint-disable-next-line @next/next/no-img-element -- signed URL do Storage, expira em 60s, sem domínio fixo pra configurar no next/image
                    <img
                      src={photo.url}
                      alt={`Foto de ${photo.contributor_name ?? 'convidado'}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  )}
                  <button
                    onClick={() => setDeleting(photo)}
                    title="Excluir foto"
                    aria-label="Excluir foto"
                    style={{
                      position: 'absolute', top: '6px', right: '6px',
                      border: 'none', borderRadius: '8px', padding: '6px',
                      background: 'rgba(42,30,16,0.55)', color: '#fff', cursor: 'pointer',
                    }}
                  >
                    <TrashIcon />
                  </button>
                </div>
                <div style={{ padding: '8px 10px' }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--fg)', wordBreak: 'break-word' }}>
                    {photo.contributor_name ?? 'Convidado'}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--muted-fg)' }}>
                    {photo.contributor_relationship ?? '—'} · {formatDateTime(photo.created_at)} · {formatBytes(photo.size_bytes)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de confirmação de exclusão */}
      <Modal open={deleting !== null} onClose={() => { if (!deletingId) setDeleting(null) }} title="Excluir foto">
        <p style={{ fontSize: '14px', color: 'var(--muted-fg)', lineHeight: 1.6, margin: '0 0 18px' }}>
          Excluir esta foto do álbum? Essa ação não pode ser desfeita.
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setDeleting(null)}
            disabled={deletingId !== null}
            style={{
              flex: 1, padding: '12px', borderRadius: '12px',
              border: '1.5px solid #EBDDD0', background: 'transparent',
              color: 'var(--fg)', fontWeight: 600, fontSize: '14px',
              cursor: deletingId !== null ? 'not-allowed' : 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleDelete}
            disabled={deletingId !== null}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
              background: '#C0553F', color: '#fff', fontWeight: 700, fontSize: '14px',
              cursor: deletingId !== null ? 'not-allowed' : 'pointer', opacity: deletingId !== null ? 0.7 : 1,
            }}
          >
            {deletingId !== null && <Spinner size={15} color="#fff" />}
            {deletingId !== null ? 'Excluindo…' : 'Sim, excluir'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
