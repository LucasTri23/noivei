import { isCnpj } from '@/lib/vendor/cnpj'
import { deliverVendorEmails } from '@/lib/vendor/deliver-vendor-emails'
import { requireVendorProfile } from '@/lib/api/guards/vendor'
import { ok, err, handleApiError } from '@/lib/api/response'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { MarketplaceVendorStatus, VendorProfile } from '@/types/database'

// ÚNICA transição de status que o próprio fornecedor pode disparar — tudo o mais
// (aprovar/pausar/suspender/destacar) é admin-only (fase futura). Rota de propósito
// único: nunca aceita um "status" no body, sempre recalcula a partir do que já está
// gravado (vendor.status, buscado de novo aqui — nunca de um valor vindo do client).
//
// Estados de origem permitidos: 'draft' (primeiro envio) e 'rejected' (reenvio após
// correção — o fornecedor edita os dados pelo mesmo wizard e reenvia; ver
// STATUS_COPY em src/app/(vendor)/fornecedor/page.tsx). Os demais ('pending_review'
// já está em fila; 'active'/'paused'/'suspended' são geridos só por admin) retornam
// 409 — nunca 200 silencioso.
const ALLOWED_FROM_STATUSES: MarketplaceVendorStatus[] = ['draft', 'rejected']

export async function POST() {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()

    // Ação rara em uso normal (1x por aprovação, poucas vezes em caso de rejeição) —
    // teto baixo evita abuso de quem tentar martelar o endpoint.
    const limitCheck = await checkRateLimit(supabase, `vendor-submit-review:${user.id}`, 10, 3600)
    if (!limitCheck.allowed) {
      return err(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um pouco e tente de novo.')
    }

    const vendor = await requireVendorProfile(supabase, user.id)
    if (!vendor.cnpj || !isCnpj(vendor.cnpj)) {
      return err(400, 'CNPJ_REQUIRED', 'Informe o CNPJ da empresa antes de enviar a solicitação.')
    }

    if (!ALLOWED_FROM_STATUSES.includes(vendor.status)) {
      return err(409, 'INVALID_STATUS_TRANSITION', 'Seu cadastro não está em um estado que permite envio para análise.')
    }

    // Mesma regra de "pelo menos 1 categoria" que trava o Passo 2 do wizard — checada
    // de novo aqui pra não depender só da UI (defesa em profundidade).
    const { count, error: countError } = await supabase
      .from('vendor_category_links')
      .select('*', { count: 'exact', head: true })
      .eq('vendor_id', vendor.id)

    if (countError) return err(500, 'DB_ERROR', 'Erro ao verificar categorias.')
    if (!count) return err(400, 'NO_CATEGORIES', 'Selecione ao menos uma categoria antes de enviar para análise.')

    // `.eq('status', vendor.status)` é a garantia real da transição (não o `if`
    // acima, que só evita a query em casos óbvios): se outra requisição mudou o
    // status entre o fetch de `vendor` e este UPDATE, a cláusula não afeta nenhuma
    // linha e `data` volta null — tratado como conflito abaixo, não como sucesso.
    const { data, error } = await supabase
      .from('vendor_profiles')
      .update({ status: 'pending_review' as MarketplaceVendorStatus })
      .eq('id', vendor.id)
      .eq('status', vendor.status)
      .select()
      .maybeSingle()

    if (error) return err(500, 'DB_ERROR', 'Erro ao enviar para análise.')
    if (!data) return err(409, 'INVALID_STATUS_TRANSITION', 'Seu cadastro não está em um estado que permite envio para análise.')

    await deliverVendorEmails(vendor.id)
    return ok(data as VendorProfile)
  } catch (error) {
    return handleApiError(error)
  }
}
