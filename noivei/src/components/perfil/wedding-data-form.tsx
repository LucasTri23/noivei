'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useWatch, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { toastError, toastSuccess } from '@/store/toast.store'
import Spinner from '@/components/ui/spinner'
import DatePicker from '@/components/ui/date-picker'
import CurrencyInput from '@/components/ui/currency-input'
import Modal from '@/components/ui/modal'
import { DEFAULT_RSVP_MESSAGE_TEMPLATE, fillRsvpMessageTemplate } from '@/lib/rsvp/build-whatsapp-link'
import { recalculateChecklistDueDates } from '@/lib/checklist/generate'
import type { WeddingStyle } from '@/types/database'

// Limite de alterações de wedding_date, forçado de verdade no banco (trigger
// fn_enforce_wedding_date_change_limit, ver migration 20260805000016) — este
// formulário grava direto no Supabase via RLS, sem Route Handler no meio, então
// qualquer trava só aqui seria cosmética. O que este componente faz é só
// refletir o estado (contador, campo desabilitado, aviso na penúltima troca)
// pra dar um feedback melhor do que deixar o usuário descobrir o limite só
// quando o UPDATE for rejeitado pelo trigger.
const WEDDING_DATE_CHANGE_LIMIT = 3

// Precisa bater com a mensagem exata que o trigger levanta (RAISE EXCEPTION) —
// usado só pra reconhecer ESSE erro específico e trocar por um toastError
// específico, distinto do fallback genérico usado pra qualquer outra falha.
const WEDDING_DATE_LIMIT_ERROR_MARKER = 'Limite de alterações da data do casamento'

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
  rsvp_message_template: z.string().trim().max(500, 'Mensagem muito longa').optional(),
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
    rsvp_message_template: string | null
    wedding_date_changed_count: number
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

function previewRsvpMessage(template: string): string {
  return fillRsvpMessageTemplate(template, 'Maria', 'https://wednest.app/rsvp/exemplo-token')
}

export default function WeddingDataForm({ weddingId, initial }: WeddingDataFormProps) {
  const router = useRouter()
  const [loading, setLoading]         = useState(false)
  const showSpinner = useDelayedLoading(loading)

  // Dados aguardando confirmação no modal de "última alteração" — só existe entre o
  // usuário clicar "Salvar alterações" (interceptado, ver onValidSubmit) e ele
  // confirmar ou cancelar no modal. null quando o modal está fechado.
  const [pendingData, setPendingData] = useState<WeddingDataFields | null>(null)

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
      rsvp_message_template: initial.rsvp_message_template ?? DEFAULT_RSVP_MESSAGE_TEMPLATE,
    },
  })

  const messageTemplate = useWatch({ control, name: 'rsvp_message_template' })

  const changedCount = initial.wedding_date_changed_count
  const dateLimitReached = changedCount >= WEDDING_DATE_CHANGE_LIMIT
  // A PRÓXIMA troca (se acontecer) seria a última permitida — é quando vale
  // avisar antes de gravar, não depois.
  const isLastAllowedChange = changedCount === WEDDING_DATE_CHANGE_LIMIT - 1

  async function saveWedding(data: WeddingDataFields) {
    setLoading(true)

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
        rsvp_message_template: data.rsvp_message_template?.trim() || DEFAULT_RSVP_MESSAGE_TEMPLATE,
        ...(coupleNames ? { couple_names: coupleNames } : {}),
      })
      .eq('id', weddingId)

    if (error) {
      setLoading(false)
      // O trigger fn_enforce_wedding_date_change_limit (migration 20260805000016) só
      // deveria disparar aqui numa corrida rara — o campo já vem desabilitado quando
      // dateLimitReached. Reconhece essa mensagem específica pra dar um aviso amigável
      // em vez de deixar vazar o erro cru do Postgres via toastError.
      if (error.message.includes(WEDDING_DATE_LIMIT_ERROR_MARKER)) {
        toastError('Você já usou as 3 alterações permitidas para a data do casamento.')
      } else {
        toastError('Não foi possível salvar. Tente novamente.')
      }
      return
    }

    // Data mudou: recalcula due_date das tarefas do catálogo (Checklist/Timeline
    // ficavam com os prazos antigos, já que due_date só era calculado na geração
    // inicial). Best-effort — o salvamento acima já teve sucesso, uma falha aqui não
    // deve ser reportada como erro do formulário.
    const newDate = data.wedding_date || null
    let recalcMessage = ''
    if (newDate !== (initial.wedding_date || null)) {
      try {
        const result = await recalculateChecklistDueDates(supabase, weddingId, newDate)
        recalcMessage =
          result.total === 0
            ? ' Nenhuma tarefa do catálogo para atualizar.'
            : ` ${result.updated} de ${result.total} prazo(s) do checklist recalculado(s).`
      } catch (recalcError) {
        // Não é crítico pro formulário (já salvou), mas precisa ficar visível pra debugar —
        // silenciar por completo escondeu a causa real na primeira rodada dessa correção.
        console.error('[wedding-data-form] falha ao recalcular prazos do checklist:', recalcError)
        recalcMessage = ' Não foi possível recalcular os prazos do checklist — veja o console.'
      }
    }

    setLoading(false)
    toastSuccess(`Dados do casamento salvos com sucesso. O orçamento já aparece na aba Financeiro.${recalcMessage}`)
    router.refresh()
  }

  // Gate de submit: se esta seria a ÚLTIMA troca permitida da data E a data
  // realmente mudou em relação ao valor inicial, intercepta e pede confirmação
  // antes de gravar — depois de confirmar, não tem mais volta (o trigger passa a
  // rejeitar qualquer troca seguinte).
  async function onValidSubmit(data: WeddingDataFields) {
    const dateChanged = (data.wedding_date || null) !== (initial.wedding_date || null)
    if (isLastAllowedChange && dateChanged) {
      setPendingData(data)
      return
    }
    await saveWedding(data)
  }

  async function handleConfirmDateChange() {
    if (!pendingData) return
    const data = pendingData
    setPendingData(null)
    await saveWedding(data)
  }

  function handleCancelDateChange() {
    setPendingData(null)
  }

  return (
    <>
    <form onSubmit={handleSubmit(onValidSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                disabled={dateLimitReached}
              />
            )}
          />
          <p style={{ fontSize: '12px', color: dateLimitReached ? '#C0553F' : 'var(--muted-fg)', margin: 0 }}>
            {dateLimitReached
              ? 'Você já usou as 3 alterações permitidas para a data do casamento.'
              : `Alterações usadas: ${changedCount} de ${WEDDING_DATE_CHANGE_LIMIT}`}
          </p>
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

      <div style={fieldWrapStyle}>
        <label style={labelStyle} htmlFor="rsvp_message_template">Mensagem de convite (WhatsApp)</label>
        <p style={{ fontSize: '12.5px', color: 'var(--muted-fg)', margin: '-2px 0 2px' }}>
          Usada no botão de WhatsApp da tela de Convidados. Use <strong>{'{nome}'}</strong> para o nome do convidado
          e <strong>{'{link}'}</strong> para o link de confirmação — ambos são substituídos automaticamente.
        </p>
        <textarea
          id="rsvp_message_template"
          rows={3}
          maxLength={500}
          {...register('rsvp_message_template')}
          placeholder={DEFAULT_RSVP_MESSAGE_TEMPLATE}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
        />
        {errors.rsvp_message_template && (
          <p style={{ fontSize: '12px', color: '#C0553F' }}>{errors.rsvp_message_template.message}</p>
        )}
        <div
          className="rounded-xl p-3"
          style={{ background: 'var(--wedding-color-subtle)', fontSize: '13px', color: 'var(--fg)', lineHeight: 1.5 }}
        >
          <span style={{ fontWeight: 600, display: 'block', marginBottom: '2px' }}>Prévia:</span>
          {previewRsvpMessage(messageTemplate || DEFAULT_RSVP_MESSAGE_TEMPLATE)}
        </div>
      </div>

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

    <Modal open={pendingData !== null} onClose={handleCancelDateChange} title="Última alteração de data">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <p style={{ fontSize: '14px', color: 'var(--muted-fg)', lineHeight: 1.6, margin: 0 }}>
          Esta será sua última alteração possível para a data do casamento. Depois de confirmar, você não
          poderá mais alterá-la. Deseja continuar?
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={handleCancelDateChange}
            disabled={loading}
            style={{
              background: 'transparent', color: 'var(--muted-fg)', border: 'none',
              fontWeight: 600, fontSize: '14px', cursor: loading ? 'not-allowed' : 'pointer', padding: '10px 14px',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmDateChange}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'var(--wedding-color)', color: '#fff', border: 'none',
              borderRadius: '12px', padding: '10px 18px',
              fontWeight: 600, fontSize: '14px',
              cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1,
            }}
          >
            {showSpinner && <Spinner size={15} color="#fff" />} {loading ? 'Salvando…' : 'Confirmar alteração'}
          </button>
        </div>
      </div>
    </Modal>
    </>
  )
}
