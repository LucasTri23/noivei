import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import LandingHero from '@/components/marketing/landing-hero'

export default async function RootPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect('/dashboard')

  return <LandingHero />
}
