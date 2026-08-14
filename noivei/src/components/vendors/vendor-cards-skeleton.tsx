import Skeleton from '@/components/ui/skeleton'

// Número de cards fantasma — só precisa preencher a grade o bastante pra não haver
// salto de layout perceptível quando os cards reais substituírem este skeleton.
const PLACEHOLDER_CARDS = 6

function VendorCardSkeleton() {
  return (
    <div
      className="flex h-full flex-col rounded-[var(--radius-xl)] bg-[var(--surface)] p-6 ring-1 ring-[var(--border)]"
      style={{ boxShadow: 'var(--shadow), var(--shadow-lg)' }}
    >
      <div className="flex items-center gap-3" style={{ marginBottom: '14px' }}>
        <Skeleton width={44} height={44} radius="var(--radius-full)" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <Skeleton width="70%" height="14px" />
          <Skeleton width="45%" height="11px" />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
        <Skeleton width="100%" height="11px" />
        <Skeleton width="90%" height="11px" />
        <Skeleton width="60%" height="11px" />
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', gap: '6px' }}>
        <Skeleton width="46px" height="20px" radius="var(--radius-full)" />
        <Skeleton width="72px" height="20px" radius="var(--radius-full)" />
      </div>
    </div>
  )
}

// Skeleton de carregamento do marketplace de fornecedores — usado por
// app/(app)/fornecedores/loading.tsx, mesmo padrão de GuestsListSkeleton (grade
// de "tijolos" que imita a forma real de VendorCard, ver comparação em vendor-card.tsx).
export default function VendorCardsSkeleton() {
  return (
    <div>
      <span className="sr-only" role="status" aria-live="polite">
        Carregando fornecedores…
      </span>
      <div aria-hidden="true" className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px,1fr))' }}>
        {Array.from({ length: PLACEHOLDER_CARDS }, (_, i) => (
          <VendorCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
