'use client'

import { isCnpj } from '@/lib/vendor/cnpj'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { NextButton, StepTitle } from '@/components/checklist/questionnaire-wizard'
import { sanitizeFileName } from '@/lib/files/upload-wedding-file'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { toastError, toastSuccess } from '@/store/toast.store'
import type { VendorCategory, VendorPortfolioItem, VendorProfile } from '@/types/database'

// Wizard de cadastro do fornecedor (/fornecedor/cadastro) — 4 passos num único
// useState<number>, mesmo padrão de src/app/(auth)/onboarding/page.tsx. Reaproveita
// StepTitle/NextButton de questionnaire-wizard em vez de inventar componentes novos.
const TOTAL_STEPS = 4
const STEP_EMPRESA    = 0
const STEP_CATEGORIA  = 1
const STEP_PORTFOLIO  = 2
const STEP_REVISAO    = 3

const PRICE_RANGE_OPTS = ['$', '$$', '$$$'] as const
type PriceRange = (typeof PRICE_RANGE_OPTS)[number] | ''

interface EmpresaFormData {
  business_name: string
  cnpj:          string
  phone:         string
  whatsapp:      string
  show_whatsapp: boolean
  instagram:     string
  website:       string
  city:          string
  state:         string
  description:   string
  price_range:   PriceRange
}

interface VendorOnboardingWizardProps {
  initialProfile:        VendorProfile | null
  initialCategoryIds:    string[]
  initialPortfolioItems: VendorPortfolioItem[]
  categories:             VendorCategory[]
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

// Retoma o wizard no passo certo pra quem já tem um rascunho: perfil sem categoria
// nenhuma volta pro Passo 2; com categoria (mas sem ter necessariamente terminado o
// portfólio, que é opcional) volta pro Passo 3, de onde dá pra avançar/pular direto
// pra revisão. Sem perfil nenhum, começa do zero no Passo 1.
function computeStartStep(profile: VendorProfile | null, categoryIds: string[]): number {
  if (!profile) return STEP_EMPRESA
  if (categoryIds.length === 0) return STEP_CATEGORIA
  return STEP_PORTFOLIO
}

const inputStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '12px',
  border: '1.5px solid #EBDDD0', borderRadius: '12px', padding: '13px 15px',
  background: 'var(--surface)',
}
const labelStyle: React.CSSProperties = {
  fontSize: '13px', fontWeight: 600, color: 'var(--fg)', marginBottom: '8px', display: 'block',
}
const errorTextStyle: React.CSSProperties = {
  fontSize: '12px', color: '#C0553F', margin: '6px 0 0',
}

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
    </svg>
  )
}

export default function VendorOnboardingWizard({
  initialProfile, initialCategoryIds, initialPortfolioItems, categories,
}: VendorOnboardingWizardProps) {
  const router = useRouter()
  const [vendorId, setVendorId] = useState<string | null>(initialProfile?.id ?? null)
  const [step, setStep] = useState(() => computeStartStep(initialProfile, initialCategoryIds))
  const [savingEmpresa, setSavingEmpresa] = useState(false)
  const [submitting, setSubmitting]       = useState(false)

  const [empresa, setEmpresa] = useState<EmpresaFormData>({
    business_name: initialProfile?.business_name ?? '',
    cnpj:          initialProfile?.cnpj ?? '',
    phone:         initialProfile?.phone ?? '',
    whatsapp:      initialProfile?.whatsapp ?? '',
    show_whatsapp: initialProfile?.show_whatsapp ?? true,
    instagram:     initialProfile?.instagram ?? '',
    website:       initialProfile?.website ?? '',
    city:          initialProfile?.city ?? '',
    state:         initialProfile?.state ?? '',
    description:   initialProfile?.description ?? '',
    price_range:   (initialProfile?.price_range as PriceRange) ?? '',
  })
  const [businessNameError, setBusinessNameError] = useState<string | null>(null)

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(initialCategoryIds)
  const [categoriesError, setCategoriesError]         = useState<string | null>(null)

  const [portfolioItems, setPortfolioItems] = useState<VendorPortfolioItem[]>(initialPortfolioItems)
  const [uploading, setUploading]           = useState(false)
  const [signedUrls, setSignedUrls]         = useState<Record<string, string>>({})

  // Miniaturas do portfólio: bucket é privado (ver migration 20260806000005), então
  // a pré-visualização precisa de signed URL. A policy de SELECT já libera o dono
  // direto no client — sem precisar de rota de servidor só pra isso.
  useEffect(() => {
    if (portfolioItems.length === 0) return
    let cancelled = false
    const supabase = createSupabaseBrowser()

    Promise.all(
      portfolioItems.map(async (item) => {
        const { data } = await supabase.storage.from('vendor-portfolio').createSignedUrl(item.storage_path, 3600)
        return [item.id, data?.signedUrl ?? null] as const
      }),
    ).then((entries) => {
      if (cancelled) return
      setSignedUrls(Object.fromEntries(entries.filter((entry): entry is [string, string] => entry[1] !== null)))
    })

    return () => { cancelled = true }
  }, [portfolioItems])

  function setField<K extends keyof EmpresaFormData>(key: K, value: EmpresaFormData[K]) {
    setEmpresa((d) => ({ ...d, [key]: value }))
  }

  async function handleEmpresaNext() {
    if (empresa.business_name.trim().length < 2) {
      setBusinessNameError('Informe o nome da sua empresa.')
      return
    }
    if (!isCnpj(empresa.cnpj)) {
      toastError('Informe o CNPJ da empresa com 14 caracteres.')
      return
    }
    setBusinessNameError(null)
    setSavingEmpresa(true)

    const payload = {
      business_name: empresa.business_name.trim(),
      cnpj:          empresa.cnpj.trim(),
      phone:         empresa.phone.trim() || undefined,
      whatsapp:      empresa.whatsapp.trim() || undefined,
      show_whatsapp: empresa.show_whatsapp,
      instagram:     empresa.instagram.trim() || undefined,
      website:       empresa.website.trim() || undefined,
      city:          empresa.city.trim() || undefined,
      state:         empresa.state.trim() || undefined,
      description:   empresa.description.trim() || undefined,
      price_range:   empresa.price_range || undefined,
    }

    const res = await fetch('/api/v1/vendor/profile', {
      method:  vendorId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
    setSavingEmpresa(false)

    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível salvar os dados da empresa.'))
      return
    }

    if (!vendorId) {
      const body = (await res.json()) as { data: VendorProfile }
      setVendorId(body.data.id)
    }

    setStep(STEP_CATEGORIA)
  }

  // Cada toggle de categoria já persiste na hora (POST/DELETE), em vez de acumular
  // mudanças pra salvar só no "Continuar" — assim um abandono no meio do Passo 2
  // não perde nada nem exige recalcular um diff contra o estado inicial ao retomar.
  async function toggleCategory(categoryId: string) {
    const wasSelected = selectedCategoryIds.includes(categoryId)
    setSelectedCategoryIds((prev) =>
      wasSelected ? prev.filter((id) => id !== categoryId) : [...prev, categoryId],
    )
    setCategoriesError(null)

    const res = wasSelected
      ? await fetch(`/api/v1/vendor/categories/${categoryId}`, { method: 'DELETE' })
      : await fetch('/api/v1/vendor/categories', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ category_id: categoryId }),
        })

    if (!res.ok) {
      // Reverte a UI otimista e avisa
      setSelectedCategoryIds((prev) =>
        wasSelected ? [...prev, categoryId] : prev.filter((id) => id !== categoryId),
      )
      toastError(await readApiError(res, 'Não foi possível atualizar as categorias.'))
    }
  }

  function handleCategoriaNext() {
    if (selectedCategoryIds.length === 0) {
      setCategoriesError('Selecione ao menos uma categoria.')
      return
    }
    setStep(STEP_PORTFOLIO)
  }

  async function handleFileUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !vendorId) return
    setUploading(true)
    const supabase = createSupabaseBrowser()

    for (const file of Array.from(fileList)) {
      const path = `${vendorId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`
      const { error: uploadError } = await supabase.storage.from('vendor-portfolio').upload(path, file)

      if (uploadError) {
        toastError(`Não foi possível enviar "${file.name}". Verifique o tamanho (máx. 10 MB) e o formato (JPG, PNG, WEBP ou HEIC).`)
        continue
      }

      const res = await fetch('/api/v1/vendor/portfolio', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ storage_path: path, sort_order: portfolioItems.length }),
      })

      if (!res.ok) {
        // O upload já subiu pro storage; sem o registro de metadados ele fica órfão — remove.
        await supabase.storage.from('vendor-portfolio').remove([path])
        toastError(`"${file.name}": ${await readApiError(res, 'Não foi possível salvar a foto.')}`)
        continue
      }

      const body = (await res.json()) as { data: VendorPortfolioItem }
      setPortfolioItems((prev) => [...prev, body.data])
    }

    setUploading(false)
  }

  async function handleRemovePortfolioItem(id: string) {
    const res = await fetch(`/api/v1/vendor/portfolio/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível remover a foto.'))
      return
    }
    setPortfolioItems((prev) => prev.filter((item) => item.id !== id))
  }

  async function handleSubmitForReview() {
    setSubmitting(true)
    const res = await fetch('/api/v1/vendor/submit-for-review', { method: 'POST' })
    setSubmitting(false)

    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível enviar seu cadastro para análise.'))
      return
    }

    toastSuccess('Cadastro enviado para análise!')
    router.push('/fornecedor')
  }

  const progressPct = ((step + 1) / TOTAL_STEPS) * 100
  const selectedCategories = categories.filter((cat) => selectedCategoryIds.includes(cat.id))

  return (
    <div>
      <div className="mb-6">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--wedding-color-dark)' }}>
            Passo {step + 1} de {TOTAL_STEPS}
          </span>
        </div>
        <div style={{ height: '4px', borderRadius: '99px', background: '#EBDDD0', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%', borderRadius: '99px',
              background: 'linear-gradient(90deg, var(--wedding-color-light), var(--wedding-color-dark))',
              width: `${progressPct}%`,
              transition: 'width 0.35s ease',
            }}
          />
        </div>
      </div>

      {step > STEP_EMPRESA && (
        <button
          onClick={() => setStep((s) => s - 1)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            fontSize: '13.5px', color: 'var(--muted-fg)', border: 'none',
            background: 'none', cursor: 'pointer', marginBottom: '14px', padding: 0,
          }}
        >
          <BackIcon /> Voltar
        </button>
      )}

      {/* ── Passo 1: Empresa ── */}
      {step === STEP_EMPRESA && (
        <div>
          <StepTitle title="Fale sobre sua empresa" subtitle="Essas informações aparecem no seu perfil público quando aprovado." />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginBottom: '24px' }}>
            <div>
              <label htmlFor="vendor-business-name" style={labelStyle}>Nome da empresa *</label>
              <div style={{ ...inputStyle, ...(businessNameError ? { borderColor: '#C0553F' } : {}) }}>
                <input
                  id="vendor-business-name"
                  value={empresa.business_name}
                  onChange={(e) => { setField('business_name', e.target.value); if (businessNameError) setBusinessNameError(null) }}
                  placeholder="Ex: Studio Amor Fotografia"
                  aria-invalid={businessNameError !== null}
                  style={{ border: 'none', outline: 'none', fontSize: '15px', color: 'var(--fg)', width: '100%', background: 'transparent' }}
                />
              </div>
              {businessNameError && <p role="alert" style={errorTextStyle}>{businessNameError}</p>}
            </div>

            <div>
              <label htmlFor="vendor-description" style={labelStyle}>Descrição</label>
              <textarea
                id="vendor-description"
                value={empresa.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="Conte o que sua empresa faz e o que a torna especial."
                rows={4}
                maxLength={2000}
                style={{ ...inputStyle, resize: 'vertical', fontSize: '14.5px', color: 'var(--fg)', width: '100%', fontFamily: 'inherit' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label htmlFor="vendor-city" style={labelStyle}>Cidade</label>
                <div style={inputStyle}>
                  <input id="vendor-city" value={empresa.city} onChange={(e) => setField('city', e.target.value)} placeholder="Ex: São Paulo"
                    style={{ border: 'none', outline: 'none', fontSize: '15px', color: 'var(--fg)', width: '100%', background: 'transparent' }} />
                </div>
              </div>
              <div style={{ flex: '0 1 120px' }}>
                <label htmlFor="vendor-state" style={labelStyle}>Estado</label>
                <div style={inputStyle}>
                  <input id="vendor-state" value={empresa.state} onChange={(e) => setField('state', e.target.value)} placeholder="Ex: SP"
                    style={{ border: 'none', outline: 'none', fontSize: '15px', color: 'var(--fg)', width: '100%', background: 'transparent' }} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label htmlFor="vendor-phone" style={labelStyle}>Telefone</label>
                <div style={inputStyle}>
                  <input id="vendor-phone" value={empresa.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="(11) 99999-9999"
                    style={{ border: 'none', outline: 'none', fontSize: '15px', color: 'var(--fg)', width: '100%', background: 'transparent' }} />
                </div>
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <label htmlFor="vendor-whatsapp" style={labelStyle}>WhatsApp</label>
                <div style={inputStyle}>
                  <input id="vendor-whatsapp" value={empresa.whatsapp} onChange={(e) => setField('whatsapp', e.target.value)} placeholder="(11) 99999-9999"
                    style={{ border: 'none', outline: 'none', fontSize: '15px', color: 'var(--fg)', width: '100%', background: 'transparent' }} />
                </div>
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', color: 'var(--fg)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={empresa.show_whatsapp}
                onChange={(e) => setField('show_whatsapp', e.target.checked)}
                style={{ accentColor: 'var(--wedding-color)', width: '16px', height: '16px' }}
              />
              Mostrar WhatsApp no meu perfil público
            </label>

            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label htmlFor="vendor-instagram" style={labelStyle}>Instagram</label>
                <div style={inputStyle}>
                  <input id="vendor-instagram" value={empresa.instagram} onChange={(e) => setField('instagram', e.target.value)} placeholder="@suaempresa"
                    style={{ border: 'none', outline: 'none', fontSize: '15px', color: 'var(--fg)', width: '100%', background: 'transparent' }} />
                </div>
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <label htmlFor="vendor-website" style={labelStyle}>Site</label>
                <div style={inputStyle}>
                  <input id="vendor-website" value={empresa.website} onChange={(e) => setField('website', e.target.value)} placeholder="www.suaempresa.com.br"
                    style={{ border: 'none', outline: 'none', fontSize: '15px', color: 'var(--fg)', width: '100%', background: 'transparent' }} />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="vendor-cnpj" style={labelStyle}>CNPJ *</label>
              <div style={inputStyle}>
                <input id="vendor-cnpj" required aria-required="true" value={empresa.cnpj} onChange={(e) => setField('cnpj', e.target.value)} placeholder="00.000.000/0000-00"
                  style={{ border: 'none', outline: 'none', fontSize: '15px', color: 'var(--fg)', width: '100%', background: 'transparent' }} />
              </div>
            </div>

            <div>
              <span style={labelStyle}>Faixa de preço</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {PRICE_RANGE_OPTS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setField('price_range', empresa.price_range === opt ? '' : opt)}
                    style={{
                      padding: '10px 18px', borderRadius: '12px',
                      border: `1.5px solid ${empresa.price_range === opt ? 'var(--wedding-color)' : '#EBDDD0'}`,
                      background: empresa.price_range === opt ? 'var(--wedding-color-subtle)' : 'var(--surface)',
                      color: empresa.price_range === opt ? 'var(--wedding-color-dark)' : 'var(--muted-fg)',
                      fontWeight: empresa.price_range === opt ? 700 : 500, fontSize: '14px', cursor: 'pointer',
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <NextButton onClick={handleEmpresaNext} disabled={savingEmpresa} label={savingEmpresa ? 'Salvando…' : 'Continuar'} />
        </div>
      )}

      {/* ── Passo 2: Categoria ── */}
      {step === STEP_CATEGORIA && (
        <div>
          <StepTitle title="Em quais categorias você atua?" subtitle="Selecione ao menos uma — pode marcar mais de uma." />

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
            {categories.map((cat) => {
              const active = selectedCategoryIds.includes(cat.id)
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  style={{
                    padding: '10px 14px', borderRadius: '12px',
                    border: `1.5px solid ${active ? 'var(--wedding-color)' : '#EBDDD0'}`,
                    background: active ? 'var(--wedding-color-subtle)' : 'var(--surface)',
                    color: active ? 'var(--wedding-color-dark)' : 'var(--muted-fg)',
                    fontWeight: active ? 700 : 500, fontSize: '13.5px', cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  {cat.label}
                </button>
              )
            })}
          </div>
          {categoriesError && <p role="alert" style={{ ...errorTextStyle, marginBottom: '14px' }}>{categoriesError}</p>}

          <div style={{ marginTop: '24px' }}>
            <NextButton onClick={handleCategoriaNext} label="Continuar" />
          </div>
        </div>
      )}

      {/* ── Passo 3: Portfólio (opcional) ── */}
      {step === STEP_PORTFOLIO && (
        <div>
          <StepTitle title="Mostre seu trabalho" subtitle="Envie fotos do seu portfólio — opcional, você pode adicionar depois." />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '10px', marginBottom: '18px' }}>
            {portfolioItems.map((item) => (
              <div key={item.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: '12px', overflow: 'hidden', background: '#EBDDD0' }}>
                {signedUrls[item.id] && (
                  // eslint-disable-next-line @next/next/no-img-element -- signed URL temporária, next/image não ganha nada aqui
                  <img src={signedUrls[item.id]} alt={item.caption ?? 'Foto do portfólio'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
                <button
                  type="button"
                  onClick={() => handleRemovePortfolioItem(item.id)}
                  aria-label="Remover foto"
                  style={{
                    position: 'absolute', top: '6px', right: '6px', width: '24px', height: '24px', borderRadius: '999px',
                    border: 'none', background: 'rgba(0,0,0,0.55)', color: '#fff', cursor: 'pointer', fontSize: '14px', lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <label
            htmlFor="vendor-portfolio-upload"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1.5px dashed #EBDDD0', borderRadius: '12px', padding: '22px',
              color: 'var(--muted-fg)', fontSize: '13.5px', cursor: uploading ? 'not-allowed' : 'pointer',
              marginBottom: '24px', opacity: uploading ? 0.6 : 1,
            }}
          >
            {uploading ? 'Enviando…' : 'Clique para enviar fotos (JPG, PNG, WEBP ou HEIC, máx. 10 MB cada)'}
            <input
              id="vendor-portfolio-upload"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/heic"
              multiple
              disabled={uploading}
              onChange={(e) => { void handleFileUpload(e.target.files); e.target.value = '' }}
              style={{ display: 'none' }}
            />
          </label>

          <NextButton onClick={() => setStep(STEP_REVISAO)} label="Continuar" disabled={uploading} />
        </div>
      )}

      {/* ── Passo 4: Revisão ── */}
      {step === STEP_REVISAO && (
        <div>
          <StepTitle title="Revise sua solicitação" subtitle="Confira os dados antes de enviar para análise." />

          <div style={{ background: 'var(--surface)', border: '1px solid #EBDDD0', borderRadius: '16px', padding: '18px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted-fg)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Empresa</span>
              <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--fg)', margin: '2px 0' }}>{empresa.business_name}</p>
              {empresa.city && <p style={{ fontSize: '13.5px', color: 'var(--muted-fg)', margin: 0 }}>{empresa.city}{empresa.state ? ` - ${empresa.state}` : ''}</p>}
            </div>

            <div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted-fg)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Categorias</span>
              <p style={{ fontSize: '13.5px', color: 'var(--fg)', margin: '2px 0' }}>
                {selectedCategories.length > 0 ? selectedCategories.map((c) => c.label).join(', ') : 'Nenhuma categoria selecionada'}
              </p>
            </div>

            <div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted-fg)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Portfólio</span>
              <p style={{ fontSize: '13.5px', color: 'var(--fg)', margin: '2px 0' }}>
                {portfolioItems.length > 0 ? `${portfolioItems.length} foto(s) enviada(s)` : 'Nenhuma foto enviada ainda'}
              </p>
            </div>
          </div>

          <p style={{ fontSize: '12.5px', color: 'var(--muted-fg)', marginBottom: '18px', lineHeight: 1.6 }}>
            Ao enviar, sua solicitação entra na fila de análise do administrador. O painel completo será liberado após a aprovação. Você receberá a confirmação e o resultado por e-mail.
          </p>

          <NextButton onClick={handleSubmitForReview} disabled={submitting} label={submitting ? 'Enviando…' : 'Enviar solicitação'} />
        </div>
      )}
    </div>
  )
}
