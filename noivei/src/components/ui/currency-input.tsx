'use client'

interface CurrencyInputProps {
  id?:          string
  value:        number | null // em centavos
  onChange:     (cents: number | null) => void
  placeholder?: string
}

const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export default function CurrencyInput({ id, value, onChange, placeholder }: CurrencyInputProps) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '')
    onChange(digits ? Number(digits) : null)
  }

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      value={value != null ? formatter.format(value / 100) : ''}
      onChange={handleChange}
      placeholder={placeholder ?? 'R$ 0,00'}
      style={{
        border: '1.5px solid #EBDDD0', borderRadius: '12px', padding: '12px 14px',
        fontSize: '15px', color: 'var(--fg)', background: 'var(--surface)', outline: 'none', width: '100%',
      }}
    />
  )
}
