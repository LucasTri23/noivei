// Trava de plano dos recursos pagos do site no banco (migration 20261124000001):
// mesmo gravando direto pelo Supabase (sem passar pela API), um casamento no
// plano Gratuito não ativa fontes, fundo, selo, hospedagem nem monograma.
// Requer Supabase local (ver helpers.ts) — pula sem as variáveis de ambiente.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { createServiceClient, createTestUser, createTestWedding, deleteTestUser, hasLiveSupabase, type TestUser } from './helpers'

describe.skipIf(!hasLiveSupabase())('site_config — trava de plano da personalização', () => {
  let service: SupabaseClient<Database>
  let couple: TestUser
  let weddingId: string

  beforeAll(async () => {
    service = createServiceClient()
    couple = await createTestUser(service, 'site-custom')
    weddingId = await createTestWedding(service, couple.userId, 'Casal Gratuito')
    const { error } = await couple.client.from('site_config').insert({ wedding_id: weddingId, slug: `custom-${Date.now()}`, content: {} })
    if (error) throw new Error(error.message)
  })

  afterAll(async () => {
    if (couple) await deleteTestUser(service, couple.userId)
  })

  async function saveContent(content: Record<string, unknown>) {
    return couple.client.from('site_config').update({ content }).eq('wedding_id', weddingId)
  }

  it.each([
    { font_pair: 'elegante' },
    { palette: { tone: 'dark' } },
    { palette: { seal: 'wax' } },
    { lodging: [{ name: 'Hotel' }] },
    { monogram_image_url: 'https://x.supabase.co/storage/v1/object/public/wedding-photos/a/b.png' },
    { envelope_monogram: 'A & J' },
  ])('deve bloquear no Gratuito: %j', async (content) => {
    const { error } = await saveContent(content)
    expect(error?.code).toBe('42501')
  })

  it('deve liberar cor de destaque, seções e perguntas frequentes no Gratuito', async () => {
    const { error } = await saveContent({
      palette: { accent: '#7A2E3B' }, sections: { order: ['faq'], hidden: ['mural'] }, faq: [{ question: 'P', answer: 'R' }],
    })
    expect(error).toBeNull()
  })

  it('deve aceitar a finalidade brand e manter a finalidade imutável', async () => {
    const { data, error } = await couple.client
      .from('wedding_gallery_photos')
      .insert({ wedding_id: weddingId, storage_path: `${weddingId}/${crypto.randomUUID()}.png`, size_bytes: 10, uploaded_by: couple.userId, purpose: 'brand' })
      .select('id')
      .single()
    expect(error).toBeNull()
    const { error: changeError } = await couple.client.from('wedding_gallery_photos').update({ purpose: 'gallery' }).eq('id', data!.id)
    expect(changeError?.code).toBe('23514')
  })
})
