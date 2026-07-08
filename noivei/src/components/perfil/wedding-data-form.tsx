'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import Spinner from '@/components/ui/spinner'
import DatePicker from '@/components/ui/date-picker'
import CurrencyInput from '@/components/ui/currency-input'
import type { WeddingStyle } from '@/types/database'

const STYLE_OPTIONS: { value: WeddingStyle; label: string }[] = [
  { value: 'rustico',     label: 'Rústico' },
  { value: 'classico',    label: 'Clássico' },
  { value: 'moderno',     label: 'Moderno' },
  { value: 'boho',        label: 'Boho' },
  { value: 'minimalista', label: 'Minimalista' },
  { value: 'romantico',   label: 'Romântico' },
  { value: 'outro',       label: 'Outro' },
]

const WeddingDataSchema = z.object({
  bride_name:   z.string().trim().max(80, 'Nome muito longo').optional(),
  groom_name:   z.string().trim().max(80, 'Nome muito longo').optional(),
  wedding_date: z.string().optional(),
  venue:        z.string().trim().max(160, 'Local muito longo').optional(),
  city:         z.string().trim().max(120, 'Cidade muito longa').optional(),
  budget:       z.number().nullable().optional(),
  style:        z.union([z.enum(['rustico', 'classico', 'moderno', 'boho', 'minimalista', 'romantico', 'outro']), z.literal('')]).optional(),
})
type WeddingDataFields = z.infer<typeof WeddingDataSchema>

interface WeddingDataFormProps {
  weddingId: string
  initial: {
    bride_name:   string | null
    groom_name:   string | null
    wedding_date: string | null
    venue:        string | null
    city:         string | null
    budget:       number | null
    style:        WeddingStyle | null
  }
}

const fieldWrapStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: '6px',
}
const labelStyle: React.CSSProperties = {
  fontSize: '13px', fontWeight: 600, color: 'var(--fg)',
}
const inputStyle: React.CSSProperties = {
  border: '1.5px solid #EBDDD0', borderRadius: '12px', padding: '12px 14px',
  fontSize: '15px', color: 'var(--fg)', background: 'var(--surface)', outline: 'none', width: '100%',
}

export default function WeddingDataForm({ weddingId, initial }: WeddingDataFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState('')
  const [saved, setSaved]             = useState(false)
  const [loading, setLoading]         = useState(false)
  const showSpinner = useDelayedLoading(loading)

  const { register, handleSubmit, control, formState: { errors } } = useForm<WeddingDataFields>({
    resolver: zodResolver(WeddingDataSchema),
    defaultValues: {
      bride_name:   initial.bride_name ?? '',
      groom_name:   initial.groom_name ?? '',
      wedding_date: initial.wedding_date ?? '',
      venue:        initial.venue ?? '',
      city:         initial.city ?? '',
      budget:       initial.budget,
      style:        initial.style ?? '',
    },
  })

  async function onSubmit(data: WeddingDataFields) {
    setLoading(true)
    setServerError('')
    setSaved(false)

    const brideName = data.bride_name?.trim() || null
    const groomName = data.groom_name?.trim() || null
    const coupleNames = [brideName, groomName].filter(Boolean).join(' & ')

    const supabase = createSupabaseBrowser()
    const { error } = await supabase
      .from('weddings')
      .update({
        bride_name:   brideName,
        groom_name:   groomName,
        wedding_date: data.wedding_date || null,
        venue:        data.venue?.trim() || null,
        city:         data.city?.trim() || null,
        budget:       data.budget ?? null,
        style:        data.style || null,
        ...(coupleNames ? { couple_names: coupleNames } : {}),
      })
      .eq('id', weddingId)

    setLoading(false)
    if (error) {
      setServerError('Não foi possível salvar. Tente novamente.')
      return
    }
    setSaved(true)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))' }}>
        <div style={fieldWrapStyle}>
          <label style={labelStyle} htmlFor="bride_name">Nome da noiva</label>
          <input id="bride_name" {...register('bride_name')} placeholder="Ex: Maria" style={inputStyle} />
          {errors.bride_name && <p style={{ fontSize: '12px', color: '#C0553F' }}>{errors.bride_name.message}</p>}
        </div>
        <div style={fieldWrapStyle}>
          <label style={labelStyle} htmlFor="groom_name">Nome do noivo</label>
          <input id="groom_name" {...register('groom_name')} placeholder="Ex: João" style={inputStyle} />
          {errors.groom_name && <p style={{ fontSize: '12px', color: '#C0553F' }}>{errors.groom_name.message}</p>}
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))' }}>
        <div style={fieldWrapStyle}>
          <label style={labelStyle} htmlFor="wedding_date">Data do casamento</label>
          <Controller
            name="wedding_date"
            control={control}
            render={({ field }) => (
              <DatePicker
                id="wedding_date"
                value={field.value ?? ''}
                onChange={field.onChange}
                placeholder="Selecione a data"
              />
            )}
          />
        </div>
        <div style={fieldWrapStyle}>
          <label style={labelStyle} htmlFor="style">Estilo do casamento</label>
          <select id="style" {...register('style')} style={{ ...inputStyle, appearance: 'auto' }}>
            <option value="">Ainda não decidi</option>
            {STYLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={fieldWrapStyle}>
        <label style={labelStyle} htmlFor="venue">Local (se já decidiu)</label>
        <input id="venue" {...register('venue')} placeholder="Ex: Espaço Jardim das Flores" style={inputStyle} />
        {errors.venue && <p style={{ fontSize: '12px', color: '#C0553F' }}>{errors.venue.message}</p>}
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))' }}>
        <div style={fieldWrapStyle}>
          <label style={labelStyle} htmlFor="city">Cidade</label>
          <input id="city" {...register('city')} placeholder="Ex: Campinas - SP" style={inputStyle} />
          {errors.city && <p style={{ fontSize: '12px', color: '#C0553F' }}>{errors.city.message}</p>}
        </div>
        <div style={fieldWrapStyle}>
          <label style={labelStyle} htmlFor="budget">Orçamento estimado</label>
          <Controller
            name="budget"
            control={control}
            render={({ field }) => (
              <CurrencyInput id="budget" value={field.value ?? null} onChange={field.onChange} />
            )}
          />
        </div>
      </div>

      {serverError && (
        <p style={{ fontSize: '13.5px', color: '#C0553F', background: '#FBEEE6', padding: '10px 14px', borderRadius: '10px', margin: 0 }}>
          {serverError}
        </p>
      )}
      {saved && (
        <p style={{ fontSize: '13.5px', color: '#5E8B6A', background: '#E9EFE6', padding: '10px 14px', borderRadius: '10px', margin: 0 }}>
          Dados do casamento salvos com sucesso. O orçamento já aparece na aba Financeiro.
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          display: 'flex', alignItems: 'center', gap: '9px',
          background: 'var(--wedding-color)', color: '#fff', border: 'none',
          borderRadius: '12px', padding: '14px 22px', fontWeight: 600, fontSize: '15px',
          cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
          boxShadow: '0 10px 24px color-mix(in srgb, var(--wedding-color) 32%, transparent)',
          alignSelf: 'flex-start',
          marginTop: '8px',
        }}
      >
        {showSpinner && <Spinner size={15} color="#fff" />}
        {loading ? 'Salvando…' : 'Salvar alterações'}
      </button>
    </form>
  )
}
