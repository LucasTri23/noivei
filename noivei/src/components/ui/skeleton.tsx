interface SkeletonProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'style'> {
  width?:  string | number
  height?: string | number
  /** Border-radius do bloco — aceita qualquer valor CSS válido, mas o padrão já usa o
   * token `--radius` do design system em vez de um valor arbitrário novo. */
  radius?: string
  style?: React.CSSProperties
}

// "Tijolo" reutilizável de loading — um bloco retangular neutro com pulso discreto de
// opacidade, pra montar skeletons que imitam a forma real de qualquer lista/card (ver
// GuestsListSkeleton). Não é específico de nenhum módulo: só cor, tamanho e raio.
//
// A animação usa `animation` (CSS de verdade, não setInterval em JS), então já herda
// automaticamente a regra global de `prefers-reduced-motion: reduce` em globals.css,
// que zera `animation-duration` pra qualquer elemento da página.
//
// `aria-hidden="true"` porque isto é só decoração de carregamento — nunca deve ser
// anunciado por leitor de tela como se fosse conteúdo de verdade (quem avisa que a
// página está carregando é um texto separado, ver GuestsListSkeleton).
export default function Skeleton({
  width = '100%',
  height = '1rem',
  radius = 'var(--radius)',
  style,
  ...rest
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      {...rest}
      style={{
        width,
        height,
        borderRadius: radius,
        background: 'var(--border)',
        animation: 'skeleton-pulse 1.5s ease-in-out infinite',
        ...style,
      }}
    >
      <style>{'@keyframes skeleton-pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.45 } }'}</style>
    </div>
  )
}
