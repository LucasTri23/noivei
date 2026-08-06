'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { SupportContactSchema, type SupportContactInput } from '@/lib/api/validation/support.schema'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { toastError, toastSuccess } from '@/store/toast.store'
import Spinner from '@/components/ui/spinner'

const labelStyle: React.CSSProperties = {
  fontSize: '13px', fontWeight: 600, color: 'var(--fg)',
}
const inputStyle: React.CSSProperties = {
  border: '1.5px solid #EBDDD0', borderRadius: '12px', padding: '12px 14px',
  fontSize: '15px', color: 'var(--fg)', background: 'var(--surface)', outline: 'none', width: '100%',
}

interface ApiErrorBody {
  error?: { message?: string }
}

export default function SupportContactForm() {
  const [loading, setLoading] = useState(false)
  const showSpinner = useDelayedLoading(loading)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<SupportContactInput>({
    resolver: zodResolver(SupportContactSchema),
  })

  async function onSubmit(data: SupportContactInput) {
    setLoading(true)

    const response = await fetch('/api/v1/support/contact', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    })

    setLoading(false)

    if (!response.ok) {
      const body = (await response.json()) as ApiErrorBody
      toastError(body.error?.message ?? 'Não foi possível enviar sua mensagem. Tente novamente.')
      return
    }

    toastSuccess('Mensagem enviada! Nossa equipe responde em até 1 dia útil.')
    reset()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={labelStyle} htmlFor="support-subject">Título</label>
        <input
          id="support-subject"
          {...register('subject')}
          placeholder="Ex: Não consigo adicionar um convidado"
          style={inputStyle}
        />
        {errors.subject && <p style={{ fontSize: '12px', color: '#C0553F', margin: 0 }}>{errors.subject.message}</p>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={labelStyle} htmlFor="support-message">Mensagem</label>
        <textarea
          id="support-message"
          rows={4}
          maxLength={4000}
          {...register('message')}
          placeholder="Descreva com detalhes o que você precisa"
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
        />
        {errors.message && <p style={{ fontSize: '12px', color: '#C0553F', margin: 0 }}>{errors.message.message}</p>}
      </div>

      <button
        type="submit"
        disabled={loading}
        style={{
          display: 'flex', alignItems: 'center', gap: '9px',
          background: 'var(--wedding-color)', color: '#fff', border: 'none',
          borderRadius: '12px', padding: '12px 20px', fontWeight: 600, fontSize: '14px',
          cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
          boxShadow: '0 10px 24px color-mix(in srgb, var(--wedding-color) 32%, transparent)',
          alignSelf: 'flex-start',
        }}
      >
        {showSpinner && <Spinner size={15} color="#fff" />}
        {loading ? 'Enviando…' : 'Enviar mensagem'}
      </button>
    </form>
  )
}
