'use client'

interface ToggleSwitchProps {
  checked:  boolean
  onChange: (checked: boolean) => void
  label?:   string
}

// Switch estilo iOS — substitui o <input type="checkbox"> cru usado antes pros
// campos "Ativo" do admin (plano/cupom), que ficava visualmente escondido/deselegante
// ao lado do texto.
export default function ToggleSwitch({ checked, onChange, label }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '9px',
        border: 'none', background: 'transparent', padding: 0, cursor: 'pointer',
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'relative', width: '38px', height: '21px', borderRadius: '99px', flexShrink: 0,
          background: checked ? '#5E8B6A' : '#D9CDBF', transition: 'background 0.18s',
        }}
      >
        <span
          style={{
            position: 'absolute', top: '2px', left: checked ? '19px' : '2px',
            width: '17px', height: '17px', borderRadius: '50%', background: '#FFFFFF',
            boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left 0.18s',
          }}
        />
      </span>
      {label && <span style={{ fontSize: '13px', fontWeight: 600, color: '#2A1E10' }}>{label}</span>}
    </button>
  )
}
