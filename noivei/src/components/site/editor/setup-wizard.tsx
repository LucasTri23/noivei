'use client'

/* eslint-disable @next/next/no-img-element -- URL do Storage, sem domínio fixo para configurar no next/image */
import { useCallback, useRef, useState } from 'react'

import { ArrowLeftIcon, CheckIcon, TrashIcon, UploadIcon } from '@/components/site/editor/icons'
import SlugField from '@/components/site/editor/slug-field'
import { ghostButtonStyle, hintStyle, primaryButtonStyle, secondaryButtonStyle } from '@/components/site/editor/styles'
import { TemplatePicker } from '@/components/site/editor/template-picker'
import Spinner from '@/components/ui/spinner'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { deleteSitePhoto, readApiError, uploadSitePhoto } from '@/lib/site/editor-photo-api'
import { finalizeSiteSlug, suggestSiteSlug } from '@/lib/site/slug'
import type { PlanId } from '@/constants/plans'
import { toastError, toastSuccess } from '@/store/toast.store'
import type { SiteConfig, SiteTemplate } from '@/types/database'

const STEPS = ['Estilo', 'Foto de capa', 'Endereço'] as const

interface SetupWizardProps {
  weddingId:   string
  coupleNames: string
  planId:      PlanId
  origin:      string
  onCreated:   (site: SiteConfig) => void
  onStorageDelta: (bytes: number) => void
}

/**
 * Primeiro acesso ao editor: três passos curtos (estilo → foto → endereço) e o site
 * já nasce criado, com o endereço sugerido a partir do nome do casal. Depois disso
 * nenhuma aba do editor fica bloqueada.
 */
export default function SetupWizard({ weddingId, coupleNames, planId, origin, onCreated, onStorageDelta }: SetupWizardProps) {
  const [step, setStep] = useState(0)
  const [template, setTemplate] = useState<SiteTemplate>('classic')
  const [cover, setCover] = useState<{ url: string; size: number } | null>(null)
  const [slug, setSlug] = useState(() => suggestSiteSlug(coupleNames))
  const [slugValid, setSlugValid] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [creating, setCreating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const showUploadSpinner = useDelayedLoading(uploading)
  const showCreatingSpinner = useDelayedLoading(creating)
  const handleValidity = useCallback((valid: boolean) => setSlugValid(valid), [])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || uploading) return
    setUploading(true)
    const uploaded = await uploadSitePhoto(weddingId, file)
    setUploading(false)
    if (!uploaded) return
    onStorageDelta(uploaded.size_bytes)
    if (cover) void removeCover()
    setCover({ url: uploaded.public_url, size: uploaded.size_bytes })
  }

  async function removeCover() {
    if (!cover) return
    const previous = cover
    setCover(null)
    if (await deleteSitePhoto(weddingId, previous.url)) onStorageDelta(-previous.size)
  }

  async function create() {
    setCreating(true)
    const res = await fetch(`/api/v1/weddings/${weddingId}/site`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ slug: finalizeSiteSlug(slug), template, cover_photo_url: cover?.url ?? null }),
    })
    setCreating(false)
    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível criar o site. Tente novamente.'))
      return
    }
    const { data } = (await res.json()) as { data: SiteConfig }
    toastSuccess('Site criado! Agora é só completar as seções.')
    onCreated(data)
  }

  return (
    <div className="rounded-2xl" style={{ background: 'var(--surface)', boxShadow: '0 10px 28px rgba(60,40,24,0.10)', padding: 'clamp(18px, 4vw, 32px)', maxWidth: '760px', margin: '0 auto' }}>
      <p style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--wedding-color-dark)', margin: 0 }}>
        Criar o site · passo {step + 1} de {STEPS.length}
      </p>
      <ol aria-label="Etapas" style={{ display: 'flex', gap: '6px', listStyle: 'none', padding: 0, margin: '10px 0 20px' }}>
        {STEPS.map((label, index) => (
          <li key={label} aria-current={index === step ? 'step' : undefined} style={{ flex: 1 }}>
            <span aria-hidden style={{ display: 'block', height: '4px', borderRadius: '99px', background: index <= step ? 'var(--wedding-color)' : 'var(--border)' }} />
            <span style={{ display: 'block', fontSize: '12px', marginTop: '6px', fontWeight: index === step ? 700 : 500, color: index === step ? 'var(--fg)' : 'var(--muted-fg)' }}>{label}</span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-display" style={{ fontSize: '28px', fontWeight: 500, margin: 0, color: 'var(--fg)' }}>Como vocês imaginam o site?</h2>
          <p style={{ ...hintStyle, marginTop: 0 }}>Escolham um estilo. Dá para trocar a qualquer momento, sem perder nada.</p>
          <TemplatePicker value={template} planId={planId} onChange={setTemplate} />
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-display" style={{ fontSize: '28px', fontWeight: 500, margin: 0, color: 'var(--fg)' }}>Uma foto para a capa</h2>
          <p style={{ ...hintStyle, marginTop: 0 }}>É a primeira coisa que os convidados veem. Uma foto na horizontal fica melhor — vocês podem ajustar o enquadramento depois.</p>
          {cover ? (
            <div className="relative overflow-hidden rounded-2xl" style={{ border: '1.5px solid var(--border)' }}>
              <img src={cover.url} alt="Foto de capa" style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', display: 'block' }} />
              <button type="button" onClick={removeCover} aria-label="Remover foto" style={{ position: 'absolute', top: '10px', right: '10px', ...ghostButtonStyle, border: 'none', background: 'rgba(20,12,4,0.6)', color: '#fff' }}>
                <TrashIcon />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%',
                aspectRatio: '16 / 9', maxHeight: '320px', borderRadius: '16px', border: '1.5px dashed var(--border)', background: 'var(--muted)',
                color: 'var(--wedding-color-dark)', fontWeight: 600, fontSize: '15px', cursor: uploading ? 'wait' : 'pointer',
              }}
            >
              {showUploadSpinner ? <Spinner color="var(--wedding-color-dark)" /> : <UploadIcon size={26} />}
              {uploading ? 'Enviando…' : 'Escolher foto'}
            </button>
          )}
          <input ref={inputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-display" style={{ fontSize: '28px', fontWeight: 500, margin: 0, color: 'var(--fg)' }}>O endereço do site</h2>
          <p style={{ ...hintStyle, marginTop: 0 }}>Sugerimos um a partir do nome de vocês. O site começa como rascunho — só vocês veem até publicar.</p>
          <SlugField weddingId={weddingId} value={slug} savedSlug={null} origin={origin} onChange={setSlug} onValidityChange={handleValidity} id="site-wizard-slug" />
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', marginTop: '24px' }}>
        {step > 0 && (
          <button type="button" onClick={() => setStep((s) => s - 1)} style={{ ...ghostButtonStyle, minHeight: '42px', padding: '0 14px', fontSize: '14px' }}>
            <ArrowLeftIcon /> Voltar
          </button>
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
          {step === 1 && !cover && (
            <button type="button" onClick={() => setStep(2)} disabled={uploading} style={secondaryButtonStyle}>Pular por enquanto</button>
          )}
          {step < 2 ? (
            <button type="button" onClick={() => setStep((s) => s + 1)} disabled={uploading} style={{ ...primaryButtonStyle, opacity: uploading ? 0.6 : 1 }}>
              Continuar
            </button>
          ) : (
            <button type="button" onClick={create} disabled={creating || !slugValid} style={{ ...primaryButtonStyle, opacity: creating || !slugValid ? 0.6 : 1, cursor: creating ? 'wait' : !slugValid ? 'not-allowed' : 'pointer' }}>
              {showCreatingSpinner ? <Spinner color="#fff" /> : <CheckIcon />} Criar meu site
            </button>
          )}
        </span>
      </div>
    </div>
  )
}
