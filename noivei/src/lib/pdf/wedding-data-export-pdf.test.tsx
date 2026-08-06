import { describe, expect, it } from 'vitest'
import { renderWeddingDataExportPdf } from './wedding-data-export-pdf'
import type { ExportPayload } from '@/lib/export/wedding-export-payload'

const emptyPayload: ExportPayload = {
  exported_at:     '2026-08-06T12:00:00.000Z',
  wedding:         null,
  profile:         null,
  subscription:    null,
  guests:          [],
  checklist_items: [],
  financial: { entries: [], quotes: [], installments: [], category_budgets: [] },
  gift_registry: [],
  wedding_party: [],
  tables: { config: [], assignments: [] },
  site_config:    null,
  files:          [],
  gallery_photos: [],
  preferences:    null,
  members:        [],
  invites_sent:   [],
}

const fullPayload: ExportPayload = {
  exported_at: '2026-08-06T12:00:00.000Z',
  wedding: {
    id: 'w1', user_id: 'u1', couple_names: 'Ana & Bruno',
    bride_name: 'Ana', groom_name: 'Bruno',
    groom_entrance_position: 1, bride_entrance_position: 2,
    wedding_date: '2026-12-20', wedding_date_changed_count: 1,
    venue: 'Espaço Jardim', city: 'Campinas - SP',
    guest_limit: 100, budget: 5_000_000, style: 'rustico',
    wedding_color: '#C6943A', wedding_color_secondary: '#3A2A18',
    rsvp_message_template: null, wedding_score: 72, score_calculated_at: '2026-08-01T00:00:00.000Z',
    is_active: true, deleted_at: null, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-08-01T00:00:00.000Z',
  },
  profile: {
    id: 'u1', full_name: 'Ana Silva', avatar_url: null, role: 'user',
    notify_timeline: true, notify_rsvp: true, notify_members: true, notify_milestones: true,
    created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
  },
  subscription: {
    id: 's1', user_id: 'u1', plan_id: 'ideal', status: 'active', is_trial: false,
    trial_started_at: null, trial_ends_at: null,
    current_period_start: '2026-01-01T00:00:00.000Z', current_period_end: '2026-09-01T00:00:00.000Z',
    cancel_at_period_end: false, gateway: 'mercadopago', gateway_sub_id: 'mp123',
    expires_at: null, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
  },
  guests: [
    { id: 'g1', wedding_id: 'w1', name: 'Maria', group_name: 'Família', status: 'confirmado', rsvp_token: 't1', email: 'maria@example.com', phone: '11999999999', party_size: 2, attending_count: 2, parent_guest_id: null, invite_sent_at: null, checked_in_at: null, created_at: '2026-01-01T00:00:00.000Z' },
  ],
  checklist_items: [
    { id: 'c1', wedding_id: 'w1', label: 'Fechar buffet', category: 'Fornecedores', phase: null, catalog_key: null, due_date: '2026-10-01', completed: true, is_dismissed: false, is_archived: false, sort_order: 0, created_at: '2026-01-01T00:00:00.000Z' },
  ],
  financial: {
    entries: [
      { id: 'f1', wedding_id: 'w1', category: 'Buffet', vendor: 'Buffet X', description: 'Sinal', total_amount: 500_000, paid_amount: 100_000, due_date: '2026-11-01', attached_file_id: null, created_at: '2026-01-01T00:00:00.000Z' },
    ],
    quotes: [
      { id: 'q1', wedding_id: 'w1', type: 'buffet', vendor_name: 'Buffet Y', amount_cents: 450_000, notes: null, is_selected: false, financial_entry_id: null, created_at: '2026-01-01T00:00:00.000Z' },
    ],
    installments: [
      { id: 'i1', wedding_id: 'w1', financial_entry_id: 'f1', installment_number: 1, total_installments: 3, amount_cents: 166_666, due_date: '2026-11-01', paid: false, paid_at: null, created_at: '2026-01-01T00:00:00.000Z' },
    ],
    category_budgets: [
      { id: 'b1', wedding_id: 'w1', category: 'Buffet', budget_cents: 600_000, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
    ],
  },
  gift_registry: [
    { id: 'gi1', wedding_id: 'w1', name: 'Jogo de panelas', description: null, price_cents: 30_000, store_url: 'https://example.com', image_url: null, image_storage_path: null, image_size_bytes: null, gift_type: 'link', is_purchased: true, purchased_by: 'convidado', sort_order: 0, created_at: '2026-01-01T00:00:00.000Z' },
  ],
  wedding_party: [
    { id: 'wp1', wedding_id: 'w1', guest_id: 'g1', role: 'Madrinha', carries_rings: false, paired_with_entry_id: null, sort_order: 0, created_at: '2026-01-01T00:00:00.000Z' },
  ],
  tables: {
    config: [{ id: 't1', wedding_id: 'w1', label: 'Mesa 1', capacity: 8, created_at: '2026-01-01T00:00:00.000Z' }],
    assignments: [{ id: 'ta1', table_id: 't1', guest_id: 'g1', created_at: '2026-01-01T00:00:00.000Z' }],
  },
  site_config: {
    id: 'sc1', wedding_id: 'w1', slug: 'ana-bruno', published: true, template: 'classic',
    cover_photo_url: null, cover_photo_position: 50, cover_photo_zoom: 1, content: {}, created_at: '2026-01-01T00:00:00.000Z',
  },
  files: [
    { id: 'fi1', file_name: 'contrato-buffet.pdf', size_bytes: 204_800, mime_type: 'application/pdf', uploaded_by: 'u1', created_at: '2026-01-01T00:00:00.000Z' },
  ],
  gallery_photos: [
    { id: 'ph1', size_bytes: 1_048_576, mime_type: 'image/jpeg', uploaded_by: 'u1', created_at: '2026-01-01T00:00:00.000Z' },
  ],
  preferences: {
    id: 'p1', wedding_id: 'w1', answers: { estilo: 'rustico', orcamento: 'medio' },
    created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-02T00:00:00.000Z',
  },
  members: [
    { id: 'm1', wedding_id: 'w1', user_id: 'u1', role: 'owner', permissions: { full_access: true }, created_at: '2026-01-01T00:00:00.000Z' },
  ],
  invites_sent: [
    { id: 'inv1', wedding_id: 'w1', token: 'tok1', created_by: 'u1', status: 'accepted', expires_at: '2026-02-01T00:00:00.000Z', accepted_by: 'u2', accepted_at: '2026-01-15T00:00:00.000Z', permissions: { full_access: true }, invited_email: 'convidado@example.com', created_at: '2026-01-01T00:00:00.000Z' },
  ],
}

describe('renderWeddingDataExportPdf', () => {
  it('deve gerar um Buffer PDF não vazio quando o casamento não tem nenhum dado cadastrado', async () => {
    const buffer = await renderWeddingDataExportPdf(emptyPayload)

    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.length).toBeGreaterThan(0)
    // Todo PDF válido começa com a assinatura `%PDF-`.
    expect(buffer.subarray(0, 5).toString('utf-8')).toBe('%PDF-')
  })

  it('deve gerar um Buffer PDF não vazio quando o casamento tem dado em todas as seções', async () => {
    const buffer = await renderWeddingDataExportPdf(fullPayload)

    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.length).toBeGreaterThan(0)
    expect(buffer.subarray(0, 5).toString('utf-8')).toBe('%PDF-')
  })
})
