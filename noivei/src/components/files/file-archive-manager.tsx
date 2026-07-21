'use client'

import { useRef, useState } from 'react'

import Modal from '@/components/ui/modal'
import Spinner from '@/components/ui/spinner'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import type { WeddingFile } from '@/types/database'

interface FileArchiveManagerProps {
  weddingId:         string
  initialFiles:      WeddingFile[]
  storageLimitBytes: number
}

interface ApiErrorBody {
  error?: { code?: string; message?: string }
}

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as ApiErrorBody
    return body.error?.message ?? fallback
  } catch {
    return fallback
  }
}

// NFKD decompõe acentos em letra base + diacrítico; o replace seguinte já derruba
// tanto os diacríticos quanto qualquer outro caractere fora de [a-zA-Z0-9.-_] — o
// nome sanitizado vira parte do path no bucket, que não aceita espaços/acentos.
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
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}
function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
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
function ImageFileIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  )
}
function PdfFileIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}
function GenericFileIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13 2 13 9 20 9" />
    </svg>
  )
}

function FileIcon({ mimeType }: { mimeType: string | null }) {
  if (mimeType?.startsWith('image/')) return <ImageFileIcon />
  if (mimeType === 'application/pdf') return <PdfFileIcon />
  return <GenericFileIcon />
}

export default function FileArchiveManager({ weddingId, initialFiles, storageLimitBytes }: FileArchiveManagerProps) {
  const [files, setFiles]           = useState<WeddingFile[]>(initialFiles)
  const [uploading, setUploading]   = useState(false)
  const [error, setError]           = useState('')
  const [deleting, setDeleting]     = useState<WeddingFile | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const inputRef        = useRef<HTMLInputElement>(null)
  const showUploadSpinner = useDelayedLoading(uploading)

  const apiBase  = `/api/v1/weddings/${weddingId}/files`
  const usedBytes = files.reduce((sum, f) => sum + f.size_bytes, 0)
  const usedPct   = storageLimitBytes > 0 ? Math.min(100, (usedBytes / storageLimitBytes) * 100) : 0

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || uploading) return

    setUploading(true)
    setError('')

    const path = `${weddingId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`
    const supabase = createSupabaseBrowser()

    // Upload direto do browser pro Storage (não passa pela Route Handler): evita o limite
    // de body de poucos MB dos Route Handlers em produção e usa a RLS de storage.objects
    // (que já garante posse pelo prefixo do path) em vez de reimplementar isso na API.
    const { error: uploadError } = await supabase.storage.from('wedding-files').upload(path, file)
    if (uploadError) {
      setUploading(false)
      setError('Não foi possível enviar o arquivo. Verifique o tamanho (máx. 10 MB) e tente novamente.')
      return
    }

    const res = await fetch(apiBase, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_name:    file.name,
        storage_path: path,
        size_bytes:   file.size,
        mime_type:    file.type || null,
      }),
    })

    if (!res.ok) {
      // O upload já subiu pro storage; sem o registro de metadados ele fica órfão — remove.
      await supabase.storage.from('wedding-files').remove([path])
      setUploading(false)
      setError(await readApiError(res, 'Não foi possível salvar o arquivo.'))
      return
    }

    const { data } = (await res.json()) as { data: WeddingFile }
    setFiles((prev) => [data, ...prev])
    setUploading(false)
  }

  async function handleDownload(file: WeddingFile) {
    if (downloadingId) return
    setDownloadingId(file.id)
    setError('')

    const res = await fetch(`${apiBase}/${file.id}`)
    setDownloadingId(null)

    if (!res.ok) {
      setError(await readApiError(res, 'Não foi possível gerar o link de download.'))
      return
    }

    const { data } = (await res.json()) as { data: { url: string } }
    window.open(data.url, '_blank', 'noopener,noreferrer')
  }

  async function handleDelete() {
    if (!deleting || deletingId) return
    setDeletingId(deleting.id)
    setError('')

    const res = await fetch(`${apiBase}/${deleting.id}`, { method: 'DELETE' })

    setDeletingId(null)
    if (!res.ok) {
      setError(await readApiError(res, 'Não foi possível excluir o arquivo.'))
      setDeleting(null)
      return
    }

    setFiles((prev) => prev.filter((f) => f.id !== deleting.id))
    setDeleting(null)
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            className="font-display"
            style={{ fontWeight: 500, fontSize: 'clamp(30px,4.2vw,42px)', lineHeight: 1.05, color: 'var(--fg)' }}
          >
            Central de arquivos
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--muted-fg)', marginTop: '4px' }}>
            Guarde contratos, orçamentos e documentos importantes do casamento
          </p>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'var(--wedding-color)', color: '#fff', border: 'none',
            borderRadius: '12px', padding: '10px 16px',
            fontWeight: 600, fontSize: '14px', cursor: uploading ? 'wait' : 'pointer',
            opacity: uploading ? 0.7 : 1,
            boxShadow: '0 6px 16px color-mix(in srgb, var(--wedding-color) 32%, transparent)',
          }}
        >
          {showUploadSpinner ? <Spinner color="#fff" /> : <UploadIcon />}
          {uploading ? 'Enviando…' : 'Enviar arquivo'}
        </button>
        <input ref={inputRef} type="file" onChange={handleFileChange} style={{ display: 'none' }} />
      </div>

      {error && (
        <div
          className="mb-5 rounded-2xl p-4"
          style={{ background: '#F6E4DE', border: '1px solid #C0553F', fontSize: '14px', color: '#C0553F' }}
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Barra de uso */}
      <div
        className="mb-6 rounded-2xl bg-[var(--surface)] p-5"
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

      {/* Lista de arquivos */}
      <div className="overflow-hidden rounded-2xl bg-[var(--surface)]" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)' }}>
        {files.map((file, idx) => (
          <div
            key={file.id}
            className="flex flex-wrap items-center gap-4 px-5 py-4"
            style={{ borderBottom: idx < files.length - 1 ? '1px solid #F8F3EE' : 'none' }}
          >
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                width: '38px', height: '38px', borderRadius: '10px',
                background: 'var(--wedding-color-subtle)', color: 'var(--wedding-color-dark)',
              }}
            >
              <FileIcon mimeType={file.mime_type} />
            </div>

            <div style={{ flex: 1, minWidth: '200px' }}>
              <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--fg)', wordBreak: 'break-word' }}>
                {file.file_name}
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--muted-fg)', marginTop: '1px' }}>
                {formatBytes(file.size_bytes)}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
              <button
                onClick={() => handleDownload(file)}
                disabled={downloadingId === file.id}
                title="Baixar arquivo"
                aria-label={`Baixar ${file.file_name}`}
                style={{
                  border: 'none', background: 'transparent', color: 'var(--muted-fg)',
                  cursor: downloadingId === file.id ? 'wait' : 'pointer', padding: '6px', borderRadius: '8px',
                  opacity: downloadingId === file.id ? 0.5 : 1,
                }}
              >
                {downloadingId === file.id ? <Spinner size={14} /> : <DownloadIcon />}
              </button>
              <button
                onClick={() => setDeleting(file)}
                title="Excluir arquivo"
                aria-label={`Excluir ${file.file_name}`}
                style={{ border: 'none', background: 'transparent', color: 'var(--muted-fg)', cursor: 'pointer', padding: '6px', borderRadius: '8px' }}
              >
                <TrashIcon />
              </button>
            </div>
          </div>
        ))}
        {files.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted-fg)', fontSize: '14px' }}>
            Nenhum arquivo enviado ainda. Envie contratos, orçamentos e outros documentos.
          </div>
        )}
      </div>

      {/* Modal de confirmação de exclusão */}
      <Modal open={deleting !== null} onClose={() => { if (!deletingId) setDeleting(null) }} title="Excluir arquivo">
        <p style={{ fontSize: '14px', color: 'var(--muted-fg)', lineHeight: 1.6, margin: '0 0 18px' }}>
          Excluir &quot;{deleting?.file_name}&quot;? Essa ação não pode ser desfeita.
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
