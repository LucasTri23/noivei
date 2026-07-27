import AdminSettingsManager from '@/components/admin/admin-settings-manager'
import { createSupabaseServer } from '@/lib/supabase/server'

export const metadata = { title: 'Admin · Configurações' }

export default async function AdminConfiguracoesPage() {
  const supabase = await createSupabaseServer()

  const { data: settings } = await supabase
    .from('app_settings')
    .select('platform_fee_percent')
    .eq('id', true)
    .maybeSingle()

  return (
    // Number(...) por segurança: NUMERIC do Postgres pode vir como string via PostgREST.
    <AdminSettingsManager initialPlatformFeePercent={Number(settings?.platform_fee_percent ?? 5)} />
  )
}
