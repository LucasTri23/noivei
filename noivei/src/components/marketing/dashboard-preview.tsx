const NAV_ITEMS = [
  'Início',
  'Tarefas',
  'Convidados',
  'Financeiro',
  'Lista de Presentes',
  'Fornecedores',
  'Site do Casal',
  'Configurações',
]

const TASKS = [
  { label: 'Definir buffet', date: '10/09/2025' },
  { label: 'Enviar save the date', date: '20/09/2025' },
  { label: 'Provar vestido', date: '05/10/2025' },
]

const COUNTDOWN = [
  { value: '338', label: 'DIAS' },
  { value: '11', label: 'HORAS' },
  { value: '42', label: 'MIN' },
  { value: '15', label: 'SEG' },
]

const DASHBOARD_GRADIENT =
  'linear-gradient(160deg, var(--brand-dark-gradient-from) 0%, var(--brand-dark-gradient-to) 60%, #4A3420 100%)'

/**
 * Ilustração estática dos mockups de laptop + celular exibidos na hero da
 * landing page, reproduzindo (em miniatura) o dashboard real do Wednest.
 * Puramente decorativo — sem estado, sem interação.
 */
export default function DashboardPreview() {
  return (
    <div className="relative w-full" style={{ maxWidth: '580px' }}>
      <RoseFlourish />

      {/* Laptop */}
      <div
        className="relative"
        style={{
          zIndex: 1,
          borderRadius: '16px',
          background: '#1B140C',
          padding: 'clamp(7px, 1.4vw, 12px)',
          boxShadow: '0 44px 84px rgba(30,20,10,0.32), 0 12px 26px rgba(30,20,10,0.22)',
        }}
      >
        <div
          className="flex"
          style={{
            position: 'relative',
            borderRadius: '7px',
            overflow: 'hidden',
            background: DASHBOARD_GRADIENT,
          }}
        >
          {/* Dot grid — mesmo padrão do AuthBrandPanel */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: 'radial-gradient(rgba(198,148,58,0.2) 1px, transparent 1.2px)',
              backgroundSize: '14px 14px',
            }}
          />

          {/* Sidebar */}
          <div
            className="hidden flex-shrink-0 sm:flex sm:flex-col"
            style={{
              position: 'relative',
              width: '30%',
              padding: 'clamp(8px, 1.6vw, 14px) clamp(6px, 1.2vw, 10px)',
              borderRight: '1px solid rgba(250,240,230,0.08)',
              gap: 'clamp(10px, 1.6vw, 16px)',
            }}
          >
            <div className="flex items-center" style={{ gap: '5px' }}>
              <svg width="14" height="10" viewBox="0 0 76 56" fill="none" style={{ flexShrink: 0 }}>
                <defs>
                  <linearGradient id="dp-logo" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#E0B870" />
                    <stop offset="100%" stopColor="#C6943A" />
                  </linearGradient>
                </defs>
                <circle cx="28" cy="28" r="17" stroke="url(#dp-logo)" strokeWidth="7" fill="none" />
                <circle cx="48" cy="28" r="17" stroke="url(#dp-logo)" strokeWidth="7" fill="none" />
              </svg>
              <span
                className="font-display"
                style={{ fontSize: 'clamp(8px, 1.15vw, 11px)', color: '#E0B870', fontWeight: 500, whiteSpace: 'nowrap' }}
              >
                Wednest
              </span>
            </div>

            <div className="flex flex-col" style={{ gap: 'clamp(3px, 0.6vw, 6px)' }}>
              {NAV_ITEMS.map((label, i) => (
                <div
                  key={label}
                  style={{
                    fontSize: 'clamp(6.5px, 0.95vw, 9px)',
                    fontWeight: i === 0 ? 700 : 500,
                    color: i === 0 ? '#E0B870' : 'rgba(250,240,230,0.55)',
                    background: i === 0 ? 'rgba(198,148,58,0.18)' : 'transparent',
                    borderRadius: '4px',
                    padding: '2.5px 5px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Main */}
          <div
            className="flex min-w-0 flex-1 flex-col"
            style={{ position: 'relative', padding: 'clamp(9px, 1.8vw, 16px)', gap: 'clamp(7px, 1.3vw, 11px)' }}
          >
            {/* Header */}
            <div className="flex items-start justify-between" style={{ gap: '6px' }}>
              <div style={{ minWidth: 0 }}>
                <h3
                  className="font-display"
                  style={{ fontSize: 'clamp(9.5px, 1.7vw, 15px)', fontWeight: 600, color: '#FAF0E6', margin: 0, lineHeight: 1.15 }}
                >
                  Bem-vindo ao seu planejamento!
                </h3>
                <p
                  style={{
                    fontSize: 'clamp(6px, 0.9vw, 8.5px)',
                    color: 'rgba(250,240,230,0.55)',
                    margin: '3px 0 0',
                    lineHeight: 1.3,
                    maxWidth: '260px',
                  }}
                >
                  Estamos aqui para tornar cada etapa do seu casamento mais leve, organizada e inesquecível.
                </p>
              </div>
              <div className="flex flex-shrink-0 items-center" style={{ gap: '5px' }}>
                <span
                  className="font-display flex items-center justify-center rounded-full"
                  style={{
                    width: 'clamp(14px, 1.8vw, 20px)',
                    height: 'clamp(14px, 1.8vw, 20px)',
                    background: 'rgba(198,148,58,0.25)',
                    color: '#E0B870',
                    fontSize: 'clamp(6.5px, 0.9vw, 9px)',
                    fontWeight: 700,
                  }}
                >
                  A
                </span>
                <span style={{ fontSize: 'clamp(6.5px, 0.9vw, 9px)', color: 'rgba(250,240,230,0.7)', whiteSpace: 'nowrap' }}>
                  Ana & João
                </span>
              </div>
            </div>

            {/* Contagem regressiva */}
            <div
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(250,240,230,0.1)',
                borderRadius: '10px',
                padding: 'clamp(6px, 1.2vw, 10px)',
              }}
            >
              <div
                style={{
                  fontSize: 'clamp(5.5px, 0.75vw, 7.5px)',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: '#E0B870',
                  marginBottom: '4px',
                }}
              >
                Contagem regressiva
              </div>
              <div className="flex" style={{ gap: 'clamp(8px, 1.6vw, 16px)' }}>
                {COUNTDOWN.map(({ value, label }) => (
                  <div key={label} className="flex flex-col items-center" style={{ flex: 1 }}>
                    <span
                      className="font-display"
                      style={{ fontSize: 'clamp(12px, 2vw, 20px)', fontWeight: 600, color: '#FAF0E6', lineHeight: 1 }}
                    >
                      {value}
                    </span>
                    <span
                      style={{
                        fontSize: 'clamp(5px, 0.65vw, 6.5px)',
                        letterSpacing: '0.08em',
                        color: 'rgba(250,240,230,0.5)',
                        marginTop: '2px',
                      }}
                    >
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'clamp(5px, 1vw, 8px)' }}>
              {[
                { label: 'Tarefas', value: '12 concluídas · 28 pendentes' },
                { label: 'Convidados', value: '86 confirmados · 14 pendentes' },
                { label: 'Orçamento', value: 'R$ 40.000,00', note: '0% do orçamento comprometido' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    minWidth: 0,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(250,240,230,0.1)',
                    borderRadius: '8px',
                    padding: 'clamp(5px, 1vw, 8px)',
                  }}
                >
                  <div style={{ fontSize: 'clamp(5.5px, 0.8vw, 7.5px)', color: '#E0B870', fontWeight: 700 }}>{stat.label}</div>
                  <div style={{ fontSize: 'clamp(5.5px, 0.78vw, 7.5px)', color: 'rgba(250,240,230,0.75)', marginTop: '2px', lineHeight: 1.25 }}>
                    {stat.value}
                  </div>
                  {stat.note && (
                    <div style={{ fontSize: 'clamp(5px, 0.68vw, 6.5px)', color: 'rgba(250,240,230,0.45)', marginTop: '2px' }}>
                      {stat.note}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Próximas tarefas */}
            <div
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(250,240,230,0.1)',
                borderRadius: '8px',
                padding: 'clamp(6px, 1.1vw, 9px)',
              }}
            >
              <div style={{ fontSize: 'clamp(5.5px, 0.8vw, 7.5px)', color: '#E0B870', fontWeight: 700, marginBottom: '4px' }}>
                Próximas tarefas
              </div>
              <div className="flex flex-col" style={{ gap: 'clamp(3px, 0.7vw, 5px)' }}>
                {TASKS.map((task) => (
                  <div key={task.label} className="flex items-center justify-between" style={{ gap: '6px' }}>
                    <div className="flex min-w-0 items-center" style={{ gap: '5px' }}>
                      <span
                        className="flex-shrink-0 rounded-full"
                        style={{ width: '6px', height: '6px', border: '1px solid rgba(250,240,230,0.4)' }}
                      />
                      <span
                        style={{
                          fontSize: 'clamp(5.5px, 0.8vw, 7.5px)',
                          color: 'rgba(250,240,230,0.8)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {task.label}
                      </span>
                    </div>
                    <span style={{ fontSize: 'clamp(5px, 0.7vw, 6.5px)', color: 'rgba(250,240,230,0.45)', flexShrink: 0 }}>
                      {task.date}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Base do laptop */}
      <div
        className="hidden sm:block"
        style={{
          zIndex: 1,
          position: 'relative',
          height: 'clamp(7px, 1vw, 11px)',
          width: '104%',
          margin: '0 -2%',
          background: 'linear-gradient(180deg, #2A1E10, #140F09)',
          borderRadius: '0 0 8px 8px',
          boxShadow: '0 16px 22px rgba(0,0,0,0.22)',
        }}
      />

      {/* Phone */}
      <div
        className="hidden sm:block"
        style={{
          position: 'absolute',
          left: '-16px',
          bottom: '-22px',
          width: '34%',
          zIndex: 2,
        }}
      >
        <div
          style={{
            borderRadius: 'clamp(14px, 3vw, 20px)',
            background: '#1B140C',
            padding: 'clamp(5px, 1vw, 8px)',
            boxShadow: '0 30px 60px rgba(30,20,10,0.32)',
          }}
        >
          <div
            className="flex flex-col"
            style={{
              position: 'relative',
              borderRadius: 'clamp(9px, 2.2vw, 14px)',
              overflow: 'hidden',
              background: 'linear-gradient(165deg, var(--brand-dark-gradient-from) 0%, var(--brand-dark-gradient-to) 65%, #4A3420 100%)',
              padding: 'clamp(7px, 1.6vw, 11px) clamp(6px, 1.4vw, 9px)',
              gap: 'clamp(5px, 1.2vw, 8px)',
            }}
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage: 'radial-gradient(rgba(198,148,58,0.2) 1px, transparent 1.2px)',
                backgroundSize: '10px 10px',
              }}
            />

            <div style={{ position: 'relative' }}>
              <div className="font-display" style={{ fontSize: 'clamp(7.5px, 1.5vw, 11px)', fontWeight: 600, color: '#FAF0E6' }}>
                Bem-vindo!
              </div>
              <div style={{ fontSize: 'clamp(5.5px, 1vw, 8px)', color: '#E0B870', marginTop: '1px' }}>
                Ana & João
              </div>
              <div style={{ fontSize: 'clamp(5px, 0.85vw, 7px)', color: 'rgba(250,240,230,0.5)', marginTop: '1px' }}>
                04 de agosto de 2026
              </div>
            </div>

            <div
              style={{
                position: 'relative',
                background: 'rgba(255,255,255,0.06)',
                borderRadius: '7px',
                padding: 'clamp(4px, 1vw, 7px)',
                display: 'flex',
                gap: 'clamp(5px, 1.2vw, 8px)',
              }}
            >
              {COUNTDOWN.map(({ value, label }) => (
                <div key={label} className="flex flex-col items-center" style={{ flex: 1 }}>
                  <span className="font-display" style={{ fontSize: 'clamp(8px, 1.6vw, 12px)', fontWeight: 600, color: '#FAF0E6', lineHeight: 1 }}>
                    {value}
                  </span>
                  <span style={{ fontSize: 'clamp(4px, 0.55vw, 5px)', color: 'rgba(250,240,230,0.5)', marginTop: '1px' }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ position: 'relative', background: 'rgba(255,255,255,0.06)', borderRadius: '7px', padding: 'clamp(4px, 1vw, 7px)' }}>
              <div style={{ fontSize: 'clamp(5px, 0.85vw, 6.5px)', color: '#E0B870', fontWeight: 700, marginBottom: '3px' }}>
                Próximas tarefas
              </div>
              <div className="flex flex-col" style={{ gap: 'clamp(2px, 0.6vw, 4px)' }}>
                {TASKS.map((task) => (
                  <div key={task.label} className="flex items-center" style={{ gap: '4px' }}>
                    <span
                      className="flex-shrink-0 rounded-full"
                      style={{ width: '4px', height: '4px', border: '1px solid rgba(250,240,230,0.4)' }}
                    />
                    <span
                      style={{
                        fontSize: 'clamp(5px, 0.8vw, 6.5px)',
                        color: 'rgba(250,240,230,0.8)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        minWidth: 0,
                      }}
                    >
                      {task.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ position: 'relative', background: 'rgba(255,255,255,0.06)', borderRadius: '7px', padding: 'clamp(4px, 1vw, 7px)' }}>
              <div style={{ fontSize: 'clamp(5px, 0.85vw, 6.5px)', color: '#E0B870', fontWeight: 700, marginBottom: '2px' }}>
                Lista de Presentes
              </div>
              <div className="flex items-center justify-between" style={{ gap: '4px' }}>
                <span
                  style={{
                    fontSize: 'clamp(5px, 0.8vw, 6.5px)',
                    color: 'rgba(250,240,230,0.8)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    minWidth: 0,
                  }}
                >
                  Batedeira Artisan KitchenAid
                </span>
                <span style={{ fontSize: 'clamp(5px, 0.8vw, 6.5px)', color: '#E0B870', flexShrink: 0, fontWeight: 600 }}>
                  R$ 2.499,00
                </span>
              </div>
            </div>

            <div
              style={{
                position: 'relative',
                display: 'flex',
                justifyContent: 'space-around',
                paddingTop: 'clamp(3px, 0.8vw, 5px)',
                borderTop: '1px solid rgba(250,240,230,0.1)',
              }}
            >
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="rounded-full"
                  style={{ width: '5px', height: '5px', background: i === 0 ? '#E0B870' : 'rgba(250,240,230,0.3)' }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Flor decorativa desenhada em CSS/SVG puro — substitui a foto de rose do mockup original. */
function RoseFlourish() {
  return (
    <svg
      className="pointer-events-none absolute hidden lg:block"
      width="86"
      height="86"
      viewBox="0 0 86 86"
      fill="none"
      style={{ right: '-30px', bottom: '-26px', zIndex: 0, opacity: 0.9 }}
    >
      <defs>
        <radialGradient id="dp-rose" cx="35%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#E0B870" />
          <stop offset="100%" stopColor="#C6943A" />
        </radialGradient>
      </defs>
      <circle cx="43" cy="30" r="16" fill="url(#dp-rose)" opacity="0.85" />
      <circle cx="30" cy="46" r="14" fill="url(#dp-rose)" opacity="0.7" />
      <circle cx="58" cy="46" r="14" fill="url(#dp-rose)" opacity="0.7" />
      <circle cx="43" cy="58" r="15" fill="url(#dp-rose)" opacity="0.75" />
      <circle cx="43" cy="42" r="11" fill="#9A7020" opacity="0.9" />
    </svg>
  )
}
