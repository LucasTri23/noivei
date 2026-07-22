'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import DatePicker from '@/components/ui/date-picker'
import QuestionnaireWizard, {
  QUESTIONNAIRE_STEPS,
  StepTitle,
  NextButton,
} from '@/components/checklist/questionnaire-wizard'
import { DEFAULT_ANSWERS, deriveFacts, type WeddingAnswers } from '@/lib/checklist/facts'
import { generateChecklistItems } from '@/lib/checklist/generate'
import { generateFreeChecklistItems } from '@/lib/checklist/generate-free'
import { isPaidPlan } from '@/constants/plans'
import { getUserWedding } from '@/lib/weddings/get-user-wedding'
import { toastError } from '@/store/toast.store'

interface IbgeMunicipio {
  nome: string
  microrregiao: { mesorregiao: { UF: { sigla: string } } }
}

type PlanChoice = 'free' | 'premium_monthly' | 'premium_plus_once'

interface FormData {
  brideName:  string
  groomName:  string
  date:       string
  city:       string
  guests:     string
  plan:       PlanChoice
}

// Passos fixos: nomes · data e cidade · convidados · plano.
// Plano Gratuito termina aqui (checklist fixa); planos pagos seguem para as
// 6 etapas do questionário de personalização (QuestionnaireWizard).
const BASE_STEPS = 4
const PLAN_STEP  = BASE_STEPS - 1

// Q3 → weddings.budget (centavos), para a aba Financeiro nascer com o orçamento da faixa
// escolhida (refinável depois em Perfil > Dados do casamento). Faixas fechadas usam o teto
// ("até 30" → 30 mil) ou o ponto médio; a faixa aberta usa o piso (150 mil).
const BUDGET_RANGE_CENTS: Record<WeddingAnswers['orcamento'], number | null> = {
  ate_30:   3_000_000,
  '30_80':  5_500_000,
  '80_150': 11_500_000,
  '150_mais': 15_000_000,
  nao_sei:  null,
}

const PLANS: { id: PlanChoice; name: string; price: string; desc: string; features: string[]; highlight: boolean }[] = [
  {
    id: 'free',
    name: 'Gratuito',
    price: 'R$ 0',
    desc: 'Ideal para conhecer a plataforma',
    highlight: false,
    features: ['Checklist', 'Timeline', 'Até 50 convidados', 'Dashboard básico'],
  },
  {
    id: 'premium_monthly',
    name: 'Premium',
    price: 'R$ 29,90/mês',
    desc: 'Esse é o plano que a maioria dos casais escolhe',
    highlight: true,
    features: ['Checklist inteligente', 'Até 250 convidados', 'Site do casal', 'Organização de mesas', 'Financeiro completo', 'RSVP ilimitado'],
  },
  {
    id: 'premium_plus_once',
    name: 'Premium Plus',
    price: 'R$ 299 único',
    desc: 'Tudo liberado, IA completa, mais armazenamento e personalização',
    highlight: false,
    features: ['Tudo do Premium', 'Convidados ilimitados', 'IA completa', 'Suporte prioritário'],
  },
]

// ── Ícones ──

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>
    </svg>
  )
}
function HeartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C6943A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  )
}
function MapPinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9A7A60" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  )
}
function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9A7A60" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}
function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

// ── Estilos ──

const inputStyle = {
  display: 'flex', alignItems: 'center', gap: '12px',
  border: '1.5px solid #EBDDD0', borderRadius: '12px', padding: '13px 15px',
  background: '#FFFFFF',
} as React.CSSProperties

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep]       = useState(0)
  const [loading, setLoading] = useState(false)
  const [cities, setCities]   = useState<string[]>([])
  const [data, setData]       = useState<FormData>({
    brideName: '',
    groomName: '',
    date:      '',
    city:      '',
    guests:    '',
    plan:      'free',
  })
  const [answers, setAnswers] = useState<WeddingAnswers>(DEFAULT_ANSWERS)

  function set<K extends keyof FormData>(key: K, val: FormData[K]) {
    setData((d) => ({ ...d, [key]: val }))
  }

  // Carrega a lista de cidades do IBGE uma vez, para autocompletar o campo "Cidade"
  useEffect(() => {
    fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios')
      .then((res) => res.json())
      .then((municipios: IbgeMunicipio[]) => {
        setCities(municipios.map((m) => `${m.nome} - ${m.microrregiao.mesorregiao.UF.sigla}`))
      })
      .catch(() => setCities([]))
  }, [])

  // Quem já é dono ou membro de um casamento (ex: acabou de aceitar um convite) não
  // deve ver o wizard — evita criar um segundo casamento sem querer via URL direta.
  useEffect(() => {
    let cancelled = false
    const supabase = createSupabaseBrowser()

    async function checkExistingWedding() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const wedding = await getUserWedding(supabase, user.id)
      if (!cancelled && wedding) router.replace('/dashboard')
    }

    checkExistingWedding()
    return () => { cancelled = true }
  }, [router])

  const paidPlan = isPaidPlan(data.plan)
  // A numeração "Passo X de Y" varia com o plano: Gratuito termina na escolha do
  // plano; pago segue pelas 6 etapas do questionário.
  const totalSteps = paidPlan ? BASE_STEPS + QUESTIONNAIRE_STEPS : BASE_STEPS
  const lastQuestionnaireStep = BASE_STEPS + QUESTIONNAIRE_STEPS - 1

  async function finish() {
    setLoading(true)
    const supabase = createSupabaseBrowser()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const coupleNames = [data.brideName, data.groomName].filter(Boolean).join(' & ') || 'Meu Casamento'
    const guestsNum   = Number.parseInt(data.guests, 10)
    const convidados  = Number.isFinite(guestsNum) && guestsNum > 0 ? guestsNum : null
    // Plano Gratuito não passa pelo questionário — respostas ficam no default.
    const finalAnswers: WeddingAnswers = paidPlan
      ? { ...answers, convidados }
      : { ...DEFAULT_ANSWERS, convidados }
    const weddingDate = data.date || null

    const { data: wedding, error: weddingError } = await supabase
      .from('weddings')
      .insert({
        user_id:      user.id,
        couple_names: coupleNames,
        bride_name:   data.brideName || null,
        groom_name:   data.groomName || null,
        wedding_date: weddingDate,
        city:         data.city || null,
        // Conexões com outras abas: Q3 alimenta o Financeiro (weddings.budget) e
        // Q2 alimenta Convidados (weddings.guest_limit) — refináveis depois no Perfil.
        budget:       BUDGET_RANGE_CENTS[finalAnswers.orcamento],
        ...(convidados !== null ? { guest_limit: convidados } : {}),
      })
      .select('id')
      .single()

    // Sem essa checagem, uma falha aqui (RLS, migration não aplicada, coluna
    // faltando etc.) passava batido: o código seguia direto pro router.push
    // no final, o dashboard via que não existe casamento e mandava de volta pro
    // onboarding — que reinicia do zero (todas as respostas digitadas se perdem),
    // dando a impressão de "voltou pra primeira pergunta" sem explicar o motivo.
    if (weddingError || !wedding) {
      // Detalhe fica só no console (debug) — nunca expor erro cru do banco na UI.
      console.error('[onboarding] falha ao criar casamento:', weddingError)
      setLoading(false)
      toastError('Não foi possível criar o seu casamento. Tente novamente em instantes.')
      return
    }

    if (paidPlan) {
      await supabase.from('wedding_preferences').insert({
        wedding_id: wedding.id,
        answers:    finalAnswers,
      })

      try {
        const facts = deriveFacts(finalAnswers, weddingDate)
        await generateChecklistItems(supabase, wedding.id, facts, weddingDate)
      } catch {
        // Checklist pode ser gerado depois em /checklist — não bloqueia a entrada no dashboard
      }
    } else {
      try {
        await generateFreeChecklistItems(supabase, wedding.id)
      } catch {
        // Checklist pode ser gerado depois em /checklist — não bloqueia a entrada no dashboard
      }
    }

    // Cadastro cria assinatura gratuita via trigger — plano pago atualiza a existente
    // (mesmo padrão simulado do PlanSelector; gateway real é escopo da Fase 2).
    // O casamento já foi criado com sucesso acima — uma falha só nesta parte não deve
    // travar a entrada no dashboard, só avisar que o plano precisa ser escolhido de novo.
    if (paidPlan) {
      try {
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (subscription) {
          await supabase.from('subscriptions').update({ plan_id: data.plan }).eq('id', subscription.id)
        } else {
          await supabase.from('subscriptions').insert({ user_id: user.id, plan_id: data.plan, status: 'active' })
        }
      } catch {
        toastError('Seu casamento foi criado, mas não foi possível ativar o plano pago agora — escolha de novo em Perfil > Planos.')
      }
    }

    router.push('/dashboard')
  }

  const progressPct = ((step + 1) / totalSteps) * 100
  const finishLabel = loading ? 'Criando seu espaço…' : 'Começar a planejar →'

  return (
    <div>
      {/* Progress */}
      <div className="mb-6">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C6943A' }}>
            Passo {step + 1} de {totalSteps}
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

      {/* Back button */}
      {step > 0 && (
        <button
          onClick={() => setStep((s) => s - 1)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            fontSize: '13.5px', color: '#9A7A60', border: 'none',
            background: 'none', cursor: 'pointer', marginBottom: '14px', padding: 0,
          }}
        >
          <BackIcon /> Voltar
        </button>
      )}

      {/* ── STEP 1: Nomes ── */}
      {step === 0 && (
        <div>
          <StepTitle title="Quem são os noivos?" subtitle="Vamos personalizar o seu espaço no Wednest." />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            <div style={inputStyle}>
              <HeartIcon />
              <input
                value={data.brideName}
                onChange={(e) => set('brideName', e.target.value)}
                placeholder="Nome da noiva"
                style={{ border: 'none', outline: 'none', fontSize: '15px', color: '#3C2818', width: '100%', background: 'transparent' }}
              />
            </div>
            <div style={inputStyle}>
              <HeartIcon />
              <input
                value={data.groomName}
                onChange={(e) => set('groomName', e.target.value)}
                placeholder="Nome do noivo"
                style={{ border: 'none', outline: 'none', fontSize: '15px', color: '#3C2818', width: '100%', background: 'transparent' }}
              />
            </div>
          </div>

          <NextButton onClick={() => setStep(1)} />
        </div>
      )}

      {/* ── STEP 2: Data e cidade ── */}
      {step === 1 && (
        <div>
          <StepTitle title="Quando e onde?" subtitle="A data e a cidade do grande dia." />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#3C2818', marginBottom: '8px' }}>
                Quando será o casamento? (deixe em branco se ainda não decidiram)
              </div>
              <DatePicker
                value={data.date}
                onChange={(value) => set('date', value)}
                placeholder="Data do casamento"
              />
            </div>

            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#3C2818', marginBottom: '8px' }}>
                Em qual cidade?
              </div>
              <div style={inputStyle}>
                <MapPinIcon />
                <input
                  list="cities-list"
                  value={data.city}
                  onChange={(e) => set('city', e.target.value)}
                  placeholder="Cidade do casamento"
                  style={{ border: 'none', outline: 'none', fontSize: '15px', color: '#3C2818', width: '100%', background: 'transparent' }}
                />
                <datalist id="cities-list">
                  {cities.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
            </div>
          </div>

          <NextButton onClick={() => setStep(2)} />
        </div>
      )}

      {/* ── STEP 3: Convidados ── */}
      {step === 2 && (
        <div>
          <StepTitle title="Quantos convidados?" subtitle="Uma estimativa já ajuda a dimensionar tudo." />

          <div style={{ marginBottom: '24px' }}>
            <div style={inputStyle}>
              <UsersIcon />
              <input
                type="number"
                min="1"
                max="2000"
                value={data.guests}
                onChange={(e) => set('guests', e.target.value)}
                placeholder="Ex: 150"
                style={{ border: 'none', outline: 'none', fontSize: '15px', color: '#3C2818', width: '100%', background: 'transparent' }}
              />
            </div>
          </div>

          <NextButton onClick={() => setStep(3)} />
        </div>
      )}

      {/* ── STEP 4: Plano ── */}
      {step === PLAN_STEP && (
        <div>
          <StepTitle title="Escolha seu plano" subtitle="Você pode mudar de plano quando quiser." />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            {PLANS.map((plan) => {
              const active = data.plan === plan.id
              return (
                <button
                  key={plan.id}
                  onClick={() => set('plan', plan.id)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: '14px',
                    padding: '14px 16px', borderRadius: '14px', textAlign: 'left',
                    border: `1.5px solid ${active ? '#C6943A' : '#EBDDD0'}`,
                    background: active ? '#FBF5EE' : '#FFFFFF',
                    cursor: 'pointer', transition: 'all 0.18s',
                    boxShadow: active ? '0 4px 14px rgba(198,148,58,0.16)' : 'none',
                  }}
                >
                  {/* Radio */}
                  <div
                    style={{
                      width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, marginTop: '2px',
                      border: `2px solid ${active ? '#C6943A' : '#D8C6A6'}`,
                      background: active ? '#C6943A' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {active && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fff' }} />}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '14.5px', fontWeight: 700, color: active ? '#3C2818' : '#3C2818' }}>
                        {plan.name}
                      </span>
                      {plan.highlight && (
                        <span style={{
                          fontSize: '10px', fontWeight: 700, padding: '1px 8px',
                          borderRadius: '99px', background: '#C6943A', color: '#fff',
                          letterSpacing: '0.06em',
                        }}>
                          POPULAR
                        </span>
                      )}
                      <span style={{ marginLeft: 'auto', fontSize: '13px', fontWeight: 700, color: '#C6943A' }}>
                        {plan.price}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#9A7A60', marginBottom: '6px' }}>{plan.desc}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {plan.features.slice(0, 2).map((f) => (
                        <span key={f} style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          fontSize: '11px', color: '#9A7020', background: '#F1E6D4',
                          padding: '2px 8px', borderRadius: '99px',
                        }}>
                          <CheckIcon />{f}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {paidPlan && (
            <p style={{ fontSize: '12.5px', color: '#9A7A60', margin: '0 0 14px' }}>
              A seguir, 6 etapas rápidas para personalizar o seu checklist inteligente.
            </p>
          )}

          <NextButton
            onClick={paidPlan ? () => setStep(BASE_STEPS) : finish}
            disabled={loading}
            label={paidPlan ? 'Continuar' : finishLabel}
          />
        </div>
      )}

      {/* ── STEPS 5–10 (planos pagos): questionário de personalização Q1–Q24 ── */}
      {step >= BASE_STEPS && (
        <QuestionnaireWizard
          step={step - BASE_STEPS}
          answers={answers}
          onAnswersChange={setAnswers}
          onNext={step === lastQuestionnaireStep ? finish : () => setStep((s) => s + 1)}
          nextLabel={step === lastQuestionnaireStep ? finishLabel : 'Continuar'}
          nextDisabled={step === lastQuestionnaireStep && loading}
        />
      )}
    </div>
  )
}
