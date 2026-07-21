'use client'

import { useState } from 'react'

import Spinner from '@/components/ui/spinner'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { PhoneSchema } from '@/lib/api/validation/rsvp.schema'
import { toastError } from '@/store/toast.store'
import type { GuestStatus } from '@/types/database'

interface RsvpFormProps {
  token:         string
  initialStatus: GuestStatus
}

interface RespondErrorBody {
  error?: { code?: string; message?: string }
}

type Answer = 'confirmado' | 'recusado'

const inputStyle: React.CSSProperties = {
  border: '1.5px solid var(--border)', borderRadius: '12px', padding: '12px 14px',
  fontSize: '15px', color: 'var(--fg)', background: 'var(--surface)', outline: 'none', width: '100%',
}

const labelStyle: React.CSSProperties = {
  fontSize: '13px', fontWeight: 600, color: 'var(--fg)', marginBottom: '6px', display: 'block',
}

export default function RsvpForm({ token, initialStatus }: RsvpFormProps) {
  const [status, setStatus]   = useState<GuestStatus>(initialStatus)
  // Nunca pré-preenchido: o telefone existente não é devolvido pela API de propósito
  // (ver get-rsvp-by-token.ts) — se aparecesse aqui já preenchido, qualquer um que
  // abrisse o link veria o número certo e a conferência não serviria pra nada.
  const [phone, setPhone]     = useState('')
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [saving, setSaving]   = useState<Answer | null>(null)
  const [saved, setSaved]     = useState(false)
  const showSpinner = useDelayedLoading(saving !== null)

  async function respond(answer: Answer) {
    if (saving) return

    // Telefone é exigido pras duas respostas (confirmar e recusar) — o servidor
    // confere se bate com o que o casal cadastrou (ou aceita e grava, se for a
    // primeira resposta desse convidado).
    const parsed = PhoneSchema.safeParse(phone)
    if (!parsed.success) {
      setPhoneError(phone.trim().length === 0 ? 'Informe seu telefone para responder.' : (parsed.error.issues[0]?.message ?? 'Telefone inválido.'))
      return
    }

    setPhoneError(null)
    setSaving(answer)
    setSaved(false)

    const res = await fetch(`/api/v1/rsvp/${encodeURIComponent(token)}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status: answer, phone: phone.trim() || null }),
    })

    setSaving(null)
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as RespondErrorBody | null
      if (body?.error?.code === 'PHONE_MISMATCH') {
        setPhoneError(body.error.message ?? 'Telefone não confere com o cadastrado.')
        return
      }
      toastError('Não foi possível registrar sua resposta. Tente novamente.')
      return
    }

    setStatus(answer)
    setSaved(true)
  }

  const answered = status !== 'pendente'

  return (
    <div>
      {answered && (
        <p
          style={{
            fontSize: '14.5px', margin: '0 0 18px', padding: '12px 16px', borderRadius: '12px',
            background: status === 'confirmado' ? '#E9EFE6' : '#F6E4DE',
            color:      status === 'confirmado' ? '#5E8B6A' : '#C0553F',
            fontWeight: 600,
          }}
        >
          {saved
            ? status === 'confirmado'
              ? 'Presença confirmada! O casal vai adorar ter você lá. 🎉'
              : 'Resposta registrada. Sentiremos sua falta!'
            : status === 'confirmado'
              ? 'Você já confirmou presença — mas pode mudar sua resposta abaixo.'
              : 'Você recusou o convite — mas pode mudar sua resposta abaixo.'}
        </p>
      )}

      <div style={{ marginBottom: '18px' }}>
        <label htmlFor="rsvp-phone" style={labelStyle}>Telefone</label>
        <input
          id="rsvp-phone"
          type="tel"
          minLength={8}
          maxLength={20}
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value)
            if (phoneError) setPhoneError(null)
          }}
          placeholder="(11) 99999-9999"
          style={{ ...inputStyle, ...(phoneError ? { borderColor: '#C0553F' } : {}) }}
        />
        {phoneError && (
          <p style={{ fontSize: '12px', color: '#C0553F', margin: '6px 0 0' }}>{phoneError}</p>
        )}
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button
          onClick={() => respond('confirmado')}
          disabled={saving !== null}
          style={{
            flex: 1, minWidth: '160px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            background: 'var(--wedding-color)', color: '#fff', border: 'none',
            borderRadius: '14px', padding: '15px 20px',
            fontWeight: 700, fontSize: '15px',
            cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1,
            boxShadow: '0 8px 20px color-mix(in srgb, var(--wedding-color) 35%, transparent)',
          }}
        >
          {showSpinner && saving === 'confirmado' && <Spinner color="#fff" />}
          Sim, estarei lá!
        </button>
        <button
          onClick={() => respond('recusado')}
          disabled={saving !== null}
          style={{
            flex: 1, minWidth: '160px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            background: 'transparent', color: 'var(--muted-fg)',
            border: '1.5px solid var(--border)', borderRadius: '14px', padding: '15px 20px',
            fontWeight: 600, fontSize: '15px',
            cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1,
          }}
        >
          {showSpinner && saving === 'recusado' && <Spinner />}
          Não poderei ir
        </button>
      </div>
    </div>
  )
}
