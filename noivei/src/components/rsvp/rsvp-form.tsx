'use client'

import { useState } from 'react'

import Spinner from '@/components/ui/spinner'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { PhoneSchema } from '@/lib/api/validation/rsvp.schema'
import { toastError } from '@/store/toast.store'
import type { GuestStatus } from '@/types/database'

interface RsvpFormProps {
  token:             string
  initialStatus:     GuestStatus
  initialPartySize:  number
}

interface RespondErrorBody {
  error?: { code?: string; message?: string }
}

interface CompanionForm {
  name:  string
  phone: string
}

interface CompanionFormError {
  name?:  string
  phone?: string
}

type Answer = 'confirmado' | 'recusado'

const inputStyle: React.CSSProperties = {
  border: '1.5px solid var(--border)', borderRadius: '12px', padding: '12px 14px',
  fontSize: '15px', color: 'var(--fg)', background: 'var(--surface)', outline: 'none', width: '100%',
}

const labelStyle: React.CSSProperties = {
  fontSize: '13px', fontWeight: 600, color: 'var(--fg)', marginBottom: '6px', display: 'block',
}

function validateCompanions(companions: CompanionForm[]): CompanionFormError[] {
  return companions.map((companion) => {
    const errors: CompanionFormError = {}

    if (!companion.name.trim()) errors.name = 'Informe o nome do acompanhante.'

    const parsedPhone = PhoneSchema.safeParse(companion.phone)
    if (!parsedPhone.success) {
      errors.phone = companion.phone.trim().length === 0
        ? 'Informe o telefone do acompanhante.'
        : (parsedPhone.error.issues[0]?.message ?? 'Telefone inválido.')
    }

    return errors
  })
}

export default function RsvpForm({ token, initialStatus, initialPartySize }: RsvpFormProps) {
  const [status, setStatus]   = useState<GuestStatus>(initialStatus)
  // Nunca pré-preenchido: o telefone existente não é devolvido pela API de propósito
  // (ver get-rsvp-by-token.ts) — se aparecesse aqui já preenchido, qualquer um que
  // abrisse o link veria o número certo e a conferência não serviria pra nada.
  const [phone, setPhone]     = useState('')
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [attendingCount, setAttendingCount] = useState(1)
  const [companions, setCompanions]         = useState<CompanionForm[]>([])
  const [companionErrors, setCompanionErrors] = useState<CompanionFormError[]>([])
  const [saving, setSaving]   = useState<Answer | null>(null)
  const [saved, setSaved]     = useState(false)
  const showSpinner = useDelayedLoading(saving !== null)

  function handleAttendingCountChange(value: number) {
    setAttendingCount(value)
    setCompanionErrors([])
    setCompanions((prev) => {
      const needed = Math.max(0, value - 1)
      const next = prev.slice(0, needed)
      while (next.length < needed) next.push({ name: '', phone: '' })
      return next
    })
  }

  function updateCompanion(index: number, field: keyof CompanionForm, value: string) {
    setCompanions((prev) => prev.map((companion, i) => (i === index ? { ...companion, [field]: value } : companion)))
    setCompanionErrors((prev) => prev.map((error, i) => (i === index ? { ...error, [field]: undefined } : error)))
  }

  async function respond(answer: Answer) {
    if (saving) return

    // Telefone é exigido pras duas respostas (confirmar e recusar) — o servidor
    // confere se bate com o que o casal cadastrou (ou aceita e grava, se for a
    // primeira resposta desse convidado).
    const parsedPhone = PhoneSchema.safeParse(phone)
    if (!parsedPhone.success) {
      setPhoneError(phone.trim().length === 0 ? 'Informe seu telefone para responder.' : (parsedPhone.error.issues[0]?.message ?? 'Telefone inválido.'))
      return
    }

    // Acompanhantes só valem pra confirmação — espelha a mesma regra do servidor
    // (ver UpdateRsvpSchema) pra dar feedback cedo, sem substituir a validação de lá.
    if (answer === 'confirmado' && attendingCount > 1) {
      const errors = validateCompanions(companions)
      setCompanionErrors(errors)
      if (errors.some((error) => error.name || error.phone)) return
    } else {
      setCompanionErrors([])
    }

    setPhoneError(null)
    setSaving(answer)
    setSaved(false)

    const res = await fetch(`/api/v1/rsvp/${encodeURIComponent(token)}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: answer,
        phone:  phone.trim() || null,
        ...(answer === 'confirmado'
          ? {
              attending_count: attendingCount,
              companions: attendingCount > 1
                ? companions.map((companion) => ({ name: companion.name.trim(), phone: companion.phone.trim() }))
                : [],
            }
          : {}),
      }),
    })

    setSaving(null)
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as RespondErrorBody | null
      if (body?.error?.code === 'PHONE_MISMATCH') {
        setPhoneError(body.error.message ?? 'Telefone não confere com o cadastrado.')
        return
      }
      if (body?.error?.code === 'ATTENDING_COUNT_EXCEEDS_PARTY_SIZE') {
        toastError(body.error.message ?? 'A quantidade informada excede o número de pessoas do convite.')
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

      {initialPartySize > 1 && (
        <div style={{ marginBottom: '18px' }}>
          <label htmlFor="rsvp-attending-count" style={labelStyle}>Quantos vão comparecer?</label>
          <select
            id="rsvp-attending-count"
            value={attendingCount}
            onChange={(e) => handleAttendingCountChange(Number(e.target.value))}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            {Array.from({ length: initialPartySize }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <p style={{ fontSize: '12px', color: 'var(--muted-fg)', margin: '6px 0 0' }}>
            Este convite cobre até {initialPartySize} pessoa{initialPartySize > 1 ? 's' : ''}. Se for mais de
            uma, informe os dados de quem vai com você.
          </p>
        </div>
      )}

      {initialPartySize > 1 && attendingCount > 1 && (
        <div style={{ marginBottom: '18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {companions.map((companion, index) => (
            <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label htmlFor={`rsvp-companion-name-${index}`} style={labelStyle}>
                  Nome do acompanhante {index + 1}
                </label>
                <input
                  id={`rsvp-companion-name-${index}`}
                  type="text"
                  maxLength={120}
                  value={companion.name}
                  onChange={(e) => updateCompanion(index, 'name', e.target.value)}
                  placeholder="Nome completo"
                  style={{ ...inputStyle, ...(companionErrors[index]?.name ? { borderColor: '#C0553F' } : {}) }}
                />
                {companionErrors[index]?.name && (
                  <p style={{ fontSize: '12px', color: '#C0553F', margin: '6px 0 0' }}>{companionErrors[index]?.name}</p>
                )}
              </div>
              <div>
                <label htmlFor={`rsvp-companion-phone-${index}`} style={labelStyle}>
                  Telefone do acompanhante {index + 1}
                </label>
                <input
                  id={`rsvp-companion-phone-${index}`}
                  type="tel"
                  minLength={8}
                  maxLength={20}
                  value={companion.phone}
                  onChange={(e) => updateCompanion(index, 'phone', e.target.value)}
                  placeholder="(11) 99999-9999"
                  style={{ ...inputStyle, ...(companionErrors[index]?.phone ? { borderColor: '#C0553F' } : {}) }}
                />
                {companionErrors[index]?.phone && (
                  <p style={{ fontSize: '12px', color: '#C0553F', margin: '6px 0 0' }}>{companionErrors[index]?.phone}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

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
