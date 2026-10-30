import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import { requireAccountType } from '@/lib/auth/account-type'
import { ApiError } from '@/lib/api/response'
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  try { await requireAccountType(supabase, 'couple') }
  catch (error) {
    if (error instanceof ApiError && error.code === 'ACCOUNT_TYPE_CONFLICT') redirect('/fornecedor')
    throw error
  }
  return children
}
