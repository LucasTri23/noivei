import type { SupabaseClient } from '@supabase/supabase-js'

export interface RateLimitResult {
  allowed:   boolean
  remaining: number
}

/** Checa e registra um hit pra `key` numa janela de tempo, via fn_check_rate_limit (SECURITY DEFINER). */
export async function checkRateLimit(
  supabase:      SupabaseClient,
  key:           string,
  maxHits:       number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const { data, error } = (await supabase
    .rpc('fn_check_rate_limit', { p_key: key, p_max_hits: maxHits, p_window_seconds: windowSeconds })
    .maybeSingle()) as { data: RateLimitResult | null; error: { message: string } | null }

  if (error || !data) {
    // Fail-open: uma falha de infra no rate limit não pode travar o produto inteiro.
    console.error('[rate-limit] falha ao checar limite:', error)
    return { allowed: true, remaining: maxHits }
  }

  return data
}

/** Extrai o IP do cliente a partir dos headers de proxy (Vercel). Sem precedente no projeto — não há confiança de rede além do proxy da própria Vercel. */
export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0]!.trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}
