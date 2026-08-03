'use client'

import { useEffect, useState } from 'react'

interface CountdownCardProps {
  weddingDate:   string | null // yyyy-mm-dd
  formattedDate: string | null
}

interface Remaining {
  days:    number
  hours:   number
  minutes: number
  seconds: number
}

function computeRemaining(targetMs: number): Remaining {
  const diff = Math.max(0, targetMs - Date.now())
  const totalSeconds = Math.floor(diff / 1000)
  return {
    days:    Math.floor(totalSeconds / 86400),
    hours:   Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  }
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

// Contagem regressiva viva (dias/horas/min/seg) — precisa ser client component (o
// servidor só teria o valor do momento em que a página foi renderizada, sem seguir
// ticando). Começa em `null` e só calcula de verdade dentro do useEffect (client-only)
// pra evitar mismatch de hidratação — o servidor e o cliente veriam segundos diferentes
// se calculássemos isso já na primeira renderização.
export default function CountdownCard({ weddingDate, formattedDate }: CountdownCardProps) {
  const targetMs = weddingDate ? new Date(`${weddingDate}T23:59:59`).getTime() : null
  const [remaining, setRemaining] = useState<Remaining | null>(null)

  useEffect(() => {
    if (!targetMs) return
    // O primeiro valor real só aparece no primeiro tick (até 1s depois de montar) —
    // setState direto no corpo do effect (pra mostrar na hora) dispara cascading
    // renders; um atraso de no máximo 1s numa contagem em dias é imperceptível.
    const interval = setInterval(() => setRemaining(computeRemaining(targetMs)), 1000)
    return () => clearInterval(interval)
  }, [targetMs])

  return (
    <div
      className="relative overflow-hidden rounded-3xl p-8"
      style={{ background: 'linear-gradient(150deg, var(--brand-dark-gradient-from), var(--brand-dark-gradient-to))', color: '#FAF0E6' }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: 'radial-gradient(color-mix(in srgb, var(--wedding-color) 18%, transparent) 1.3px, transparent 1.5px)', backgroundSize: '26px 26px' }}
      />
      <div className="relative">
        <div style={{ fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--wedding-color-light)' }}>
          Faltam
        </div>
        {targetMs ? (
          <div className="flex" style={{ gap: 'clamp(10px, 2.2vw, 22px)', marginTop: '10px' }}>
            {[
              { value: remaining?.days,    label: 'dias',  pad: false },
              { value: remaining?.hours,   label: 'horas', pad: true },
              { value: remaining?.minutes, label: 'min',   pad: true },
              { value: remaining?.seconds, label: 'seg',   pad: true },
            ].map((unit) => (
              <div key={unit.label} className="flex flex-col items-center">
                <span className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(32px,4.6vw,46px)', lineHeight: 1 }}>
                  {unit.value === undefined ? '—' : unit.pad ? pad(unit.value) : unit.value}
                </span>
                <span style={{ fontSize: '10.5px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--wedding-color-light)', marginTop: '5px' }}>
                  {unit.label}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="font-display mt-2" style={{ fontStyle: 'italic', fontSize: '22px', color: 'var(--wedding-color-light)' }}>
            Adicione a data do casamento nas configurações
          </p>
        )}
        {formattedDate && (
          <div style={{ fontSize: '14px', color: 'rgba(250,240,230,0.65)', marginTop: '16px' }}>
            {formattedDate}
          </div>
        )}
      </div>
    </div>
  )
}
