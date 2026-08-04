'use client'

import { useEffect, useMemo, useState } from 'react'

interface PortfolioCountdownProps {
  // Data do casamento no formato `YYYY-MM-DD` (mesmo formato de `wedding.wedding_date`) —
  // interpretada à meia-noite local, mesmo critério de `formatWeddingDate` no server component.
  weddingDate: string | null
}

interface Countdown {
  days:    number
  hours:   number
  minutes: number
  seconds: number
}

function parseTargetDate(weddingDate: string | null): Date | null {
  if (!weddingDate) return null
  const [y, m, d] = weddingDate.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function diffToCountdown(target: Date): Countdown | null {
  const diffMs = target.getTime() - Date.now()
  if (diffMs <= 0) return null

  const totalSeconds = Math.floor(diffMs / 1000)
  return {
    days:    Math.floor(totalSeconds / 86400),
    hours:   Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  }
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '52px' }}>
      <span className="font-display" style={{ fontSize: 'clamp(26px,4vw,38px)', fontWeight: 600, color: '#FAF0E6', lineHeight: 1 }}>
        {String(value).padStart(2, '0')}
      </span>
      <span style={{ fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(250,240,230,0.68)', marginTop: '6px' }}>
        {label}
      </span>
    </div>
  )
}

// Contagem regressiva em tempo real até `wedding.wedding_date` — único pedaço client-side
// deste template (o resto da página é renderizado no server); isolado num arquivo próprio
// porque `'use client'` se aplica ao arquivo inteiro, e o restante do portfólio não precisa
// de interatividade nenhuma. Sem data futura (não preenchida ou já passada), não renderiza
// nada — nunca mostra números negativos nem um card vazio.
export default function PortfolioCountdown({ weddingDate }: PortfolioCountdownProps) {
  // Memoizado por `weddingDate` (string, estável entre renders) — sem isso, `target` seria
  // um `Date` novo a cada render, e usá-lo como dependência do efeito abaixo disparava o
  // aviso do exhaustive-deps (referência instável) mesmo com o mesmo valor de data.
  const target = useMemo(() => parseTargetDate(weddingDate), [weddingDate])
  // Valor inicial já calculado no lazy initializer (evita o "flash" de um segundo sem
  // número antes do primeiro tick do interval abaixo). Chamar `setCountdown` de forma
  // síncrona dentro do corpo do efeito é desaconselhado (dispara uma renderização em
  // cascata) — por isso o efeito só agenda o interval, nunca chama `setCountdown`
  // diretamente fora do callback dele.
  const [countdown, setCountdown] = useState<Countdown | null>(() => (target ? diffToCountdown(target) : null))

  useEffect(() => {
    if (!target) return

    const interval = setInterval(() => {
      setCountdown(diffToCountdown(target))
    }, 1000)

    return () => clearInterval(interval)
  }, [target])

  if (!countdown) return null

  return (
    <div
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 'clamp(14px,3vw,28px)',
        marginTop: '32px', padding: '18px clamp(20px,4vw,32px)', borderRadius: '20px',
        background: 'rgba(20,12,4,0.42)', border: '1px solid rgba(250,240,230,0.16)',
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <CountdownUnit value={countdown.days} label="Dias" />
      <span style={{ color: 'rgba(250,240,230,0.4)', fontSize: '22px', marginTop: '-14px' }}>:</span>
      <CountdownUnit value={countdown.hours} label="Horas" />
      <span style={{ color: 'rgba(250,240,230,0.4)', fontSize: '22px', marginTop: '-14px' }}>:</span>
      <CountdownUnit value={countdown.minutes} label="Min" />
      <span style={{ color: 'rgba(250,240,230,0.4)', fontSize: '22px', marginTop: '-14px' }}>:</span>
      <CountdownUnit value={countdown.seconds} label="Seg" />
    </div>
  )
}
