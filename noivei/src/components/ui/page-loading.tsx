import Spinner from '@/components/ui/spinner'

export default function PageLoading() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-[var(--surface)] p-10 text-center"
      style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)', color: 'var(--muted-fg)', fontSize: '14px' }}
    >
      <Spinner size={22} color="var(--wedding-color)" />
      Carregando…
    </div>
  )
}
