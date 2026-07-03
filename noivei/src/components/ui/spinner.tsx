interface SpinnerProps {
  size?:  number
  color?: string
}

export default function Spinner({ size = 14, color = 'currentColor' }: SpinnerProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ animation: 'spin 0.7s linear infinite', flexShrink: 0 }}
      role="status"
      aria-label="Carregando"
    >
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2.5" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <style>{'@keyframes spin { to { transform: rotate(360deg) } }'}</style>
    </svg>
  )
}
