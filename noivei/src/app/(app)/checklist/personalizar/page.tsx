'use client'

// Questionário de personalização do checklist fora do onboarding — para contas que
// já têm casamento mas nunca geraram checklist (contas antigas) ou que fizeram
// upgrade de plano depois. Recurso dos planos pagos: Gratuito é redirecionado
// de volta para /checklist (onde gera a checklist fixa).

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import QuestionnaireWizard, { QUESTIONNAIRE_STEPS } from '@/components/checklist/questionnaire-wizard'
import { deriveFacts, parseAnswers, type WeddingAnswers } from '@/lib/checklist/facts'
import { generateChecklistItems } from '@/lib/checklist/generate'
import { isPaidPlan, type PlanId } from '@/constants/plans'
import type { WeddingPreferences } from '@/types/database'

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>
    </svg>
  )
}

export default function PersonalizarChecklistPage() {
  const router = useRouter()
  const [step, setStep]           = useState(0)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [weddingId, setWeddingId] = useState<string | null>(null)
  const [weddingDate, setWeddingDate] = useState<string | null>(null)
  const [answers, setAnswers]     = useState<WeddingAnswers>(parseAnswers(null))

  useEffect(() => {
    let cancelled = false
    const supabase = createSupabaseBrowser()

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      // Personalização é recurso pago — mesmo padrão de verificação do (app)/layout.tsx
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('plan_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const planId = ((subscription?.plan_id as string | undefined) ?? 'free') as PlanId
      if (!isPaidPlan(planId)) { router.replace('/checklist'); return }

      const { data: wedding } = await supabase
        .from('weddings')
        .select('id, wedding_date, guest_limit')
        .is('deleted_at', null)
        .order('created_at')
        .limit(1)
        .maybeSingle()

      if (!wedding) { router.replace('/onboarding'); return }

      // Pode existir registro de tentativa anterior — pré-preenche as respostas
      const { data: preferences } = await supabase
        .from('wedding_preferences')
        .select('answers')
        .eq('wedding_id', wedding.id)
        .maybeSingle()

      if (cancelled) return

      const parsed = parseAnswers((preferences as Pick<WeddingPreferences, 'answers'> | null)?.answers)
      const guestLimit = typeof wedding.guest_limit === 'number' && wedding.guest_limit > 0 ? wedding.guest_limit : null

      setWeddingId(wedding.id as string)
      setWeddingDate((wedding.wedding_date as string | null) ?? null)
      setAnswers({ ...parsed, convidados: parsed.convidados ?? guestLimit })
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [router])

  async function finish() {
    if (!weddingId) return
    setSaving(true)
    setError('')

    const supabase = createSupabaseBrowser()
    const { error: upsertError } = await supabase
      .from('wedding_preferences')
      .upsert({ wedding_id: weddingId, answers }, { onConflict: 'wedding_id' })

    if (upsertError) {
      setSaving(false)
      setError('Não foi possível salvar as respostas. Tente novamente.')
      return
    }

    try {
      const facts = deriveFacts(answers, weddingDate)
      await generateChecklistItems(supabase, weddingId, facts, weddingDate)
    } catch {
      setSaving(false)
      setError('Não foi possível gerar o checklist. Tente novamente.')
      return
    }

    router.push('/checklist')
  }

  if (loading) {
    return (
      <div
        className="rounded-2xl bg-[var(--surface)] p-10 text-center"
        style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)', color: 'var(--muted-fg)', fontSize: '14px' }}
      >
        Carregando o questionário…
      </div>
    )
  }

  const isLast = step === QUESTIONNAIRE_STEPS - 1
  const progressPct = ((step + 1) / QUESTIONNAIRE_STEPS) * 100

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      {/* Progress */}
      <div className="mb-6">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C6943A' }}>
            Passo {step + 1} de {QUESTIONNAIRE_STEPS}
          </span>
        </div>
        <div style={{ height: '4px', borderRadius: '99px', background: '#EBDDD0', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%', borderRadius: '99px',
              background: 'linear-gradient(90deg, #E0B870, #9A7020)',
              width: `${progressPct}%`,
              transition: 'width 0.35s ease',
            }}
          />
        </div>
      </div>

      {/* Back */}
      <button
        onClick={() => (step > 0 ? setStep((s) => s - 1) : router.push('/checklist'))}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          fontSize: '13.5px', color: '#9A7A60', border: 'none',
          background: 'none', cursor: 'pointer', marginBottom: '14px', padding: 0,
        }}
      >
        <BackIcon /> {step > 0 ? 'Voltar' : 'Voltar para o Checklist'}
      </button>

      <QuestionnaireWizard
        step={step}
        answers={answers}
        onAnswersChange={setAnswers}
        onNext={isLast ? finish : () => setStep((s) => s + 1)}
        nextLabel={isLast ? (saving ? 'Gerando seu checklist…' : 'Gerar meu checklist →') : 'Continuar'}
        nextDisabled={isLast && saving}
      />

      {error && (
        <p style={{ fontSize: '13.5px', color: '#C0553F', background: '#FBEEE6', padding: '10px 14px', borderRadius: '10px', marginTop: '16px' }}>
          {error}
        </p>
      )}
    </div>
  )
}
