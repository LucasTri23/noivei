import FileArchiveManager from '@/components/files/file-archive-manager'
import PaywallGate from '@/components/billing/paywall-gate'
import ModuleAccessGate from '@/components/billing/module-access-gate'
import { checkStorageLimit } from '@/lib/billing/check-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { WeddingFile } from '@/types/database'

export default async function ArquivosPage() {
  const supabase = await createSupabaseServer()

  const { data: wedding } = await supabase
    .from('weddings')
    .select('id')
    .is('deleted_at', null)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  if (!wedding) {
    return (
      <div
        className="rounded-2xl bg-[var(--surface)] p-10 text-center"
        style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)', color: 'var(--muted-fg)', fontSize: '14px' }}
      >
        Complete o onboarding para começar a guardar seus arquivos.
      </div>
    )
  }

  const weddingId = wedding.id as string

  const [{ data: files }, limitCheck] = await Promise.all([
    supabase
      .from('wedding_files')
      .select('*')
      .eq('wedding_id', weddingId)
      .order('created_at', { ascending: false }),
    checkStorageLimit(supabase, weddingId, 0),
  ])

  return (
    <ModuleAccessGate module="arquivos">
      <PaywallGate feature="arquivos">
        <FileArchiveManager
          weddingId={weddingId}
          initialFiles={(files ?? []) as WeddingFile[]}
          storageLimitBytes={limitCheck.limit}
        />
      </PaywallGate>
    </ModuleAccessGate>
  )
}
