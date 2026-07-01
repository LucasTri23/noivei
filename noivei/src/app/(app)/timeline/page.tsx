interface TimelineItem {
  title: string
  note: string
  done: boolean
  highlight?: boolean
}

interface TimelineGroup {
  month: string
  items: TimelineItem[]
}

const TIMELINE: TimelineGroup[] = [
  {
    month: 'Julho 2026',
    items: [
      { title: 'Orçamento definido', note: 'Concluído', done: true },
      { title: 'Local reservado', note: 'R$ 14.000 · sinal pago', done: true },
    ],
  },
  {
    month: 'Setembro 2026',
    items: [
      { title: 'Contratar cerimonialista', note: 'Em cotação', done: false },
      { title: 'Fotografia e vídeo', note: '3 propostas recebidas', done: false },
    ],
  },
  {
    month: 'Janeiro 2027',
    items: [
      { title: 'Fechar buffet e cardápio', note: 'Degustação agendada', done: false },
      { title: 'Decoração e flores', note: 'A definir', done: false },
    ],
  },
  {
    month: 'Abril 2027',
    items: [
      { title: 'Enviar convites', note: '140 convidados', done: false },
      { title: 'Prova do traje', note: 'A agendar', done: false },
    ],
  },
  {
    month: 'Julho 2027',
    items: [
      { title: 'Cronograma final do dia', note: 'Semana do casamento', done: false },
      { title: 'O grande dia', note: 'Kingdom Hall Centro', done: false, highlight: true },
    ],
  },
]

export default function TimelinePage() {
  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1
          className="font-display"
          style={{ fontWeight: 500, fontSize: 'clamp(30px,4.2vw,42px)', lineHeight: 1.05, color: '#3C2818' }}
        >
          Timeline do casamento
        </h1>
        <p style={{ fontSize: '14px', color: '#9A7A60', marginTop: '4px' }}>
          Acompanhe cada etapa da sua jornada rumo ao grande dia
        </p>
      </div>

      {/* Timeline */}
      <div style={{ position: 'relative' }}>
        {TIMELINE.map((group, gi) => (
          <div key={group.month} style={{ marginBottom: '40px' }}>
            {/* Month header */}
            <div
              className="font-display mb-4"
              style={{ fontSize: '22px', fontWeight: 500, color: '#C6943A', letterSpacing: '0.01em' }}
            >
              {group.month}
            </div>

            {/* Items */}
            <div style={{ position: 'relative', paddingLeft: '36px' }}>
              {/* Vertical line */}
              <div
                style={{
                  position: 'absolute',
                  left: '9px',
                  top: '12px',
                  bottom: gi < TIMELINE.length - 1 ? '-28px' : '12px',
                  width: '2px',
                  background: '#EBDDD0',
                }}
              />

              {group.items.map((item, ii) => {
                const dotColor = item.highlight
                  ? '#C89070'
                  : item.done
                  ? '#C6943A'
                  : '#FFFFFF'
                const dotBorder = item.highlight
                  ? '#C89070'
                  : item.done
                  ? '#C6943A'
                  : '#D8C6A6'

                return (
                  <div
                    key={ii}
                    style={{
                      position: 'relative',
                      marginBottom: '12px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0',
                    }}
                  >
                    {/* Dot */}
                    <div
                      style={{
                        position: 'absolute',
                        left: '-27px',
                        top: '14px',
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: dotColor,
                        border: `2px solid ${dotBorder}`,
                        boxShadow: item.done || item.highlight ? `0 0 0 3px rgba(198,148,58,0.18)` : 'none',
                        zIndex: 1,
                      }}
                    >
                      {item.done && (
                        <svg
                          width="10" height="10"
                          viewBox="0 0 24 24" fill="none" stroke="#fff"
                          strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                          style={{ position: 'absolute', top: '2px', left: '2px' }}
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>

                    {/* Card */}
                    <div
                      style={{
                        width: '100%',
                        padding: '14px 18px',
                        borderRadius: '16px',
                        background: item.highlight
                          ? 'linear-gradient(150deg, #2A1E10, #3A2A18)'
                          : '#FFFFFF',
                        border: item.highlight ? 'none' : '1px solid #F0E8DE',
                        boxShadow: item.highlight
                          ? '0 12px 28px rgba(60,40,24,0.22)'
                          : '0 4px 14px rgba(60,40,24,0.05)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '15px',
                          fontWeight: 600,
                          color: item.highlight ? '#E0B870' : '#3C2818',
                        }}
                      >
                        {item.title}
                      </div>
                      <div
                        style={{
                          fontSize: '13px',
                          color: item.highlight ? 'rgba(250,240,230,0.65)' : '#9A7A60',
                          marginTop: '3px',
                        }}
                      >
                        {item.note}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
