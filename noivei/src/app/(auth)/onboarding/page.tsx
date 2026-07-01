'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase/browser'

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep]   = useState(0)
  const [data, setData]   = useState({ partner1: '', partner2: '', date: '', city: '' })
  const [loading, setLoading] = useState(false)

  const step2Color = step === 1 ? '#E86A78' : '#F1E7EA'

  async function finish() {
    setLoading(true)
    const supabase     = createSupabaseBrowser()
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

  return (
    <div>
      {/* Progress bar */}
      <div style={{ display: 'flex', gap: '7px', marginBottom: '24px' }}>
        <span style={{ flex: 1, height: '5px', borderRadius: '5px', background: '#E86A78' }} />
        <span style={{ flex: 1, height: '5px', borderRadius: '5px', background: step2Color }} />
      </div>

      {step === 0 && (
        <div>
          <div style={{ fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#E86A78', fontWeight: 700 }}>
            Passo 1 de 2
          </div>
          <h1 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(28px,3.6vw,36px)', margin: '8px 0 4px', color: '#22304F' }}>
            Quem são os noivos?
          </h1>
          <p style={{ fontSize: '14.5px', color: '#6E6A72', margin: '0 0 26px' }}>
            Vamos personalizar o seu espaço.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '26px' }}>
            {[
              { key: 'partner1', placeholder: 'Nome de um dos noivos' },
              { key: 'partner2', placeholder: 'Nome do outro' },
            ].map(({ key, placeholder }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '12px', border: '1.5px solid #E7E1E4', borderRadius: '12px', padding: '13px 15px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E86A78" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                <input
                  value={data[key as 'partner1' | 'partner2']}
                  onChange={(e) => setData(d => ({ ...d, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={{ border: 'none', outline: 'none', fontSize: '15px', color: '#22304F', width: '100%', background: 'transparent' }}
                />
              </div>
            ))}
          </div>

          <button onClick={() => setStep(1)}
            style={{ width: '100%', background: '#E86A78', color: '#fff', border: 'none', borderRadius: '12px', padding: '15px', fontWeight: 600, fontSize: '15.5px', cursor: 'pointer', boxShadow: '0 10px 24px rgba(232,106,120,0.3)' }}>
            Continuar
          </button>
        </div>
      )}

      {step === 1 && (
        <div>
          <button onClick={() => setStep(0)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', color: '#6E6A72', border: 'none', background: 'none', cursor: 'pointer', marginBottom: '14px', padding: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
            Voltar
          </button>

          <div style={{ fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#E86A78', fontWeight: 700 }}>
            Passo 2 de 2
          </div>
          <h1 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(28px,3.6vw,36px)', margin: '8px 0 4px', color: '#22304F' }}>
            Quando é o grande dia?
          </h1>
          <p style={{ fontSize: '14.5px', color: '#6E6A72', margin: '0 0 26px' }}>
            Montaremos sua timeline a partir daqui.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '26px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', border: '1.5px solid #E7E1E4', borderRadius: '12px', padding: '13px 15px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9A9099" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
              <input type="date" value={data.date} onChange={(e) => setData(d => ({ ...d, date: e.target.value }))}
                style={{ border: 'none', outline: 'none', fontSize: '15px', color: '#22304F', width: '100%', background: 'transparent' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', border: '1.5px solid #E7E1E4', borderRadius: '12px', padding: '13px 15px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9A9099" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <input value={data.city} onChange={(e) => setData(d => ({ ...d, city: e.target.value }))}
                placeholder="Cidade do casamento"
                style={{ border: 'none', outline: 'none', fontSize: '15px', color: '#22304F', width: '100%', background: 'transparent' }} />
            </div>
          </div>

          <button onClick={finish} disabled={loading}
            style={{ width: '100%', background: '#E86A78', color: '#fff', border: 'none', borderRadius: '12px', padding: '15px', fontWeight: 600, fontSize: '15.5px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, boxShadow: '0 10px 24px rgba(232,106,120,0.3)' }}>
            {loading ? 'Criando seu espaço…' : 'Finalizar'}
          </button>
        </div>
      )}
    </div>
  )
}
