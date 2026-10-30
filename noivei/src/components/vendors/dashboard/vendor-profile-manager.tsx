'use client'

import { isCnpj } from '@/lib/vendor/cnpj'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { sanitizeFileName } from '@/lib/files/upload-wedding-file'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { toastError, toastSuccess } from '@/store/toast.store'
import type { MarketplaceVendorStatus, VendorPortfolioItem, VendorProfile } from '@/types/database'

const PRICE_RANGE_OPTS = ['$', '$$', '$$$'] as const
type PriceRange = (typeof PRICE_RANGE_OPTS)[number] | ''

interface FormData {
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

interface VendorProfileManagerProps {
  profile:               VendorProfile
  initialPortfolioItems: VendorPortfolioItem[]
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

const inputStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '12px',
  border: '1.5px solid #EBDDD0', borderRadius: '12px', padding: '13px 15px',
  background: 'var(--surface)',
}
const labelStyle: React.CSSProperties = {
  fontSize: '13px', fontWeight: 600, color: 'var(--fg)', marginBottom: '8px', display: 'block',
}
const sectionStyle: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid #EBDDD0', borderRadius: '18px', padding: '22px', marginBottom: '20px',
}

const STATUS_LABEL: Record<MarketplaceVendorStatus, string> = {
  draft:           'Rascunho',
  pending_review:  'Em análise',
  active:          'Ativo no marketplace',
  paused:          'Pausado',
  suspended:       'Suspenso',
  rejected:        'Não aprovado',
}

const MAX_PORTFOLIO_ITEMS = 30

export default function VendorProfileManager({ profile, initialPortfolioItems }: VendorProfileManagerProps) {
  const [form, setForm] = useState<FormData>({
    business_name: profile.business_name,
    cnpj:          profile.cnpj ?? '',
    phone:         profile.phone ?? '',
    whatsapp:      profile.whatsapp ?? '',
    show_whatsapp: profile.show_whatsapp,
    instagram:     profile.instagram ?? '',
    website:       profile.website ?? '',
    city:          profile.city ?? '',
    state:         profile.state ?? '',
    description:   profile.description ?? '',
    price_range:   (profile.price_range as PriceRange) ?? '',
  })
  const [saving, setSaving] = useState(false)

  const [items, setItems]           = useState<VendorPortfolioItem[]>(initialPortfolioItems)
  const [uploading, setUploading]   = useState(false)
  const [reordering, setReordering] = useState<string | null>(null)
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    if (items.length === 0) return
    let cancelled = false
    const supabase = createSupabaseBrowser()

    Promise.all(
      items.map(async (item) => {
        const { data } = await supabase.storage.from('vendor-portfolio').createSignedUrl(item.storage_path, 3600)
        return [item.id, data?.signedUrl ?? null] as const
      }),
    ).then((entries) => {
      if (cancelled) return
      setSignedUrls(Object.fromEntries(entries.filter((entry): entry is [string, string] => entry[1] !== null)))
    })

    return () => { cancelled = true }
  }, [items])

  function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((d) => ({ ...d, [key]: value }))
  }

  async function handleSave() {
    if (form.business_name.trim().length < 2) {
      toastError('Informe o nome da sua empresa.')
      return
    }
    if (!isCnpj(form.cnpj)) {
      toastError('Informe o CNPJ da empresa com 14 caracteres.')
      return
    }
    setSaving(true)
    const res = await fetch('/api/v1/vendor/profile', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_name: form.business_name.trim(),
        cnpj:          form.cnpj.trim(),
        phone:         form.phone.trim() || undefined,
        whatsapp:      form.whatsapp.trim() || undefined,
        show_whatsapp: form.show_whatsapp,
        instagram:     form.instagram.trim() || undefined,
        website:       form.website.trim() || undefined,
        city:          form.city.trim() || undefined,
        state:         form.state.trim() || undefined,
        description:   form.description.trim() || undefined,
        price_range:   form.price_range || undefined,
      }),
    })
    setSaving(false)

    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível salvar as alterações.'))
      return
    }
    toastSuccess('Perfil atualizado.')
  }

  async function handleFileUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    if (items.length >= MAX_PORTFOLIO_ITEMS) {
      toastError(`Seu portfólio já tem o máximo de ${MAX_PORTFOLIO_ITEMS} fotos. Remova alguma antes de enviar outra.`)
      return
    }

    setUploading(true)
    const supabase = createSupabaseBrowser()

    for (const file of Array.from(fileList)) {
      if (items.length >= MAX_PORTFOLIO_ITEMS) break

      const path = `${profile.id}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`
      const { error: uploadError } = await supabase.storage.from('vendor-portfolio').upload(path, file)

      if (uploadError) {
        toastError(`Não foi possível enviar "${file.name}". Verifique o tamanho (máx. 10 MB) e o formato (JPG, PNG, WEBP ou HEIC).`)
        continue
      }

      const res = await fetch('/api/v1/vendor/portfolio', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ storage_path: path, sort_order: items.length }),
      })

      if (!res.ok) {
        await supabase.storage.from('vendor-portfolio').remove([path])
        toastError(`"${file.name}": ${await readApiError(res, 'Não foi possível salvar a foto.')}`)
        continue
      }

      const body = (await res.json()) as { data: VendorPortfolioItem }
      setItems((prev) => [...prev, body.data])
    }

    setUploading(false)
  }

  async function handleRemove(id: string) {
    const res = await fetch(`/api/v1/vendor/portfolio/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      toastError(await readApiError(res, 'Não foi possível remover a foto.'))
      return
    }
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  // Reordenação simples (mover pra cima/baixo) em vez de arrastar-e-soltar — troca o
  // sort_order dos dois itens vizinhos com dois PATCH, atualização otimista na UI.
  async function handleMove(index: number, direction: -1 | 1) {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= items.length) return

    const current = items[index]!
    const target  = items[targetIndex]!
    setReordering(current.id)

    const nextItems = [...items]
    nextItems[index] = target
    nextItems[targetIndex] = current
    setItems(nextItems)

    const [resA, resB] = await Promise.all([
      fetch(`/api/v1/vendor/portfolio/${current.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: target.sort_order }),
      }),
      fetch(`/api/v1/vendor/portfolio/${target.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: current.sort_order }),
      }),
    ])
    setReordering(null)

    if (!resA.ok || !resB.ok) {
      setItems(items) // reverte
      toastError('Não foi possível reordenar as fotos.')
      return
    }

    setItems((prev) => prev.map((item) => {
      if (item.id === current.id) return { ...item, sort_order: target.sort_order }
      if (item.id === target.id) return { ...item, sort_order: current.sort_order }
      return item
    }))
  }

  return (
    <div>
      {/* Status */}
      <div style={{ ...sectionStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted-fg)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</span>
          <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--fg)', margin: '2px 0 0' }}>{STATUS_LABEL[profile.status]}</p>
          {profile.status === 'rejected' && profile.rejection_reason && (
            <p style={{ fontSize: '13px', color: '#C0553F', margin: '6px 0 0' }}>{profile.rejection_reason}</p>
          )}
        </div>
        {profile.status === 'active' && (
          <Link
            href={`/profissionais/${profile.slug}`}
            target="_blank"
            style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--wedding-color-dark)', textDecoration: 'none' }}
          >
            Ver perfil público →
          </Link>
        )}
      </div>

      {/* Dados da empresa */}
      <div style={sectionStyle}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--fg)', margin: '0 0 16px' }}>Dados da empresa</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label htmlFor="perfil-business-name" style={labelStyle}>Nome da empresa *</label>
            <div style={inputStyle}>
              <input
                id="perfil-business-name"
                value={form.business_name}
                onChange={(e) => setField('business_name', e.target.value)}
                style={{ border: 'none', outline: 'none', fontSize: '15px', color: 'var(--fg)', width: '100%', background: 'transparent' }}
              />
            </div>
          </div>

          <div>
            <label htmlFor="perfil-description" style={labelStyle}>Descrição</label>
            <textarea
              id="perfil-description"
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              rows={4}
              maxLength={2000}
              style={{ ...inputStyle, resize: 'vertical', fontSize: '14.5px', color: 'var(--fg)', width: '100%', fontFamily: 'inherit' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label htmlFor="perfil-city" style={labelStyle}>Cidade</label>
              <div style={inputStyle}>
                <input id="perfil-city" value={form.city} onChange={(e) => setField('city', e.target.value)}
                  style={{ border: 'none', outline: 'none', fontSize: '15px', color: 'var(--fg)', width: '100%', background: 'transparent' }} />
              </div>
            </div>
            <div style={{ flex: '0 1 120px' }}>
              <label htmlFor="perfil-state" style={labelStyle}>Estado</label>
              <div style={inputStyle}>
                <input id="perfil-state" value={form.state} onChange={(e) => setField('state', e.target.value)}
                  style={{ border: 'none', outline: 'none', fontSize: '15px', color: 'var(--fg)', width: '100%', background: 'transparent' }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label htmlFor="perfil-phone" style={labelStyle}>Telefone</label>
              <div style={inputStyle}>
                <input id="perfil-phone" value={form.phone} onChange={(e) => setField('phone', e.target.value)}
                  style={{ border: 'none', outline: 'none', fontSize: '15px', color: 'var(--fg)', width: '100%', background: 'transparent' }} />
              </div>
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <label htmlFor="perfil-whatsapp" style={labelStyle}>WhatsApp</label>
              <div style={inputStyle}>
                <input id="perfil-whatsapp" value={form.whatsapp} onChange={(e) => setField('whatsapp', e.target.value)}
                  style={{ border: 'none', outline: 'none', fontSize: '15px', color: 'var(--fg)', width: '100%', background: 'transparent' }} />
              </div>
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', color: 'var(--fg)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.show_whatsapp}
              onChange={(e) => setField('show_whatsapp', e.target.checked)}
              style={{ accentColor: 'var(--wedding-color)', width: '16px', height: '16px' }}
            />
            Mostrar WhatsApp no meu perfil público
          </label>

          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label htmlFor="perfil-instagram" style={labelStyle}>Instagram</label>
              <div style={inputStyle}>
                <input id="perfil-instagram" value={form.instagram} onChange={(e) => setField('instagram', e.target.value)}
                  style={{ border: 'none', outline: 'none', fontSize: '15px', color: 'var(--fg)', width: '100%', background: 'transparent' }} />
              </div>
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <label htmlFor="perfil-website" style={labelStyle}>Site</label>
              <div style={inputStyle}>
                <input id="perfil-website" value={form.website} onChange={(e) => setField('website', e.target.value)}
                  style={{ border: 'none', outline: 'none', fontSize: '15px', color: 'var(--fg)', width: '100%', background: 'transparent' }} />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="perfil-cnpj" style={labelStyle}>CNPJ *</label>
            <div style={inputStyle}>
              <input id="perfil-cnpj" required aria-required="true" value={form.cnpj} onChange={(e) => setField('cnpj', e.target.value)}
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
                  onClick={() => setField('price_range', form.price_range === opt ? '' : opt)}
                  style={{
                    padding: '10px 18px', borderRadius: '12px',
                    border: `1.5px solid ${form.price_range === opt ? 'var(--wedding-color)' : '#EBDDD0'}`,
                    background: form.price_range === opt ? 'var(--wedding-color-subtle)' : 'var(--surface)',
                    color: form.price_range === opt ? 'var(--wedding-color-dark)' : 'var(--muted-fg)',
                    fontWeight: form.price_range === opt ? 700 : 500, fontSize: '14px', cursor: 'pointer',
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            marginTop: '20px', border: 'none', borderRadius: '12px', padding: '13px 22px',
            fontWeight: 700, fontSize: '14.5px', background: 'var(--wedding-color)', color: '#fff',
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </div>

      {/* Portfólio */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--fg)', margin: 0 }}>Portfólio</h2>
          <span style={{ fontSize: '12.5px', color: 'var(--muted-fg)' }}>{items.length}/{MAX_PORTFOLIO_ITEMS} fotos</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '10px', marginBottom: '18px' }}>
          {items.map((item, index) => (
            <div key={item.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: '12px', overflow: 'hidden', background: '#EBDDD0' }}>
              {signedUrls[item.id] && (
                // eslint-disable-next-line @next/next/no-img-element -- signed URL temporária, next/image não ganha nada aqui
                <img src={signedUrls[item.id]} alt={item.caption ?? 'Foto do portfólio'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
              <button
                type="button"
                onClick={() => handleRemove(item.id)}
                aria-label="Remover foto"
                style={{
                  position: 'absolute', top: '6px', right: '6px', width: '24px', height: '24px', borderRadius: '999px',
                  border: 'none', background: 'rgba(0,0,0,0.55)', color: '#fff', cursor: 'pointer', fontSize: '14px', lineHeight: 1,
                }}
              >
                ×
              </button>
              <div style={{ position: 'absolute', bottom: '6px', left: '6px', display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => handleMove(index, -1)}
                  disabled={index === 0 || reordering !== null}
                  aria-label="Mover foto para trás"
                  style={{
                    width: '22px', height: '22px', borderRadius: '999px', border: 'none',
                    background: 'rgba(0,0,0,0.55)', color: '#fff', cursor: index === 0 ? 'not-allowed' : 'pointer',
                    fontSize: '12px', lineHeight: 1, opacity: index === 0 ? 0.4 : 1,
                  }}
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => handleMove(index, 1)}
                  disabled={index === items.length - 1 || reordering !== null}
                  aria-label="Mover foto para frente"
                  style={{
                    width: '22px', height: '22px', borderRadius: '999px', border: 'none',
                    background: 'rgba(0,0,0,0.55)', color: '#fff', cursor: index === items.length - 1 ? 'not-allowed' : 'pointer',
                    fontSize: '12px', lineHeight: 1, opacity: index === items.length - 1 ? 0.4 : 1,
                  }}
                >
                  →
                </button>
              </div>
            </div>
          ))}
        </div>

        <label
          htmlFor="perfil-portfolio-upload"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1.5px dashed #EBDDD0', borderRadius: '12px', padding: '22px',
            color: 'var(--muted-fg)', fontSize: '13.5px',
            cursor: (uploading || items.length >= MAX_PORTFOLIO_ITEMS) ? 'not-allowed' : 'pointer',
            opacity: (uploading || items.length >= MAX_PORTFOLIO_ITEMS) ? 0.6 : 1,
          }}
        >
          {uploading
            ? 'Enviando…'
            : items.length >= MAX_PORTFOLIO_ITEMS
              ? `Limite de ${MAX_PORTFOLIO_ITEMS} fotos atingido`
              : 'Clique para enviar fotos (JPG, PNG, WEBP ou HEIC, máx. 10 MB cada)'}
          <input
            id="perfil-portfolio-upload"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/heic"
            multiple
            disabled={uploading || items.length >= MAX_PORTFOLIO_ITEMS}
            onChange={(e) => { void handleFileUpload(e.target.files); e.target.value = '' }}
            style={{ display: 'none' }}
          />
        </label>
      </div>
    </div>
  )
}
