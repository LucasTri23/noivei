import { createSupabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const checks: Record<string, 'ok' | 'error'> = {}

  try {
    const supabase = await createSupabaseServer()
    await supabase.from('plans').select('id').limit(1).throwOnError()
    checks.database = 'ok'
  } catch {
    checks.database = 'error'
  }

  const healthy   = Object.values(checks).every((v) => v === 'ok')
  const status    = healthy ? 200 : 503

  return Response.json(
    {
      status:    healthy ? 'healthy' : 'degraded',
      version:   process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev',
      timestamp: new Date().toISOString(),
      checks,
    },
    { status },
  )
}
