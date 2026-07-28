'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import DatePicker from '@/components/ui/date-picker'
import QuestionnaireWizard, {
  QUESTIONNAIRE_STEPS,
  StepTitle,
  NextButton,
  ChoiceGroup,
  ORCAMENTO_OPTS,
  LOCAL_OPTS,
} from '@/components/checklist/questionnaire-wizard'
import { DEFAULT_ANSWERS, deriveFacts, type WeddingAnswers } from '@/lib/checklist/facts'
import { generateChecklistItems } from '@/lib/checklist/generate'
import { generateFreeChecklistItems } from '@/lib/checklist/generate-free'
import { getUserWedding } from '@/lib/weddings/get-user-wedding'
import { toastError, toastSuccess } from '@/store/toast.store'
import { effectiveGroupKey } from '@/lib/billing/plan-groups'
import { computeCouponPreview, type CouponPreviewLine } from '@/lib/billing/coupon-preview'
import PlanCardsGrid, { fillPlanVariantSelection, type PlanCardPlan } from '@/components/billing/plan-cards-grid'
import type { WeddingStyle, PlanFeature, PlanFeatureCategory, PlanFeatureValue } from '@/types/database'

const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

interface IbgeMunicipio {
  nome: string
  microrregiao: { mesorregiao: { UF: { sigla: string } } }
}

interface FormData {
  brideName:  string
  groomName:  string
  date:       string
  city:       string
  guests:     string
  plan:       string
  style:      WeddingStyle | ''
}

// Passos fixos: nomes · data e cidade · orçamento · estilo · local · convidados ·
// plano. Orçamento/estilo/local são perguntados pros dois planos (antes de escolher
// plano) mas são puláveis — cada um tem um link "Pular esta pergunta". Plano Gratuito
// termina no passo de plano (checklist fixa); planos pagos seguem para as 6 etapas do
// questionário de personalização (QuestionnaireWizard), que ainda perguntam orçamento/
// local de novo (pré-preenchido) — assim dá pra revisar a resposta depois em
// /checklist/personalizar, que reaproveita o mesmo wizard.
const BASE_STEPS = 7
const PLAN_STEP  = BASE_STEPS - 1

// Q3 → weddings.budget (centavos), pra aba Financeiro nascer com o orçamento da faixa
// escolhida (refinável depois em Perfil > Dados do casamento) — vale pros dois planos
// agora, já que orçamento é perguntado antes da escolha de plano. Faixas fechadas usam
// o teto ("até 30" → 30 mil) ou o ponto médio; a faixa aberta usa o piso (150 mil).
const BUDGET_RANGE_CENTS: Record<WeddingAnswers['orcamento'], number | null> = {
  ate_30:   3_000_000,
  '30_80':  5_500_000,
  '80_150': 11_500_000,
  '150_mais': 15_000_000,
  nao_sei:  null,
}

const STYLE_OPTS: { val: WeddingStyle; label: string }[] = [
  { val: 'rustico',     label: 'Rústico' },
  { val: 'classico',    label: 'Clássico' },
  { val: 'moderno',     label: 'Moderno' },
  { val: 'boho',        label: 'Boho' },
  { val: 'minimalista', label: 'Minimalista' },
  { val: 'romantico',   label: 'Romântico' },
  { val: 'outro',       label: 'Outro' },
]

function SkipLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'block', margin: '10px auto 0', background: 'none', border: 'none',
        color: '#9A7A60', fontSize: '13px', textDecoration: 'underline', cursor: 'pointer', padding: '4px',
      }}
    >
      Pular esta pergunta
    </button>
  )
}

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
    style:     '',
  })
  const [answers, setAnswers] = useState<WeddingAnswers>(DEFAULT_ANSWERS)

  // Catálogo de planos vem do banco (igual /perfil/planos) — nada fixo aqui, senão
  // o onboarding mostra planos/preços desatualizados assim que o admin editar algo
  // em /admin/planos. A tabela de comparação (categorias/linhas/valores) vem junto,
  // pra mostrar de verdade as diferenças entre os planos já na hora do cadastro.
  const [billingPlans, setBillingPlans]     = useState<PlanCardPlan[]>([])
  const [categories, setCategories]         = useState<PlanFeatureCategory[]>([])
  const [features, setFeatures]             = useState<PlanFeature[]>([])
  const [featureValues, setFeatureValues]   = useState<PlanFeatureValue[]>([])
  const [plansLoading, setPlansLoading]     = useState(true)
  const [selectedVariant, setSelectedVariant] = useState<Record<string, string>>({})
  const [couponCode, setCouponCode] = useState('')
  const [redeeming, setRedeeming]   = useState(false)
  const [couponPreview, setCouponPreview] = useState<CouponPreviewLine[]>([])

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

  // Carrega o catálogo de planos + comparação de recursos uma vez, em paralelo com
  // as cidades — mesmo padrão. Sem isso, na tela de plano do onboarding o casal não
  // via as diferenças reais entre os planos (só um resumo truncado e hardcoded).
  useEffect(() => {
    const supabase = createSupabaseBrowser()
    Promise.all([
      supabase
        .from('plans')
        .select('id, name, description, price_brl, group_key, billing_label, billing_note, emoji, highlight, billing_interval')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      supabase.from('plan_feature_categories').select('*').order('sort_order'),
      supabase.from('plan_features').select('*').order('sort_order'),
      supabase.from('plan_feature_values').select('*'),
    ]).then(([plansRes, categoriesRes, featuresRes, valuesRes]) => {
      const plansData = (plansRes.data ?? []) as PlanCardPlan[]
      setBillingPlans(plansData)
      setCategories((categoriesRes.data ?? []) as PlanFeatureCategory[])
      setFeatures((featuresRes.data ?? []) as PlanFeature[])
      setFeatureValues((valuesRes.data ?? []) as PlanFeatureValue[])
      setSelectedVariant((prev) => fillPlanVariantSelection(plansData, 'free', prev))
      setPlansLoading(false)
    })
  }, [])

  function onToggleVariant(groupKey: string, variantId: string) {
    setSelectedVariant((prev) => ({ ...prev, [groupKey]: variantId }))
    // Se o grupo trocado é o plano já escolhido, a troca de variante (mensal/único)
    // também deve atualizar a escolha de verdade — senão o toggle muda só o card
    // exibido, sem refletir no plano que `finish()` vai de fato contratar.
    setData((d) => {
      const chosenPlan = billingPlans.find((p) => p.id === d.plan)
      if (chosenPlan && effectiveGroupKey(chosenPlan) === groupKey) return { ...d, plan: variantId }
      return d
    })
  }

  // Mesmo endpoint/fluxo de /perfil/planos: só registra o resgate (coupon_redemptions),
  // sem cobrar nada agora — cupom percent/fixed é aplicado depois, no checkout do
  // Mercado Pago (fn_get_pending_coupon_discount); free_days concede o plano na hora,
  // dentro da própria fn_redeem_coupon.
  async function redeemCoupon() {
    if (!couponCode.trim()) return
    setRedeeming(true)
    setCouponPreview([])
    const res = await fetch('/api/v1/coupons/redeem', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ code: couponCode.trim() }),
    })
    const body = await res.json().catch(() => null)
    setRedeeming(false)

    if (!res.ok) {
      toastError(body?.error?.message ?? 'Não foi possível aplicar esse cupom.')
      return
    }
    toastSuccess(body?.data?.message ?? 'Cupom aplicado!')
    if (body?.data) setCouponPreview(computeCouponPreview(billingPlans, body.data))
    setCouponCode('')
  }

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

  const selectedPlanRow = billingPlans.find((p) => p.id === data.plan)
  const paidPlan = Boolean(selectedPlanRow && selectedPlanRow.price_brl > 0)
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
    // orçamento/local já são coletados no passo fixo (antes da escolha de plano) pros
    // dois planos — `answers` já carrega a resposta real (ou 'nao_sei' se pulou), sem
    // precisar de DEFAULT_ANSWERS pro Gratuito aqui. O resto das perguntas (Q4 em
    // diante) só existe pra quem passa pelo questionário completo (plano pago).
    const finalAnswers: WeddingAnswers = { ...answers, convidados }
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
        style:        data.style || null,
        // Conexões com outras abas: orçamento alimenta o Financeiro (weddings.budget) e
        // convidados alimenta Convidados (weddings.guest_limit) — refináveis depois no
        // Perfil. Vale pros dois planos, já que orçamento é perguntado antes do plano.
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
        const facts = deriveFacts(finalAnswers, weddingDate, data.style || null)
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

    // Casamento já foi criado com sucesso acima — plano pago NUNCA é ativado direto
    // aqui: passa pelo mesmo checkout do Mercado Pago que /perfil/planos usa, e só
    // fica 'active' de fato quando o webhook confirmar o pagamento. Sem isso, dava
    // pra "assinar" um plano pago no onboarding sem nunca ser cobrado.
    if (paidPlan) {
      const checkoutRes = await fetch('/api/v1/billing/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plan_id: data.plan }),
      })
      const checkoutBody = (await checkoutRes.json().catch(() => null)) as { data?: { redirect_url: string }; error?: { message: string } } | null

      if (!checkoutRes.ok || !checkoutBody?.data?.redirect_url) {
        toastError('Seu casamento foi criado! Não foi possível iniciar o pagamento agora — escolha o plano em Perfil > Planos quando quiser.')
        router.push('/dashboard')
        return
      }

      window.location.assign(checkoutBody.data.redirect_url)
      return
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

      {/* ── STEP 3: Orçamento (pulável, pros dois planos) ── */}
      {step === 2 && (
        <div>
          <StepTitle title="Qual a faixa de orçamento?" subtitle="Ajuda a estimar o financeiro do casamento — pode pular." />

          <div style={{ marginBottom: '24px' }}>
            <ChoiceGroup
              options={ORCAMENTO_OPTS}
              value={answers.orcamento}
              onChange={(v) => setAnswers((a) => ({ ...a, orcamento: v }))}
            />
          </div>

          <NextButton onClick={() => setStep(3)} />
          <SkipLink onClick={() => setStep(3)} />
        </div>
      )}

      {/* ── STEP 4: Estilo do casamento (pulável, pros dois planos) ── */}
      {step === 3 && (
        <div>
          <StepTitle title="Qual o estilo do casamento?" subtitle="Ajuda a personalizar o restante do checklist — pode pular." />

          <div style={{ marginBottom: '24px' }}>
            <ChoiceGroup
              options={STYLE_OPTS}
              value={data.style}
              onChange={(v) => set('style', v)}
            />
          </div>

          <NextButton onClick={() => setStep(4)} />
          <SkipLink onClick={() => setStep(4)} />
        </div>
      )}

      {/* ── STEP 5: Local (pulável, pros dois planos) ── */}
      {step === 4 && (
        <div>
          <StepTitle title="Onde será?" subtitle="Ajuda a saber que tipo de fornecedor buscar — pode pular." />

          <div style={{ marginBottom: '24px' }}>
            <ChoiceGroup
              options={LOCAL_OPTS}
              value={answers.local}
              onChange={(v) => setAnswers((a) => ({ ...a, local: v }))}
            />
          </div>

          <NextButton onClick={() => setStep(5)} />
          <SkipLink onClick={() => setStep(5)} />
        </div>
      )}

      {/* ── STEP 6: Convidados ── */}
      {step === 5 && (
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

          <NextButton onClick={() => setStep(6)} />
        </div>
      )}

      {/* ── STEP 7: Plano ── */}
      {step === PLAN_STEP && (
        <div>
          <StepTitle title="Escolha seu plano" subtitle="Compare os planos abaixo — você pode mudar quando quiser." />

          {plansLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9A7A60', fontSize: '14px' }}>
              Carregando planos…
            </div>
          ) : (
            <div style={{ marginBottom: '20px' }}>
              <PlanCardsGrid
                plans={billingPlans}
                categories={categories}
                features={features}
                values={featureValues}
                selectedVariant={selectedVariant}
                onToggleVariant={onToggleVariant}
                isActive={(plan) => plan.id === data.plan}
                actionDisabled={() => false}
                actionLabel={(plan, active) => (active ? 'Selecionado' : plan.price_brl === 0 ? 'Escolher Gratuito' : 'Escolher')}
                onAction={(plan) => set('plan', plan.id)}
              />
            </div>
          )}

          {paidPlan && (
            <p style={{ fontSize: '12.5px', color: '#9A7A60', margin: '0 0 14px' }}>
              A seguir, 6 etapas rápidas para personalizar o seu checklist inteligente. O pagamento é feito na próxima tela, direto com o Mercado Pago.
            </p>
          )}

          {/* Cupom — mesmo endpoint de /perfil/planos, disponível já no onboarding */}
          <div
            className="rounded-2xl"
            style={{
              background: '#FFFFFF', border: '1.5px solid #EBDDD0', borderRadius: '16px', padding: '16px',
              display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '20px',
            }}
          >
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label htmlFor="onboarding-coupon" style={{ fontSize: '13px', fontWeight: 600, color: '#3C2818', display: 'block', marginBottom: '6px' }}>
                Tenho um cupom
              </label>
              <input
                id="onboarding-coupon"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="Ex: BEMVINDO10"
                style={{
                  border: '1.5px solid #EBDDD0', borderRadius: '12px', padding: '11px 14px',
                  fontSize: '14px', color: '#3C2818', outline: 'none', width: '100%',
                }}
              />
            </div>
            <button
              type="button"
              disabled={redeeming || !couponCode.trim()}
              onClick={redeemCoupon}
              style={{
                border: 'none', borderRadius: '12px', padding: '12px 20px', fontWeight: 700, fontSize: '14px',
                background: '#C6943A', color: '#fff',
                cursor: redeeming || !couponCode.trim() ? 'not-allowed' : 'pointer',
                opacity: redeeming || !couponCode.trim() ? 0.6 : 1,
              }}
            >
              {redeeming ? 'Aplicando…' : 'Aplicar cupom'}
            </button>

            {couponPreview.length > 0 && (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                {couponPreview.map((line) => (
                  <div key={line.planId} style={{ fontSize: '13px', color: '#3C2818' }}>
                    <strong>{line.planLabel}</strong>:{' '}
                    <span style={{ textDecoration: 'line-through', color: '#9A7A60' }}>
                      {currencyFmt.format(line.priceBefore / 100)}
                    </span>{' '}
                    <span style={{ fontWeight: 700, color: '#C6943A' }}>
                      {currencyFmt.format(line.priceAfter / 100)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <NextButton
            onClick={paidPlan ? () => setStep(BASE_STEPS) : finish}
            disabled={loading || plansLoading}
            label={paidPlan ? 'Continuar' : finishLabel}
          />
        </div>
      )}

      {/* ── STEPS 8–13 (planos pagos): questionário de personalização Q1–Q24 ── */}
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
