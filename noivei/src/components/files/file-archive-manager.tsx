'use client'

import { useRef, useState } from 'react'

import Modal from '@/components/ui/modal'
import Spinner from '@/components/ui/spinner'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { uploadWeddingFile } from '@/lib/files/upload-wedding-file'
import { toastError } from '@/store/toast.store'
import type { WeddingFile, WeddingFileCategory } from '@/types/database'

interface FileArchiveManagerProps {
  weddingId:         string
  initialFiles:      WeddingFile[]
  storageLimitBytes: number
}

type CategoryFilter = 'todos' | WeddingFileCategory

const CATEGORY_TABS: { value: CategoryFilter; label: string }[] = [
  { value: 'todos',    label: 'Todos' },
  { value: 'geral',    label: 'Geral' },
  { value: 'contrato', label: 'Contratos' },
]

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
function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
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
function ContractIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="m9 15 2 2 4-4" />
    </svg>
  )
}

function FileIcon({ mimeType }: { mimeType: string | null }) {
  if (mimeType?.startsWith('image/')) return <ImageFileIcon />
  if (mimeType === 'application/pdf') return <PdfFileIcon />
  return <GenericFileIcon />
}

// Só imagem e PDF têm preview confiável no browser sem depender de uma lib nova
// (docx/xlsx/etc. não têm renderer nativo) — os demais tipos seguem só com download.
function isPreviewable(mimeType: string | null): boolean {
  return mimeType?.startsWith('image/') === true || mimeType === 'application/pdf'
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

export default function FileArchiveManager({ weddingId, initialFiles, storageLimitBytes }: FileArchiveManagerProps) {
  const [files, setFiles]           = useState<WeddingFile[]>(initialFiles)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('todos')
  const [uploading, setUploading]   = useState(false)
  // Progresso do lote de upload (múltiplos arquivos selecionados de uma vez) — null fora de um upload
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null)
  const [deleting, setDeleting]     = useState<WeddingFile | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  // Preview: previewFile só é setado depois que a signed URL inline já foi buscada
  // (evita um estado "modal aberto, carregando" — o botão já mostra o spinner antes disso).
  const [previewFile, setPreviewFile] = useState<WeddingFile | null>(null)
  const [previewUrl, setPreviewUrl]   = useState<string | null>(null)
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null)
  // Dois inputs de arquivo separados (mesma dropzone/lista, botões diferentes) — cada um
  // fixa a categoria do lote que sobe por ele, sem precisar de um seletor extra no meio do upload.
  const inputRef         = useRef<HTMLInputElement>(null)
  const contractInputRef = useRef<HTMLInputElement>(null)
  const showUploadSpinner = useDelayedLoading(uploading)

  const apiBase  = `/api/v1/weddings/${weddingId}/files`
  const usedBytes = files.reduce((sum, f) => sum + f.size_bytes, 0)
  const usedPct   = storageLimitBytes > 0 ? Math.min(100, (usedBytes / storageLimitBytes) * 100) : 0
  const visibleFiles = categoryFilter === 'todos' ? files : files.filter((f) => f.category === categoryFilter)

  // Envia um único arquivo na categoria escolhida — delega upload pro Storage + registro
  // dos metadados ao helper compartilhado (mesmo usado pelo anexo de lançamento financeiro),
  // só cuidando do estado local (lista de arquivos, toast de erro) aqui.
  async function uploadOneFile(file: File, category: WeddingFileCategory): Promise<boolean> {
    const result = await uploadWeddingFile(weddingId, file, category)
    if (!result.file) {
      toastError(result.error ?? 'Não foi possível salvar o arquivo.')
      return false
    }

    setFiles((prev) => [result.file as WeddingFile, ...prev])
    return true
  }

  // Upload em lote: envia um arquivo de cada vez (sequencial, não em paralelo) para que a
  // checagem de cota de armazenamento (checkStorageLimit, feita a cada POST) sempre veja o
  // uso já atualizado pelos uploads anteriores do mesmo lote. Decisão de UX: seguimos o lote
  // mesmo se um arquivo estourar a cota ou falhar por outro motivo — os que couberem são
  // salvos normalmente (cada falha já mostra seu próprio erro), em vez de abortar tudo no
  // primeiro problema e descartar uploads que já eram válidos.
  // Compartilhada pelo <input type="file"> e pelo drop da drag-and-drop — mesma pipeline,
  // mesmo guard de "já tem upload em andamento", pra não duplicar a lógica de progresso.
  async function uploadFiles(fileList: FileList | File[], category: WeddingFileCategory) {
    const selected = Array.from(fileList)
    if (selected.length === 0 || uploading) return

    setUploading(true)

    for (let i = 0; i < selected.length; i++) {
      setUploadProgress({ current: i + 1, total: selected.length })
      const file = selected[i]
      if (!file) continue
      await uploadOneFile(file, category)
    }

    setUploadProgress(null)
    setUploading(false)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>, category: WeddingFileCategory) {
    const selected = Array.from(e.target.files ?? [])
    e.target.value = ''
    void uploadFiles(selected, category)
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDraggingOver(true)
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDraggingOver(false)
  }

  // Drag-and-drop sempre entra como "geral" — soltar um contrato assinado exige o botão
  // dedicado "Adicionar contrato assinado", que deixa a categoria explícita pro casal.
  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDraggingOver(false)
    void uploadFiles(e.dataTransfer.files, 'geral')
  }

  async function handleDownload(file: WeddingFile) {
    if (downloadingId) return
    setDownloadingId(file.id)

    const res = await fetch(`${apiBase}/${file.id}`)
    setDownloadingId(null)

    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível gerar o link de download.'))
      return
    }

    const { data } = (await res.json()) as { data: { url: string } }
    window.open(data.url, '_blank', 'noopener,noreferrer')
  }

  // Visualização inline: busca a signed URL SEM `download` (?disposition=inline), diferente
  // da usada em handleDownload — essa não força Content-Disposition: attachment, então o
  // browser renderiza direto no <img>/<iframe> em vez de baixar o arquivo.
  async function handlePreview(file: WeddingFile) {
    if (previewLoadingId) return
    setPreviewLoadingId(file.id)

    const res = await fetch(`${apiBase}/${file.id}?disposition=inline`)
    setPreviewLoadingId(null)

    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível abrir a visualização.'))
      return
    }

    const { data } = (await res.json()) as { data: { url: string } }
    setPreviewUrl(data.url)
    setPreviewFile(file)
  }

  function closePreview() {
    setPreviewFile(null)
    setPreviewUrl(null)
  }

  async function handleDelete() {
    if (!deleting || deletingId) return
    setDeletingId(deleting.id)

    const res = await fetch(`${apiBase}/${deleting.id}`, { method: 'DELETE' })

    setDeletingId(null)
    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível excluir o arquivo.'))
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              onClick={() => contractInputRef.current?.click()}
              disabled={uploading}
              title="Enviar um contrato assinado — aparece na aba dedicada Contratos"
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'transparent', color: 'var(--wedding-color-dark)',
                border: '1.5px solid var(--wedding-color)', borderRadius: '12px', padding: '10px 16px',
                fontWeight: 600, fontSize: '14px', cursor: uploading ? 'wait' : 'pointer',
                opacity: uploading ? 0.7 : 1,
              }}
            >
              <ContractIcon />
              Adicionar contrato assinado
            </button>
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
              {uploadProgress ? `Enviando ${uploadProgress.current} de ${uploadProgress.total}…` : uploading ? 'Enviando…' : 'Adicionar arquivo'}
            </button>
          </div>
          <input ref={inputRef} type="file" multiple onChange={(e) => handleFileChange(e, 'geral')} style={{ display: 'none' }} />
          <input ref={contractInputRef} type="file" multiple onChange={(e) => handleFileChange(e, 'contrato')} style={{ display: 'none' }} />
          <span style={{ fontSize: '12px', color: 'var(--muted-fg)' }}>ou arraste um arquivo até a lista abaixo (entra como Geral)</span>
        </div>
      </div>

      {/* Abas de categoria */}
      <div className="mb-4 flex gap-2" role="tablist" aria-label="Filtrar arquivos por categoria">
        {CATEGORY_TABS.map((tab) => {
          const active = categoryFilter === tab.value
          return (
            <button
              key={tab.value}
              role="tab"
              aria-selected={active}
              onClick={() => setCategoryFilter(tab.value)}
              style={{
                border: 'none', borderRadius: '999px', padding: '7px 16px',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                background: active ? 'var(--wedding-color)' : 'var(--wedding-color-subtle)',
                color: active ? '#fff' : 'var(--wedding-color-dark)',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

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

      {/* Lista de arquivos — também é a dropzone de drag-and-drop */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="overflow-hidden rounded-2xl bg-[var(--surface)]"
        style={{
          boxShadow: '0 8px 22px rgba(60,40,24,0.06)',
          border: isDraggingOver ? '2px dashed var(--wedding-color)' : '2px dashed transparent',
          background: isDraggingOver ? 'var(--wedding-color-subtle)' : undefined,
          transition: 'border-color 0.15s, background 0.15s',
        }}
      >
        {visibleFiles.map((file, idx) => (
          <div
            key={file.id}
            className="flex flex-wrap items-center gap-4 px-5 py-4"
            style={{ borderBottom: idx < visibleFiles.length - 1 ? '1px solid #F8F3EE' : 'none' }}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--fg)', wordBreak: 'break-word' }}>
                  {file.file_name}
                </span>
                {categoryFilter === 'todos' && file.category === 'contrato' && (
                  <span
                    style={{
                      fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                      padding: '2px 8px', borderRadius: '999px',
                      background: 'var(--wedding-color-subtle)', color: 'var(--wedding-color-dark)',
                    }}
                  >
                    Contrato
                  </span>
                )}
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--muted-fg)', marginTop: '1px' }}>
                {formatBytes(file.size_bytes)}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
              {isPreviewable(file.mime_type) && (
                <button
                  onClick={() => handlePreview(file)}
                  disabled={previewLoadingId === file.id}
                  title="Visualizar arquivo"
                  aria-label={`Visualizar ${file.file_name}`}
                  style={{
                    border: 'none', background: 'transparent', color: 'var(--muted-fg)',
                    cursor: previewLoadingId === file.id ? 'wait' : 'pointer', padding: '6px', borderRadius: '8px',
                    opacity: previewLoadingId === file.id ? 0.5 : 1,
                  }}
                >
                  {previewLoadingId === file.id ? <Spinner size={14} /> : <EyeIcon />}
                </button>
              )}
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
        {visibleFiles.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted-fg)', fontSize: '14px' }}>
            {files.length === 0
              ? 'Nenhum arquivo enviado ainda. Envie contratos, orçamentos e outros documentos, ou arraste um arquivo aqui.'
              : categoryFilter === 'contrato'
                ? 'Nenhum contrato assinado enviado ainda.'
                : 'Nenhum arquivo geral enviado ainda.'}
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

      {/* Modal de visualização inline (imagem/PDF) */}
      <Modal open={previewFile !== null} onClose={closePreview} title={previewFile?.file_name} maxWidth="900px">
        {previewUrl && previewFile && (
          previewFile.mime_type?.startsWith('image/') ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed URL do Storage, expira em 60s, sem domínio fixo pra configurar no next/image
            <img
              src={previewUrl}
              alt={previewFile.file_name}
              style={{ display: 'block', maxWidth: '100%', maxHeight: '80vh', margin: '0 auto', borderRadius: '8px' }}
            />
          ) : (
            <iframe
              src={previewUrl}
              title={previewFile.file_name}
              style={{ width: '100%', height: '80vh', border: 'none', borderRadius: '8px' }}
            />
          )
        )}
      </Modal>
    </div>
  )
}
