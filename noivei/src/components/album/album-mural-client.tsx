'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

import LivePhotoGallery from '@/components/album/live-photo-gallery'
import Spinner from '@/components/ui/spinner'
import { toastError } from '@/store/toast.store'

const emptySubscribe = () => () => {}

interface AlbumMuralClientProps {
  slug:         string
  coupleNames:  string
  // yyyy-mm-dd (coluna DATE) ou null se o casal ainda não definiu a data —
  // só usada aqui pra formatar a mensagem "volte no dia X"; a decisão de
  // liberar ou não o formulário já vem pronta em isWeddingDay.
  weddingDate:  string | null
  // Calculado no server (ver src/lib/album/wedding-day.ts) a partir do fuso
  // America/Sao_Paulo — o client NUNCA recalcula isso sozinho. É só pra
  // decidir o que MOSTRAR; a validação de verdade é sempre no servidor em
  // cada POST (register/photos), então mesmo que este valor fique "stale"
  // numa aba aberta desde a véspera, o pior caso é a UI mostrar o formulário
  // e o POST devolver NOT_WEDDING_DAY.
  isWeddingDay: boolean
}

interface ApiErrorBody {
  error?: { message?: string }
}

// Mesmo teto do bucket "wedding-album-photos" — checagem no client é só pra
// feedback rápido (evita subir 4MB pra descobrir que passou do limite); a
// aplicação de verdade é sempre no servidor (ver /api/v1/album/[slug]/photos).
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

function sessionKey(slug: string): string {
  return `album:${slug}:contributor_id`
}

// Mesmo parser/formatter de portfolio-site.tsx pra data do casamento — evita
// depender de fuso ao montar o Date (ano/mês/dia explícitos, sem horário),
// já que wedding_date é uma coluna DATE pura (yyyy-mm-dd).
function formatWeddingDateLong(date: string | null): string | null {
  if (!date) return null
  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
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
function ArrowIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  )
}

export default function AlbumMuralClient({ slug, coupleNames, weddingDate, isWeddingDay }: AlbumMuralClientProps) {
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
  const storedContributorId = mounted ? sessionStorage.getItem(sessionKey(slug)) : null
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
  const formSectionRef = useRef<HTMLDivElement>(null)
  const nameInputRef    = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }
  }, [previewUrl])

  function handleHeroCta() {
    if (!isWeddingDay) {
      formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (activeContributorId) {
      inputRef.current?.click()
      return
    }
    formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    nameInputRef.current?.focus({ preventScroll: true })
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (registering) return
    setRegistering(true)

    const res = await fetch(`/api/v1/album/${slug}/register`, {
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
    sessionStorage.setItem(sessionKey(slug), data.contributor_id)
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

    const res = await fetch(`/api/v1/album/${slug}/photos`, { method: 'POST', body: formData })

    setUploading(false)
    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível enviar a foto. Tente novamente.'))
      return
    }

    setUploadedCount((prev) => prev + 1)
  }

  if (!mounted) {
    return (
      <div style={{ padding: '120px 36px', textAlign: 'center' }}>
        <Spinner size={22} color="var(--wedding-color)" />
      </div>
    )
  }

  return (
    <div>
      {/* Hero em tela cheia — mesma direção visual do template "portfolio" do site
          (fundo escuro derivado da cor do casal, título bold, CTA em pílula). */}
      <div
        className="relative overflow-hidden"
        style={{
          background: 'linear-gradient(150deg, var(--brand-dark-gradient-from), var(--brand-dark-gradient-to))',
          color: '#FAF0E6', padding: '72px 24px 56px', textAlign: 'center',
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(color-mix(in srgb, var(--wedding-color) 18%, transparent) 1.3px, transparent 1.5px)',
            backgroundSize: '26px 26px',
          }}
        />
        <div className="relative" style={{ maxWidth: '640px', margin: '0 auto' }}>
          <div style={{ fontSize: '11px', letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--wedding-color-light)', fontWeight: 700 }}>
            Mural de fotos
          </div>
          <h1
            className="font-display"
            style={{ fontWeight: 500, fontSize: 'clamp(38px,8vw,64px)', margin: '10px 0 0', lineHeight: 1.02 }}
          >
            {coupleNames}
          </h1>
          <p style={{ fontSize: '14.5px', color: 'rgba(250,240,230,0.72)', margin: '16px 0 0', lineHeight: 1.6 }}>
            Tire fotos no evento e envie aqui — todo mundo vê o mural crescer ao vivo.
          </p>

          <button
            type="button"
            onClick={handleHeroCta}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '10px',
              background: 'var(--wedding-color)', color: '#241708', border: 'none',
              borderRadius: '99px', padding: '14px 24px', fontWeight: 700, fontSize: '14.5px',
              cursor: 'pointer', marginTop: '28px',
              boxShadow: '0 10px 26px color-mix(in srgb, var(--wedding-color) 40%, transparent)',
            }}
          >
            {!isWeddingDay ? 'Saiba mais' : activeContributorId ? 'Enviar minha foto' : 'Quero participar'}
            <ArrowIcon />
          </button>
        </div>
      </div>

      {/* Formulário de cadastro / envio de foto — só existe NO dia do
          casamento; fora dele, nem quem já tinha se cadastrado num dia
          anterior (contributor_id sobrevive no sessionStorage) consegue ver
          o formulário de upload de novo. */}
      <div ref={formSectionRef} style={{ maxWidth: '480px', margin: '0 auto', padding: '40px 24px 8px' }}>
        {!isWeddingDay ? (
          <div
            className="flex flex-col items-center gap-3"
            style={{ padding: '40px 24px', background: 'var(--wedding-color-subtle)', textAlign: 'center', borderRadius: '20px' }}
          >
            <div style={{ fontSize: '32px' }}>📅</div>
            <p style={{ fontSize: '14.5px', color: 'var(--fg)', margin: 0, lineHeight: 1.6, fontWeight: 600 }}>
              {formatWeddingDateLong(weddingDate)
                ? `O mural abre no dia do casamento — ${formatWeddingDateLong(weddingDate)}. Volte nesse dia pra postar suas fotos!`
                : 'O mural ainda não está disponível — o casal não definiu a data do casamento.'}
            </p>
          </div>
        ) : !activeContributorId ? (
          <>
            <p style={{ fontSize: '14.5px', color: 'var(--muted-fg)', margin: '0 0 22px', lineHeight: 1.6, textAlign: 'center' }}>
              Se cadastre rapidinho pra poder enviar as fotos que você tirar no evento.
            </p>
            <form onSubmit={handleRegister} className="flex flex-col gap-4">
              <div>
                <label htmlFor="name" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--fg)', marginBottom: '6px' }}>
                  Seu nome
                </label>
                <input
                  id="name"
                  ref={nameInputRef}
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
            <p style={{ fontSize: '14.5px', color: 'var(--muted-fg)', margin: '0 0 22px', lineHeight: 1.6, textAlign: 'center' }}>
              Tire uma foto ou escolha uma da galeria pra enviar pro casal.
            </p>

            <div
              className="flex flex-col items-center gap-3"
              style={{ padding: '32px 20px', background: 'var(--wedding-color-subtle)', textAlign: 'center', borderRadius: '20px' }}
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
                  borderRadius: '99px', padding: '13px 22px', fontWeight: 700, fontSize: '14.5px',
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
      </div>

      {/* Galeria ao vivo — todas as fotos já enviadas por qualquer convidado deste
          casamento, não só as do visitante atual. */}
      <div style={{ maxWidth: '1180px', margin: '48px auto 0', padding: '0 4px' }}>
        <div style={{ padding: '0 20px 16px', textAlign: 'center' }}>
          <h2 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(22px,3.6vw,30px)', color: 'var(--fg)', margin: 0 }}>
            Mural ao vivo
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--muted-fg)', marginTop: '4px' }}>
            Todas as fotos enviadas pelos convidados até agora
          </p>
        </div>
        <LivePhotoGallery
          slug={slug}
          emptyTitle="O mural ainda está vazio"
          emptyMessage="Assim que os convidados começarem a enviar fotos, elas aparecem aqui."
        />
      </div>

      <p style={{ fontSize: '12px', color: 'var(--muted-fg)', margin: '32px 0 40px', textAlign: 'center' }}>
        Feito com <span style={{ color: 'var(--wedding-color)' }}>♥</span> no Wednest
      </p>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: '10px',
  border: '1.5px solid #EBDDD0', fontSize: '14px', color: 'var(--fg)',
  background: 'var(--surface)',
}
