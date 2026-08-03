'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

import Spinner from '@/components/ui/spinner'
import { toastError } from '@/store/toast.store'

const emptySubscribe = () => () => {}

interface AlbumMuralClientProps {
  token:       string
  coupleNames: string
}

interface ApiErrorBody {
  error?: { message?: string }
}

// Mesmo teto do bucket "wedding-album-photos" — checagem no client é só pra
// feedback rápido (evita subir 4MB pra descobrir que passou do limite); a
// aplicação de verdade é sempre no servidor (ver /api/v1/album/[token]/photos).
const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/heic']

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as ApiErrorBody
    return body.error?.message ?? fallback
  } catch {
    return fallback
  }
}

function sessionKey(token: string): string {
  return `album:${token}:contributor_id`
}

function CameraIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}
function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export default function AlbumMuralClient({ token, coupleNames }: AlbumMuralClientProps) {
  // sessionStorage só existe no client — usar useSyncExternalStore (não um
  // useEffect com setState) evita tanto o mismatch de hidratação quanto o lint
  // de "setState síncrono dentro de efeito" (mesmo padrão de appearance-settings.tsx
  // pro tema do next-themes).
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false)

  // Preenchido só quando o cadastro acabou de ser concluído NESTA sessão de
  // component (ver handleRegister) — sem isso, o contributor_id restaurado do
  // sessionStorage (abaixo) teria prioridade e nunca mostraria o formulário
  // de novo mesmo depois de registrar.
  const [contributorId, setContributorId] = useState<string | null>(null)
  const storedContributorId = mounted ? sessionStorage.getItem(sessionKey(token)) : null
  const activeContributorId = contributorId ?? storedContributorId

  // Formulário de cadastro
  const [name, setName]                 = useState('')
  const [relationship, setRelationship] = useState('')
  const [phone, setPhone]               = useState('')
  const [registering, setRegistering]   = useState(false)

  // Upload
  const [uploading, setUploading]         = useState(false)
  const [uploadedCount, setUploadedCount] = useState(0)
  const [previewUrl, setPreviewUrl]       = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }
  }, [previewUrl])

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (registering) return
    setRegistering(true)

    const res = await fetch(`/api/v1/album/${token}/register`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, relationship, phone }),
    })

    setRegistering(false)
    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível concluir o cadastro.'))
      return
    }

    const { data } = (await res.json()) as { data: { contributor_id: string } }
    sessionStorage.setItem(sessionKey(token), data.contributor_id)
    setContributorId(data.contributor_id)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !activeContributorId) return

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      toastError('Envie apenas fotos (PNG, JPEG, WEBP ou HEIC).')
      return
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toastError('A foto deve ter no máximo 4 MB.')
      return
    }

    void uploadFile(file)
  }

  async function uploadFile(file: File) {
    setUploading(true)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(file))

    const formData = new FormData()
    formData.append('file', file)
    formData.append('contributor_id', activeContributorId as string)

    const res = await fetch(`/api/v1/album/${token}/photos`, { method: 'POST', body: formData })

    setUploading(false)
    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível enviar a foto. Tente novamente.'))
      return
    }

    setUploadedCount((prev) => prev + 1)
  }

  if (!mounted) {
    return (
      <div style={{ padding: '60px 36px', textAlign: 'center' }}>
        <Spinner size={22} color="var(--wedding-color)" />
      </div>
    )
  }

  return (
    <div>
      {/* Cabeçalho decorativo */}
      <div
        className="relative overflow-hidden"
        style={{
          background: 'linear-gradient(150deg, var(--brand-dark-gradient-from), var(--brand-dark-gradient-to))',
          color: '#FAF0E6', padding: '38px 36px', textAlign: 'center',
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(color-mix(in srgb, var(--wedding-color) 18%, transparent) 1.3px, transparent 1.5px)',
            backgroundSize: '26px 26px',
          }}
        />
        <div className="relative">
          <div style={{ fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--wedding-color-light)' }}>
            Mural de fotos
          </div>
          <h1
            className="font-display"
            style={{ fontWeight: 500, fontSize: 'clamp(28px,6vw,36px)', margin: '6px 0 0', lineHeight: 1.1 }}
          >
            {coupleNames}
          </h1>
        </div>
      </div>

      {/* Corpo */}
      <div style={{ padding: '34px 36px 38px' }}>
        {!activeContributorId ? (
          <>
            <p style={{ fontSize: '14.5px', color: 'var(--muted-fg)', margin: '0 0 22px', lineHeight: 1.6 }}>
              Se cadastre rapidinho pra poder enviar as fotos que você tirar no evento.
            </p>
            <form onSubmit={handleRegister} className="flex flex-col gap-4">
              <div>
                <label htmlFor="name" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--fg)', marginBottom: '6px' }}>
                  Seu nome
                </label>
                <input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={120}
                  style={inputStyle}
                />
              </div>
              <div>
                <label htmlFor="relationship" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--fg)', marginBottom: '6px' }}>
                  Sua relação com o casal
                </label>
                <input
                  id="relationship"
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  placeholder="Ex: amiga da noiva, primo do noivo…"
                  required
                  maxLength={120}
                  style={inputStyle}
                />
              </div>
              <div>
                <label htmlFor="phone" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--fg)', marginBottom: '6px' }}>
                  Seu telefone
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  required
                  maxLength={20}
                  style={inputStyle}
                />
              </div>
              <button
                type="submit"
                disabled={registering}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  background: 'var(--wedding-color)', color: '#fff', border: 'none',
                  borderRadius: '12px', padding: '13px', fontWeight: 700, fontSize: '14.5px',
                  cursor: registering ? 'wait' : 'pointer', opacity: registering ? 0.7 : 1, marginTop: '4px',
                }}
              >
                {registering && <Spinner size={15} color="#fff" />}
                {registering ? 'Cadastrando…' : 'Continuar'}
              </button>
            </form>
          </>
        ) : (
          <>
            <p style={{ fontSize: '14.5px', color: 'var(--muted-fg)', margin: '0 0 22px', lineHeight: 1.6 }}>
              Tire uma foto ou escolha uma da galeria pra enviar pro casal.
            </p>

            <div
              className="flex flex-col items-center gap-3 rounded-2xl"
              style={{ padding: '32px 20px', background: 'var(--wedding-color-subtle)', textAlign: 'center' }}
            >
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- preview local (object URL), nunca enviado a nenhum domínio
                <img src={previewUrl} alt="Prévia da foto selecionada" style={{ width: '96px', height: '96px', objectFit: 'cover', borderRadius: '14px' }} />
              ) : (
                <div style={{ color: 'var(--wedding-color-dark)' }}>
                  <CameraIcon />
                </div>
              )}

              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  background: 'var(--wedding-color)', color: '#fff', border: 'none',
                  borderRadius: '12px', padding: '13px 22px', fontWeight: 700, fontSize: '14.5px',
                  cursor: uploading ? 'wait' : 'pointer', opacity: uploading ? 0.7 : 1,
                }}
              >
                {uploading && <Spinner size={15} color="#fff" />}
                {uploading ? 'Enviando…' : 'Enviar foto'}
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />

              {uploadedCount > 0 && (
                <div
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    color: 'var(--wedding-color-dark)', fontSize: '13.5px', fontWeight: 600, marginTop: '4px',
                  }}
                >
                  <CheckIcon /> {uploadedCount} {uploadedCount === 1 ? 'foto enviada' : 'fotos enviadas'} por você
                </div>
              )}
            </div>
          </>
        )}

        <p style={{ fontSize: '12px', color: 'var(--muted-fg)', marginTop: '26px', textAlign: 'center' }}>
          Feito com <span style={{ color: 'var(--wedding-color)' }}>♥</span> no Wednest
        </p>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: '10px',
  border: '1.5px solid #EBDDD0', fontSize: '14px', color: 'var(--fg)',
  background: 'var(--surface)',
}
