interface Category {
  name: string
  total: number
  spent: number
  color: string
}

interface Payment {
  vendor: string
  note: string
  amount: string
  date: string
}

// Sem dados padrão ainda — financeiro vazio até definirmos o template
const CATEGORIES: Category[] = []
const PAYMENTS: Payment[] = []

const BUDGET  = 0
const SPENT   = 0
const PCT     = BUDGET > 0 ? Math.round((SPENT / BUDGET) * 100) : 0

function fmt(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n)
}

function PlusIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export default function FinanceiroPage() {
  const available = BUDGET - SPENT

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            className="font-display"
            style={{ fontWeight: 500, fontSize: 'clamp(30px,4.2vw,42px)', lineHeight: 1.05, color: '#3C2818' }}
          >
            Financeiro
          </h1>
          <p style={{ fontSize: '14px', color: '#9A7A60', marginTop: '4px' }}>
            Controle o orçamento do seu casamento
          </p>
        </div>
        <button
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: '#C6943A', color: '#fff', border: 'none',
            borderRadius: '12px', padding: '11px 18px',
            fontWeight: 600, fontSize: '14px', cursor: 'pointer',
            boxShadow: '0 6px 16px rgba(198,148,58,0.32)',
          }}
        >
          <PlusIcon /> Lançar gasto
        </button>
      </div>

      {/* Hero card */}
      <div
        className="relative overflow-hidden rounded-3xl p-8 mb-6"
        style={{ background: 'linear-gradient(150deg, #2A1E10, #3A2A18)', color: '#FAF0E6' }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: 'radial-gradient(rgba(198,148,58,0.18) 1.3px, transparent 1.5px)', backgroundSize: '28px 28px' }}
        />
        <div className="relative">
          <div style={{ fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#E0B870', marginBottom: '4px' }}>
            Orçamento total
          </div>
          <div className="font-display" style={{ fontSize: 'clamp(42px,6vw,60px)', fontWeight: 500, lineHeight: 1, marginBottom: '16px' }}>
            {fmt(BUDGET)}
          </div>

          {/* Progress bar */}
          <div style={{ height: '10px', borderRadius: '99px', background: 'rgba(255,255,255,0.12)', overflow: 'hidden', marginBottom: '8px' }}>
            <div
              style={{
                height: '100%', borderRadius: '99px',
                background: 'linear-gradient(90deg, #E0B870, #C6943A)',
                width: `${PCT}%`,
              }}
            />
          </div>
          <div style={{ fontSize: '13px', color: 'rgba(250,240,230,0.65)', marginBottom: '20px' }}>
            {PCT}% do orçamento comprometido
          </div>

          {/* Mini cards */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {[
              { label: 'Gasto', value: fmt(SPENT), color: '#E0B870' },
              { label: 'Disponível', value: fmt(available), color: 'rgba(250,240,230,0.65)' },
            ].map((mc) => (
              <div
                key={mc.label}
                style={{
                  padding: '12px 18px', borderRadius: '14px',
                  background: 'rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(4px)',
                }}
              >
                <div style={{ fontSize: '11px', color: 'rgba(250,240,230,0.55)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {mc.label}
                </div>
                <div className="font-display" style={{ fontSize: '22px', fontWeight: 500, color: mc.color }}>
                  {mc.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Two columns */}
      <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px,1fr))' }}>
        {/* Categories */}
        <div className="rounded-2xl bg-white p-6" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)' }}>
          <h3 className="font-display mb-5" style={{ fontSize: '21px', fontWeight: 500, color: '#3C2818' }}>
            Por categoria
          </h3>
          <div className="flex flex-col gap-4">
            {CATEGORIES.length === 0 && (
              <p style={{ fontSize: '13.5px', color: '#9A7A60' }}>Nenhuma categoria lançada ainda.</p>
            )}
            {CATEGORIES.map((cat) => {
              const pct = cat.total > 0 ? Math.round((cat.spent / cat.total) * 100) : 0
              return (
                <div key={cat.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13.5px', fontWeight: 500, color: '#3C2818' }}>{cat.name}</span>
                    <span style={{ fontSize: '12.5px', color: '#9A7A60' }}>
                      {fmt(cat.spent)} / {fmt(cat.total)}
                    </span>
                  </div>
                  <div style={{ height: '8px', borderRadius: '99px', background: '#F0E8DE', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%', borderRadius: '99px',
                        background: cat.color,
                        width: `${pct}%`,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Recent payments */}
        <div className="rounded-2xl bg-white p-6" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)' }}>
          <h3 className="font-display mb-5" style={{ fontSize: '21px', fontWeight: 500, color: '#3C2818' }}>
            Pagamentos recentes
          </h3>
          <div className="flex flex-col gap-3">
            {PAYMENTS.length === 0 && (
              <p style={{ fontSize: '13.5px', color: '#9A7A60' }}>Nenhum pagamento lançado ainda.</p>
            )}
            {PAYMENTS.map((p, i) => (
              <div
                key={i}
                className="flex items-center gap-4 rounded-xl p-4"
                style={{ background: '#FBF5EE', border: '1px solid #F0E8DE' }}
              >
                {/* Check icon */}
                <div
                  style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: '#E9EFE6', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5E8B6A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#3C2818' }}>{p.vendor}</div>
                  <div style={{ fontSize: '12px', color: '#9A7A60', marginTop: '2px' }}>{p.note}</div>
                </div>
                {/* Amount + date */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#3C2818' }}>{p.amount}</div>
                  <div style={{ fontSize: '11.5px', color: '#9A7A60', marginTop: '2px' }}>{p.date}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
