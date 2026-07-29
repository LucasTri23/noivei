import { requireWeddingOwner } from '@/lib/api/guards/ownership'
import { ok, err, handleApiError } from '@/lib/api/response'
import { requireAuth } from '@/lib/auth/require-auth'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { createSupabaseServer } from '@/lib/supabase/server'
import type {
  ChecklistItem,
  FinancialCategoryBudget,
  FinancialEntry,
  FinancialInstallment,
  FinancialQuote,
  GiftRegistryItem,
  Guest,
  Profile,
  SiteConfig,
  Subscription,
  TableConfig,
  Wedding,
  WeddingInvite,
  WeddingMember,
  WeddingPartyEntry,
  WeddingPreferences,
} from '@/types/database'

interface RouteContext {
  params: Promise<{ wid: string }>
}

// Metadados de arquivo/foto exportados — nunca o conteúdo binário nem um link assinado
// pro Storage (LGPD art. 18 pede os dados, não um jeito de baixar os arquivos originais
// por aqui; quem quer o arquivo em si já tem a Central de Arquivos/Galeria pra isso).
interface ExportedFileMeta {
  id:          string
  file_name:   string
  size_bytes:  number
  mime_type:   string | null
  uploaded_by: string
  created_at:  string
}

interface ExportedGalleryPhotoMeta {
  id:          string
  size_bytes:  number
  mime_type:   string | null
  uploaded_by: string
  created_at:  string
}

interface ExportedTableAssignment {
  id:         string
  table_id:   string
  guest_id:   string
  created_at: string
}

interface ExportPayload {
  exported_at: string
  wedding:     Wedding | null
  profile:     Profile | null
  subscription: Subscription | null
  guests:      Guest[]
  checklist_items: ChecklistItem[]
  financial: {
    entries:           FinancialEntry[]
    quotes:            FinancialQuote[]
    installments:      FinancialInstallment[]
    category_budgets:  FinancialCategoryBudget[]
  }
  gift_registry: GiftRegistryItem[]
  wedding_party: WeddingPartyEntry[]
  tables: {
    config:      TableConfig[]
    assignments: ExportedTableAssignment[]
  }
  site_config: SiteConfig | null
  files:          ExportedFileMeta[]
  gallery_photos: ExportedGalleryPhotoMeta[]
  preferences: WeddingPreferences | null
  members:     WeddingMember[]
  invites_sent: WeddingInvite[]
}

// Exportação completa dos dados pessoais do casamento (LGPD art. 18, direito à
// portabilidade) — até aqui "Exportar meus dados" só devolvia um CSV de convidados,
// o que não cumpre a promessa do botão. Restrito ao DONO (não a membro convidado):
// exportar TODOS os dados do casamento é uma ação sensível de conta, mesmo padrão já
// usado em gift-payments/connect e /disconnect após a auditoria de segurança (SEC-03).
export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAuth()
    const supabase = await createSupabaseServer()
    const { wid } = await params

    await requireWeddingOwner(supabase, wid, user.id)

    // Gerar o export inteiro é pesado (~19 queries) — não é uma ação de negócio que
    // faz sentido repetir em loop, mesmo padrão de checkRateLimit usado em
    // billing/cancel-subscription.
    const limitCheck = await checkRateLimit(supabase, `export-data:${user.id}`, 10, 3600)
    if (!limitCheck.allowed) return err(429, 'RATE_LIMITED', 'Muitas exportações. Aguarde um pouco e tente de novo.')

    const [
      weddingRes,
      profileRes,
      subscriptionRes,
      guestsRes,
      checklistRes,
      financialEntriesRes,
      financialQuotesRes,
      financialInstallmentsRes,
      financialBudgetsRes,
      giftRegistryRes,
      weddingPartyRes,
      tablesConfigRes,
      tableAssignmentsRes,
      siteConfigRes,
      filesRes,
      galleryPhotosRes,
      preferencesRes,
      membersRes,
      invitesRes,
    ] = await Promise.all([
      supabase
        .from('weddings')
        .select('id, user_id, couple_names, bride_name, groom_name, groom_entrance_position, bride_entrance_position, wedding_date, venue, city, guest_limit, budget, style, wedding_color, wedding_color_secondary, rsvp_message_template, wedding_score, score_calculated_at, is_active, deleted_at, created_at, updated_at')
        .eq('id', wid)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role, notify_timeline, notify_rsvp, created_at, updated_at')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('subscriptions')
        .select('id, user_id, plan_id, status, is_trial, trial_started_at, trial_ends_at, current_period_start, current_period_end, cancel_at_period_end, gateway, gateway_sub_id, expires_at, created_at, updated_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('guests')
        .select('id, wedding_id, name, group_name, status, rsvp_token, email, phone, party_size, attending_count, parent_guest_id, invite_sent_at, created_at')
        .eq('wedding_id', wid),
      supabase
        .from('checklist_items')
        .select('id, wedding_id, label, category, phase, catalog_key, due_date, completed, is_dismissed, is_archived, sort_order, created_at')
        .eq('wedding_id', wid),
      supabase
        .from('financial_entries')
        .select('id, wedding_id, category, vendor, description, total_amount, paid_amount, due_date, created_at')
        .eq('wedding_id', wid),
      supabase
        .from('financial_quotes')
        .select('id, wedding_id, type, vendor_name, amount_cents, notes, is_selected, financial_entry_id, created_at')
        .eq('wedding_id', wid),
      // financial_installments tem wedding_id direto (não precisa passar por
      // financial_entries) — confirmado na migration 20260703000017.
      supabase
        .from('financial_installments')
        .select('id, wedding_id, financial_entry_id, installment_number, total_installments, amount_cents, due_date, paid, paid_at, created_at')
        .eq('wedding_id', wid),
      supabase
        .from('financial_category_budgets')
        .select('id, wedding_id, category, budget_cents, created_at, updated_at')
        .eq('wedding_id', wid),
      supabase
        .from('gift_registry_items')
        .select('id, wedding_id, name, description, price_cents, store_url, image_url, image_storage_path, image_size_bytes, gift_type, is_purchased, purchased_by, sort_order, created_at')
        .eq('wedding_id', wid),
      supabase
        .from('wedding_party_entries')
        .select('id, wedding_id, guest_id, role, carries_rings, paired_with_entry_id, sort_order, created_at')
        .eq('wedding_id', wid),
      supabase
        .from('tables_config')
        .select('id, wedding_id, label, capacity, created_at')
        .eq('wedding_id', wid),
      // table_assignments não tem wedding_id próprio (migration 20260703000001) — o
      // vínculo é via table_id -> tables_config.wedding_id. Usa embed !inner pra
      // filtrar na própria query (fica em paralelo com as demais) em vez de uma
      // segunda rodada dependente de tables_config.
      supabase
        .from('table_assignments')
        .select('id, table_id, guest_id, created_at, tables_config!inner(wedding_id)')
        .eq('tables_config.wedding_id', wid),
      supabase
        .from('site_config')
        .select('id, wedding_id, slug, published, cover_photo_url, cover_photo_position, content, created_at')
        .eq('wedding_id', wid)
        .maybeSingle(),
      // Só metadados — nunca o binário nem um link assinado do Storage.
      supabase
        .from('wedding_files')
        .select('id, file_name, size_bytes, mime_type, uploaded_by, created_at')
        .eq('wedding_id', wid),
      supabase
        .from('wedding_gallery_photos')
        .select('id, size_bytes, mime_type, uploaded_by, created_at')
        .eq('wedding_id', wid),
      supabase
        .from('wedding_preferences')
        .select('id, wedding_id, answers, created_at, updated_at')
        .eq('wedding_id', wid)
        .maybeSingle(),
      supabase
        .from('wedding_members')
        .select('id, wedding_id, user_id, role, permissions, created_at')
        .eq('wedding_id', wid),
      supabase
        .from('wedding_invites')
        .select('id, wedding_id, token, created_by, status, expires_at, accepted_by, accepted_at, permissions, created_at')
        .eq('wedding_id', wid),
    ])

    const firstError = [
      weddingRes, profileRes, subscriptionRes, guestsRes, checklistRes,
      financialEntriesRes, financialQuotesRes, financialInstallmentsRes, financialBudgetsRes,
      giftRegistryRes, weddingPartyRes, tablesConfigRes, tableAssignmentsRes, siteConfigRes,
      filesRes, galleryPhotosRes, preferencesRes, membersRes, invitesRes,
    ].find((res) => res.error)?.error

    if (firstError) {
      console.error('[weddings/export] erro ao buscar dados:', firstError)
      return err(500, 'DB_ERROR', 'Erro ao gerar a exportação. Tente novamente.')
    }

    const payload: ExportPayload = {
      exported_at: new Date().toISOString(),
      wedding:     (weddingRes.data as Wedding | null) ?? null,
      profile:     (profileRes.data as Profile | null) ?? null,
      subscription: (subscriptionRes.data as Subscription | null) ?? null,
      guests:      (guestsRes.data ?? []) as Guest[],
      checklist_items: (checklistRes.data ?? []) as ChecklistItem[],
      financial: {
        entries:          (financialEntriesRes.data ?? []) as FinancialEntry[],
        quotes:            (financialQuotesRes.data ?? []) as FinancialQuote[],
        installments:      (financialInstallmentsRes.data ?? []) as FinancialInstallment[],
        category_budgets:  (financialBudgetsRes.data ?? []) as FinancialCategoryBudget[],
      },
      gift_registry: (giftRegistryRes.data ?? []) as GiftRegistryItem[],
      wedding_party: (weddingPartyRes.data ?? []) as WeddingPartyEntry[],
      tables: {
        config: (tablesConfigRes.data ?? []) as TableConfig[],
        // Descarta o objeto tables_config embutido usado só pra filtrar — o export
        // não precisa repetir wedding_id em cada linha de assignment.
        assignments: ((tableAssignmentsRes.data ?? []) as Array<ExportedTableAssignment & { tables_config: unknown }>)
          .map(({ id, table_id, guest_id, created_at }) => ({ id, table_id, guest_id, created_at })),
      },
      site_config: (siteConfigRes.data as SiteConfig | null) ?? null,
      files:          (filesRes.data ?? []) as ExportedFileMeta[],
      gallery_photos: (galleryPhotosRes.data ?? []) as ExportedGalleryPhotoMeta[],
      preferences: (preferencesRes.data as WeddingPreferences | null) ?? null,
      members:     (membersRes.data ?? []) as WeddingMember[],
      invites_sent: (invitesRes.data ?? []) as WeddingInvite[],
    }

    return ok(payload)
  } catch (error) {
    return handleApiError(error)
  }
}
