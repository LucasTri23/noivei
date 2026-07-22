export default function AuthBrandPanel() {
  return (
    <div
      className="relative hidden flex-col justify-between overflow-hidden p-10 text-[#FAF0E6] md:flex"
      style={{
        flex: '1 1 380px',
        background: 'linear-gradient(160deg, var(--brand-dark-gradient-from) 0%, var(--brand-dark-gradient-to) 60%, #4A3420 100%)',
      }}
    >
      {/* Dot grid */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(rgba(198,148,58,0.22) 1.3px, transparent 1.5px)',
          backgroundSize: '24px 24px',
        }}
      />
      {/* Glow */}
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(224,184,112,0.2), transparent 70%)' }}
      />

      {/* Logo */}
      <div className="relative flex items-center gap-3">
        <svg width="38" height="28" viewBox="0 0 76 56" fill="none">
          <defs>
            <linearGradient id="ag1" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#E0B870" />
              <stop offset="100%" stopColor="#C6943A" />
            </linearGradient>
          </defs>
          <circle cx="28" cy="28" r="17" stroke="url(#ag1)" strokeWidth="5" fill="none" />
          <circle cx="48" cy="28" r="17" stroke="url(#ag1)" strokeWidth="5" fill="none" />
        </svg>
        <span className="font-display font-medium" style={{ fontSize: '30px', color: '#E0B870', letterSpacing: '0.02em' }}>
          Wednest
        </span>
      </div>

      {/* Tagline + features */}
      <div className="relative">
        <h2
          className="font-display font-medium leading-tight"
          style={{ fontSize: 'clamp(28px, 3.4vw, 40px)', marginBottom: '22px' }}
        >
          Planeje cada detalhe, viva cada emoção.
        </h2>
        <div className="flex flex-col gap-3.5 text-sm" style={{ color: 'rgba(250,240,230,0.78)' }}>
          {[
            'Timeline & checklist inteligente',
            'Convidados, RSVP e mesas',
            'Orçamento sob controle',
          ].map((label) => (
            <div key={label} className="flex items-center gap-3">
              <span
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
                style={{ background: 'rgba(198,148,58,0.2)', color: '#E0B870' }}
              >
                <span className="block h-2 w-2 rounded-full" style={{ background: '#E0B870' }} />
              </span>
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Footer quote */}
      <p
        className="relative font-display italic"
        style={{ fontSize: '19px', color: '#C6943A' }}
      >
        Planejar é viver cada momento.
      </p>
    </div>
  )
}
