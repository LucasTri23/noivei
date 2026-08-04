import Skeleton from '@/components/ui/skeleton'

// Número de linhas fantasma renderizadas — só precisa preencher espaço suficiente pra
// não haver salto de layout perceptível quando a lista real (GuestsManager) substituir
// este skeleton; não precisa bater com a contagem real de convidados do casal.
const PLACEHOLDER_ROWS = 6

// Imita a forma aproximada de uma linha de `GuestsManager` (avatar circular + nome +
// linha de detalhes + badge de convite + pílula de status + ícones de ação), reusando
// os mesmos tokens de raio/espaçamento da lista real — não é pixel-perfect, só precisa
// ocupar o mesmo formato geral. Ver o bloco "Guest list" em guests-manager.tsx pra
// comparação com a estrutura renderizada de verdade.
function GuestRowSkeleton() {
  return (
    <div
      className="flex flex-wrap items-center gap-4 px-5 py-4"
      style={{ borderBottom: '1px solid #F8F3EE' }}
    >
      <Skeleton width={40} height={40} radius="var(--radius-full)" />
      <div style={{ flex: 1, minWidth: '160px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Skeleton width="140px" height="14px" />
        <Skeleton width="200px" height="11px" />
        <Skeleton width="110px" height="11px" radius="var(--radius-full)" />
      </div>
      <Skeleton width="88px" height="22px" radius="var(--radius-full)" />
      <Skeleton width={24} height={24} radius="var(--radius-full)" />
      <Skeleton width={24} height={24} radius="var(--radius-full)" />
    </div>
  )
}

// Skeleton de carregamento da tela de convidados — usado por
// app/(app)/convidados/loading.tsx no lugar do spinner genérico centralizado, pra
// reduzir o deslocamento de conteúdo perceptível quando a lista real aparece.
export default function GuestsListSkeleton() {
  return (
    <div>
      <span className="sr-only" role="status" aria-live="polite">
        Carregando convidados…
      </span>
      <div
        aria-hidden="true"
        className="overflow-hidden rounded-2xl bg-[var(--surface)]"
        style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)' }}
      >
        {Array.from({ length: PLACEHOLDER_ROWS }, (_, i) => (
          <GuestRowSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
