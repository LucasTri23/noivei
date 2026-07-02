'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase/browser'

interface IbgeMunicipio {
  nome: string
  microrregiao: { mesorregiao: { UF: { sigla: string } } }
}

type PlanChoice = 'free' | 'premium_monthly' | 'premium_plus_monthly'

interface FormData {
  partner1:   string
  partner2:   string
  date:       string
  city:       string
  guests:     string
  hasVenue:   boolean | null
  plan:       PlanChoice
}

const TOTAL_STEPS = 4

const PLANS: { id: PlanChoice; name: string; price: string; desc: string; features: string[]; highlight: boolean }[] = [
  {
    id: 'free',
    name: 'Gratuito',
    price: 'R$ 0',
    desc: 'Para começar o planejamento',
    highlight: false,
    features: ['Checklist básico', 'Até 50 convidados', 'Timeline', 'Site do casal'],
  },
  {
    id: 'premium_monthly',
    name: 'Ideal',
    price: 'R$ 29/mês',
    desc: 'O mais escolhido pelos casais',
    highlight: true,
    features: ['Tudo do Gratuito', 'Convidados ilimitados', 'Organização de mesas', 'Financeiro completo', 'RSVP online'],
  },
  {
    id: 'premium_plus_monthly',
    name: 'Completo',
    price: 'R$ 49/mês',
    desc: 'Experiência sem limites',
    highlight: false,
    features: ['Tudo do Ideal', 'Múltiplos casamentos', 'Exportar relatórios', 'Suporte prioritário'],
  },
]

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
function CalIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9A7A60" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
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

const inputStyle = {
  display: 'flex', alignItems: 'center', gap: '12px',
  border: '1.5px solid #EBDDD0', borderRadius: '12px', padding: '13px 15px',
  background: '#FFFFFF',
} as React.CSSProperties

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep]     = useState(0)
  const [loading, setLoading] = useState(false)
  const [cities, setCities]   = useState<string[]>([])
  const [data, setData]     = useState<FormData>({
    partner1:  '',
    partner2:  '',
    date:      '',
    city:      '',
    guests:    '',
    hasVenue:  null,
    plan:      'free',
  })

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

  async function finish() {
    setLoading(true)
    const supabase = createSupabaseBrowser()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const coupleNames = [data.partner1, data.partner2].filter(Boolean).join(' & ') || 'Meu Casamento'

    await supabase.from('weddings').insert({
      user_id:      user.id,
      couple_names: coupleNames,
      wedding_date: data.date || null,
      city:         data.city || null,
    })

    router.push('/dashboard')
  }

  const progressPct = ((step + 1) / TOTAL_STEPS) * 100

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

      {/* ── STEP 1: Names ── */}
      {step === 0 && (
        <div>
          <h1 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(26px,3.4vw,34px)', margin: '0 0 4px', color: '#3C2818' }}>
            Quem são os noivos?
          </h1>
          <p style={{ fontSize: '14px', color: '#9A7A60', margin: '0 0 24px' }}>
            Vamos personalizar o seu espaço no Wednest.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            <div style={inputStyle}>
              <HeartIcon />
              <input
                value={data.partner1}
                onChange={(e) => set('partner1', e.target.value)}
                placeholder="Nome de um dos noivos"
                style={{ border: 'none', outline: 'none', fontSize: '15px', color: '#3C2818', width: '100%', background: 'transparent' }}
              />
            </div>
            <div style={inputStyle}>
              <HeartIcon />
              <input
                value={data.partner2}
                onChange={(e) => set('partner2', e.target.value)}
                placeholder="Nome do outro"
                style={{ border: 'none', outline: 'none', fontSize: '15px', color: '#3C2818', width: '100%', background: 'transparent' }}
              />
            </div>
          </div>

          <button
            onClick={() => setStep(1)}
            style={{
              width: '100%', background: '#C6943A', color: '#fff', border: 'none',
              borderRadius: '12px', padding: '15px', fontWeight: 600, fontSize: '15px',
              cursor: 'pointer', boxShadow: '0 10px 24px rgba(198,148,58,0.32)',
            }}
          >
            Continuar
          </button>
        </div>
      )}

      {/* ── STEP 2: Date + City ── */}
      {step === 1 && (
        <div>
          <h1 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(26px,3.4vw,34px)', margin: '0 0 4px', color: '#3C2818' }}>
            Quando é o grande dia?
          </h1>
          <p style={{ fontSize: '14px', color: '#9A7A60', margin: '0 0 24px' }}>
            Montaremos sua timeline a partir daqui.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            <div style={inputStyle}>
              <CalIcon />
              <input
                type="date"
                value={data.date}
                onChange={(e) => set('date', e.target.value)}
                style={{ border: 'none', outline: 'none', fontSize: '15px', color: '#3C2818', width: '100%', background: 'transparent' }}
              />
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

          <button
            onClick={() => setStep(2)}
            style={{
              width: '100%', background: '#C6943A', color: '#fff', border: 'none',
              borderRadius: '12px', padding: '15px', fontWeight: 600, fontSize: '15px',
              cursor: 'pointer', boxShadow: '0 10px 24px rgba(198,148,58,0.32)',
            }}
          >
            Continuar
          </button>
        </div>
      )}

      {/* ── STEP 3: Guests + Venue ── */}
      {step === 2 && (
        <div>
          <h1 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(26px,3.4vw,34px)', margin: '0 0 4px', color: '#3C2818' }}>
            Sobre os convidados
          </h1>
          <p style={{ fontSize: '14px', color: '#9A7A60', margin: '0 0 24px' }}>
            Nos ajude a calibrar o seu planejamento.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
            {/* Guests estimate */}
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#3C2818', marginBottom: '8px' }}>
                Quantas pessoas você pretende convidar?
              </div>
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

            {/* Has venue */}
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#3C2818', marginBottom: '10px' }}>
                Você já tem o local do casamento?
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                {[
                  { val: true,  label: 'Sim, já tenho' },
                  { val: false, label: 'Ainda não' },
                ].map(({ val, label }) => {
                  const active = data.hasVenue === val
                  return (
                    <button
                      key={String(val)}
                      onClick={() => set('hasVenue', val)}
                      style={{
                        flex: 1, padding: '12px', borderRadius: '12px',
                        border: `1.5px solid ${active ? '#C6943A' : '#EBDDD0'}`,
                        background: active ? '#FBF5EE' : '#FFFFFF',
                        color: active ? '#9A7020' : '#9A7A60',
                        fontWeight: active ? 700 : 500, fontSize: '14px',
                        cursor: 'pointer', transition: 'all 0.18s',
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <button
            onClick={() => setStep(3)}
            style={{
              width: '100%', background: '#C6943A', color: '#fff', border: 'none',
              borderRadius: '12px', padding: '15px', fontWeight: 600, fontSize: '15px',
              cursor: 'pointer', boxShadow: '0 10px 24px rgba(198,148,58,0.32)',
            }}
          >
            Continuar
          </button>
        </div>
      )}

      {/* ── STEP 4: Plan ── */}
      {step === 3 && (
        <div>
          <h1 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(24px,3.2vw,32px)', margin: '0 0 4px', color: '#3C2818' }}>
            Escolha seu plano
          </h1>
          <p style={{ fontSize: '14px', color: '#9A7A60', margin: '0 0 20px' }}>
            Você pode mudar de plano quando quiser.
          </p>

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

          <button
            onClick={finish}
            disabled={loading}
            style={{
              width: '100%', background: '#C6943A', color: '#fff', border: 'none',
              borderRadius: '12px', padding: '15px', fontWeight: 600, fontSize: '15px',
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
              boxShadow: '0 10px 24px rgba(198,148,58,0.32)',
            }}
          >
            {loading ? 'Criando seu espaço…' : 'Começar a planejar →'}
          </button>
        </div>
      )}
    </div>
  )
}
