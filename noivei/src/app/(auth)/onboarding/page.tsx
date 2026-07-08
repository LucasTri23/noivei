'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import DatePicker from '@/components/ui/date-picker'
import { DEFAULT_ANSWERS, deriveFacts, type WeddingAnswers } from '@/lib/checklist/facts'
import { generateChecklistItems } from '@/lib/checklist/generate'

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

// Passos: nomes · grande dia · cerimônia · festa · fornecedores · trajes e convites · depois do sim · plano
const TOTAL_STEPS = 8

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
    features: ['Tudo do Gratuito', 'Até 250 convidados', 'Site do casal', 'Organização de mesas', 'Financeiro completo', 'RSVP ilimitado'],
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

// ── Opções do questionário (§3 do doc de regras) ──

type Option<T extends string> = { val: T; label: string }

const ORCAMENTO_OPTS: Option<WeddingAnswers['orcamento']>[] = [
  { val: 'ate_30',   label: 'Até R$ 30 mil' },
  { val: '30_80',    label: 'R$ 30–80 mil' },
  { val: '80_150',   label: 'R$ 80–150 mil' },
  { val: '150_mais', label: 'R$ 150 mil+' },
  { val: 'nao_sei',  label: 'Ainda não sabemos' },
]
const ORGANIZACAO_OPTS: Option<WeddingAnswers['organizacao']>[] = [
  { val: 'so_nos',      label: 'Só nós dois' },
  { val: 'com_familia', label: 'Com ajuda de família/amigos' },
]
const ASSESSORIA_OPTS: Option<WeddingAnswers['assessoria']>[] = [
  { val: 'completa', label: 'Assessoria completa' },
  { val: 'dia',      label: 'Só "assessoria do dia"' },
  { val: 'nao',      label: 'Não vamos contratar' },
  { val: 'nao_sei',  label: 'Ainda não sabemos' },
]
const CIVIL_OPTS: Option<WeddingAnswers['civil']>[] = [
  { val: 'cartorio',   label: 'No cartório' },
  { val: 'no_local',   label: 'Civil no local da festa' },
  { val: 'ja_casados', label: 'Já somos casados no civil' },
  { val: 'sem_civil',  label: 'Não teremos civil agora' },
  { val: 'nao_sei',    label: 'Ainda não sabemos' },
]
const CERIMONIA_OPTS: Option<WeddingAnswers['cerimonia']>[] = [
  { val: 'catolica',       label: 'Católica' },
  { val: 'outra_religiao', label: 'Evangélica ou outra religião' },
  { val: 'simbolica',      label: 'Celebrante simbólico' },
  { val: 'nao',            label: 'Não teremos' },
  { val: 'nao_sei',        label: 'Ainda não sabemos' },
]
const LOCAL_OPTS: Option<WeddingAnswers['local']>[] = [
  { val: 'espaco_cidade', label: 'Espaço de eventos na nossa cidade' },
  { val: 'campo',         label: 'Campo ou fazenda' },
  { val: 'praia',         label: 'Praia' },
  { val: 'casa',          label: 'Em casa' },
  { val: 'outra_cidade',  label: 'Outra cidade' },
  { val: 'outro_pais',    label: 'Outro país' },
  { val: 'nao_sei',       label: 'Ainda não sabemos' },
]
const REGIME_OPTS: Option<WeddingAnswers['regime_bens']>[] = [
  { val: 'comunhao_parcial', label: 'Comunhão parcial (padrão)' },
  { val: 'outro',            label: 'Outro regime' },
  { val: 'nao_sei',          label: 'Ainda não sabemos' },
]
const SOBRENOME_OPTS: Option<WeddingAnswers['alterar_sobrenome']>[] = [
  { val: 'sim',     label: 'Sim' },
  { val: 'nao',     label: 'Não' },
  { val: 'nao_sei', label: 'Ainda não sabemos' },
]
const RECEPCAO_OPTS: Option<WeddingAnswers['recepcao']>[] = [
  { val: 'festa_pista', label: 'Festa completa com pista' },
  { val: 'sem_pista',   label: 'Recepção sem pista (almoço/jantar)' },
  { val: 'nao',         label: 'Não teremos recepção' },
  { val: 'nao_sei',     label: 'Ainda não sabemos' },
]
const MUSICA_OPTS: Option<WeddingAnswers['musica']>[] = [
  { val: 'dj',       label: 'DJ' },
  { val: 'banda',    label: 'Banda' },
  { val: 'dj_banda', label: 'DJ + banda' },
  { val: 'playlist', label: 'Playlist própria' },
  { val: 'nao_sei',  label: 'Ainda não sabemos' },
]
const BEBIDAS_OPTS: Option<WeddingAnswers['bebidas']>[] = [
  { val: 'open_bar',   label: 'Open bar completo' },
  { val: 'simples',    label: 'Cerveja, vinho e drinks simples' },
  { val: 'sem_alcool', label: 'Sem álcool' },
  { val: 'nao_sei',    label: 'Ainda não sabemos' },
]
const CRIANCAS_OPTS: Option<WeddingAnswers['criancas']>[] = [
  { val: 'muitas',  label: 'Sim, muitas' },
  { val: 'algumas', label: 'Algumas' },
  { val: 'nao',     label: 'Não (festa só para adultos)' },
  { val: 'nao_sei', label: 'Ainda não sabemos' },
]
const CORTEJO_OPTS: Option<WeddingAnswers['cortejo'][number]>[] = [
  { val: 'padrinhos',       label: 'Padrinhos e madrinhas' },
  { val: 'daminhas_pajens', label: 'Daminhas e pajens' },
]
const FORNECEDORES_OPTS: Option<WeddingAnswers['fornecedores'][number]>[] = [
  { val: 'buffet',                label: 'Buffet' },
  { val: 'fotografia',            label: 'Fotografia' },
  { val: 'filmagem',              label: 'Filmagem' },
  { val: 'doces',                 label: 'Doces e bem-casados' },
  { val: 'bolo',                  label: 'Bolo' },
  { val: 'flores_decoracao',      label: 'Flores e decoração' },
  { val: 'carro_cerimonia',       label: 'Carro da cerimônia' },
  { val: 'cabine_fotos',          label: 'Cabine de fotos' },
  { val: 'iluminacao_cenica',     label: 'Iluminação cênica' },
  { val: 'som_estrutura',         label: 'Som e estrutura' },
  { val: 'beleza',                label: 'Beleza (cabelo e maquiagem)' },
  { val: 'transporte_convidados', label: 'Transporte de convidados' },
]
const TRAJE_OPTS: Option<WeddingAnswers['traje_noiva']>[] = [
  { val: 'sob_medida', label: 'Sob medida' },
  { val: 'pronto',     label: 'Pronto (comprar)' },
  { val: 'alugado',    label: 'Alugado' },
  { val: 'nao_sei',    label: 'Ainda não sei' },
]
const SIM_NAO_OPTS: Option<'sim' | 'nao' | 'nao_sei'>[] = [
  { val: 'sim',     label: 'Sim' },
  { val: 'nao',     label: 'Não' },
  { val: 'nao_sei', label: 'Ainda não sabemos' },
]
const CONVITES_OPTS: Option<WeddingAnswers['convites']>[] = [
  { val: 'impressos', label: 'Impressos' },
  { val: 'digitais',  label: 'Digitais' },
  { val: 'os_dois',   label: 'Os dois' },
  { val: 'nao_sei',   label: 'Ainda não sabemos' },
]
const RSVP_OPTS: Option<WeddingAnswers['rsvp']>[] = [
  { val: 'online',  label: 'Online (site/WhatsApp)' },
  { val: 'manual',  label: 'Manual (telefone/pessoalmente)' },
  { val: 'nao_sei', label: 'Ainda não sabemos' },
]
const LUA_DE_MEL_OPTS: Option<WeddingAnswers['lua_de_mel']>[] = [
  { val: 'internacional', label: 'Internacional' },
  { val: 'nacional',      label: 'Nacional' },
  { val: 'adiar',         label: 'Vamos adiar (minimoon depois)' },
  { val: 'nao',           label: 'Não teremos' },
  { val: 'nao_sei',       label: 'Ainda não sabemos' },
]
const MOMENTOS_OPTS: Option<WeddingAnswers['momentos'][number]>[] = [
  { val: 'making_of',  label: 'Making of' },
  { val: 'first_look', label: 'First look' },
  { val: 'votos',      label: 'Votos personalizados' },
]
const EVENTOS_OPTS: Option<WeddingAnswers['eventos'][number]>[] = [
  { val: 'cha_panela',    label: 'Chá de panela' },
  { val: 'cha_bar',       label: 'Chá bar ou chá de casa nova' },
  { val: 'despedida',     label: 'Despedida de solteiro(a)' },
  { val: 'jantar_ensaio', label: 'Jantar de ensaio' },
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

// ── Estilos e blocos reutilizáveis ──

const inputStyle = {
  display: 'flex', alignItems: 'center', gap: '12px',
  border: '1.5px solid #EBDDD0', borderRadius: '12px', padding: '13px 15px',
  background: '#FFFFFF',
} as React.CSSProperties

function pillStyle(active: boolean): React.CSSProperties {
  return {
    padding: '10px 14px', borderRadius: '12px',
    border: `1.5px solid ${active ? '#C6943A' : '#EBDDD0'}`,
    background: active ? '#FBF5EE' : '#FFFFFF',
    color: active ? '#9A7020' : '#9A7A60',
    fontWeight: active ? 700 : 500, fontSize: '13.5px',
    cursor: 'pointer', transition: 'all 0.18s', textAlign: 'left',
  }
}

function Question({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '13px', fontWeight: 600, color: '#3C2818', marginBottom: '8px' }}>{label}</div>
      {children}
    </div>
  )
}

function ChoiceGroup<T extends string>({ options, value, onChange }: {
  options: Option<T>[]
  value: T
  onChange: (val: T) => void
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      {options.map((opt) => (
        <button key={opt.val} type="button" onClick={() => onChange(opt.val)} style={pillStyle(value === opt.val)}>
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function MultiGroup<T extends string>({ options, values, onToggle, onClear, noneLabel }: {
  options: Option<T>[]
  values: readonly T[]
  onToggle: (val: T) => void
  onClear?: () => void
  noneLabel?: string
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      {options.map((opt) => (
        <button key={opt.val} type="button" onClick={() => onToggle(opt.val)} style={pillStyle(values.includes(opt.val))}>
          {opt.label}
        </button>
      ))}
      {noneLabel && onClear && (
        <button type="button" onClick={onClear} style={pillStyle(values.length === 0)}>
          {noneLabel}
        </button>
      )}
    </div>
  )
}

function StepTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <>
      <h1 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(26px,3.4vw,34px)', margin: '0 0 4px', color: '#3C2818' }}>
        {title}
      </h1>
      <p style={{ fontSize: '14px', color: '#9A7A60', margin: '0 0 24px' }}>{subtitle}</p>
    </>
  )
}

function NextButton({ onClick, label = 'Continuar', disabled = false }: { onClick: () => void; label?: string; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%', background: '#C6943A', color: '#fff', border: 'none',
        borderRadius: '12px', padding: '15px', fontWeight: 600, fontSize: '15px',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.7 : 1,
        boxShadow: '0 10px 24px rgba(198,148,58,0.32)',
      }}
    >
      {label}
    </button>
  )
}

type MultiKey = 'cortejo' | 'fornecedores' | 'momentos' | 'eventos'

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

  function setAnswer<K extends keyof WeddingAnswers>(key: K, val: WeddingAnswers[K]) {
    setAnswers((a) => ({ ...a, [key]: val }))
  }

  function toggleMulti(key: MultiKey, val: string) {
    setAnswers((a) => {
      const arr  = a[key] as string[]
      const next = arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]
      return { ...a, [key]: next } as WeddingAnswers
    })
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

  async function finish() {
    setLoading(true)
    const supabase = createSupabaseBrowser()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const coupleNames = [data.brideName, data.groomName].filter(Boolean).join(' & ') || 'Meu Casamento'
    const guestsNum   = Number.parseInt(data.guests, 10)
    const convidados  = Number.isFinite(guestsNum) && guestsNum > 0 ? guestsNum : null
    const finalAnswers: WeddingAnswers = { ...answers, convidados }
    const weddingDate = data.date || null

    const { data: wedding } = await supabase
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
        budget:       BUDGET_RANGE_CENTS[answers.orcamento],
        ...(convidados !== null ? { guest_limit: convidados } : {}),
      })
      .select('id')
      .single()

    if (wedding) {
      await supabase.from('wedding_preferences').insert({
        wedding_id: wedding.id,
        answers:    finalAnswers,
      })

      try {
        const facts = deriveFacts(finalAnswers, weddingDate)
        await generateChecklistItems(supabase, wedding.id, facts, weddingDate)
      } catch {
        // Checklist pode ser regenerado depois — não bloqueia a entrada no dashboard
      }
    }

    router.push('/dashboard')
  }

  const progressPct = ((step + 1) / TOTAL_STEPS) * 100
  const stack: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }

  return (
    <div>
      {/* Progress */}
      <div className="mb-6">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C6943A' }}>
            Passo {step + 1} de {TOTAL_STEPS}
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

      {/* ── STEP 2: Sobre o grande dia (Q1–Q5) ── */}
      {step === 1 && (
        <div>
          <StepTitle title="Sobre o grande dia" subtitle="Data, tamanho e quem organiza — a base de tudo." />

          <div style={stack}>
            <Question label="Quando será o casamento? (deixe em branco se ainda não decidiram)">
              <DatePicker
                value={data.date}
                onChange={(value) => set('date', value)}
                placeholder="Data do casamento"
              />
            </Question>

            <Question label="Em qual cidade?">
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
            </Question>

            <Question label="Quantos convidados vocês esperam?">
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
            </Question>

            <Question label="Qual a faixa de orçamento total?">
              <ChoiceGroup options={ORCAMENTO_OPTS} value={answers.orcamento} onChange={(v) => setAnswer('orcamento', v)} />
            </Question>

            <Question label="Quem participa da organização?">
              <ChoiceGroup options={ORGANIZACAO_OPTS} value={answers.organizacao} onChange={(v) => setAnswer('organizacao', v)} />
            </Question>

            <Question label="Vão contratar assessoria/cerimonial?">
              <ChoiceGroup options={ASSESSORIA_OPTS} value={answers.assessoria} onChange={(v) => setAnswer('assessoria', v)} />
            </Question>
          </div>

          <NextButton onClick={() => setStep(2)} />
        </div>
      )}

      {/* ── STEP 3: A cerimônia (Q6–Q10) ── */}
      {step === 2 && (
        <div>
          <StepTitle title="A cerimônia" subtitle="Civil, religiosa e o lugar do sim." />

          <div style={stack}>
            <Question label="Como será o casamento civil?">
              <ChoiceGroup options={CIVIL_OPTS} value={answers.civil} onChange={(v) => setAnswer('civil', v)} />
            </Question>

            <Question label="Terá cerimônia religiosa ou simbólica?">
              <ChoiceGroup options={CERIMONIA_OPTS} value={answers.cerimonia} onChange={(v) => setAnswer('cerimonia', v)} />
            </Question>

            <Question label="Onde será?">
              <ChoiceGroup options={LOCAL_OPTS} value={answers.local} onChange={(v) => setAnswer('local', v)} />
            </Question>

            <Question label="Vocês já sabem o regime de bens?">
              <ChoiceGroup options={REGIME_OPTS} value={answers.regime_bens} onChange={(v) => setAnswer('regime_bens', v)} />
            </Question>

            <Question label="Alguém vai alterar o sobrenome?">
              <ChoiceGroup options={SOBRENOME_OPTS} value={answers.alterar_sobrenome} onChange={(v) => setAnswer('alterar_sobrenome', v)} />
            </Question>
          </div>

          <NextButton onClick={() => setStep(3)} />
        </div>
      )}

      {/* ── STEP 4: A festa (Q11–Q15) ── */}
      {step === 3 && (
        <div>
          <StepTitle title="A festa" subtitle="Como vocês imaginam a celebração." />

          <div style={stack}>
            <Question label="Como será a recepção?">
              <ChoiceGroup options={RECEPCAO_OPTS} value={answers.recepcao} onChange={(v) => setAnswer('recepcao', v)} />
            </Question>

            <Question label="Música da festa">
              <ChoiceGroup options={MUSICA_OPTS} value={answers.musica} onChange={(v) => setAnswer('musica', v)} />
            </Question>

            <Question label="Bebidas">
              <ChoiceGroup options={BEBIDAS_OPTS} value={answers.bebidas} onChange={(v) => setAnswer('bebidas', v)} />
            </Question>

            <Question label="Crianças entre os convidados?">
              <ChoiceGroup options={CRIANCAS_OPTS} value={answers.criancas} onChange={(v) => setAnswer('criancas', v)} />
            </Question>

            <Question label="Terá cortejo? (marque todos que se aplicam)">
              <MultiGroup
                options={CORTEJO_OPTS}
                values={answers.cortejo}
                onToggle={(v) => toggleMulti('cortejo', v)}
                onClear={() => setAnswer('cortejo', [])}
                noneLabel="Nenhum"
              />
            </Question>
          </div>

          <NextButton onClick={() => setStep(4)} />
        </div>
      )}

      {/* ── STEP 5: Fornecedores (Q16) ── */}
      {step === 4 && (
        <div>
          <StepTitle title="Fornecedores" subtitle="O que vocês pretendem contratar? Marque todos que se aplicam." />

          <div style={{ marginBottom: '24px' }}>
            <MultiGroup
              options={FORNECEDORES_OPTS}
              values={answers.fornecedores}
              onToggle={(v) => toggleMulti('fornecedores', v)}
            />
            <p style={{ fontSize: '12.5px', color: '#9A7A60', marginTop: '10px' }}>
              DJ e banda já entram pela resposta de música. Cada item marcado gera as etapas de pesquisa, contrato e pagamento no seu checklist.
            </p>
          </div>

          <NextButton onClick={() => setStep(5)} />
        </div>
      )}

      {/* ── STEP 6: Trajes e convites (Q17–Q21) ── */}
      {step === 5 && (
        <div>
          <StepTitle title="Trajes e convites" subtitle="O visual do casal e o convite para os convidados." />

          <div style={stack}>
            <Question label="Vestido da noiva">
              <ChoiceGroup options={TRAJE_OPTS} value={answers.traje_noiva} onChange={(v) => setAnswer('traje_noiva', v)} />
            </Question>

            <Question label="Terno do noivo">
              <ChoiceGroup options={TRAJE_OPTS} value={answers.traje_noivo} onChange={(v) => setAnswer('traje_noivo', v)} />
            </Question>

            <Question label="Segundo traje para a festa?">
              <ChoiceGroup options={SIM_NAO_OPTS} value={answers.segundo_traje} onChange={(v) => setAnswer('segundo_traje', v)} />
            </Question>

            <Question label="Convites">
              <ChoiceGroup options={CONVITES_OPTS} value={answers.convites} onChange={(v) => setAnswer('convites', v)} />
            </Question>

            <Question label="Vão enviar save the date?">
              <ChoiceGroup options={SIM_NAO_OPTS} value={answers.save_the_date} onChange={(v) => setAnswer('save_the_date', v)} />
            </Question>

            <Question label="Como será a confirmação de presença (RSVP)?">
              <ChoiceGroup options={RSVP_OPTS} value={answers.rsvp} onChange={(v) => setAnswer('rsvp', v)} />
            </Question>
          </div>

          <NextButton onClick={() => setStep(6)} />
        </div>
      )}

      {/* ── STEP 7: Depois do sim (Q22–Q24) ── */}
      {step === 6 && (
        <div>
          <StepTitle title="Depois do sim" subtitle="Lua de mel, momentos especiais e celebrações ao redor." />

          <div style={stack}>
            <Question label="Lua de mel">
              <ChoiceGroup options={LUA_DE_MEL_OPTS} value={answers.lua_de_mel} onChange={(v) => setAnswer('lua_de_mel', v)} />
            </Question>

            <Question label="Momentos especiais no dia (marque todos que se aplicam)">
              <MultiGroup
                options={MOMENTOS_OPTS}
                values={answers.momentos}
                onToggle={(v) => toggleMulti('momentos', v)}
                onClear={() => setAnswer('momentos', [])}
                noneLabel="Nenhum"
              />
            </Question>

            <Question label="Eventos ao redor do casamento (marque todos que se aplicam)">
              <MultiGroup
                options={EVENTOS_OPTS}
                values={answers.eventos}
                onToggle={(v) => toggleMulti('eventos', v)}
                onClear={() => setAnswer('eventos', [])}
                noneLabel="Nenhum"
              />
            </Question>
          </div>

          <NextButton onClick={() => setStep(7)} />
        </div>
      )}

      {/* ── STEP 8: Plano ── */}
      {step === 7 && (
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

          <NextButton
            onClick={finish}
            disabled={loading}
            label={loading ? 'Criando seu espaço…' : 'Começar a planejar →'}
          />
        </div>
      )}
    </div>
  )
}
