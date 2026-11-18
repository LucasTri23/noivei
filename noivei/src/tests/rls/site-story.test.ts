// RLS e integridade da seção Nossa História (migration 20261118000002):
// isolamento entre casais, FK composta (foto/momento do mesmo casamento),
// finalidade imutável da foto, tetos e RPCs com checagem de módulo.
// Requer Supabase local (ver helpers.ts) — pula sem as variáveis de ambiente.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { createServiceClient, createTestUser, createTestWedding, deleteTestUser, hasLiveSupabase, type TestUser } from './helpers'

describe.skipIf(!hasLiveSupabase())('RLS site_story_moments / site_story_photos', () => {
  let service: SupabaseClient<Database>
  let coupleA: TestUser
  let coupleB: TestUser
  let weddingA: string
  let weddingB: string
  let momentA: string
  let momentB: string

  async function insertPhoto(weddingId: string, userId: string, purpose: 'gallery' | 'story'): Promise<string> {
    const { data, error } = await service
      .from('wedding_gallery_photos')
      .insert({ wedding_id: weddingId, storage_path: `${weddingId}/${crypto.randomUUID()}.jpg`, size_bytes: 10, uploaded_by: userId, purpose })
      .select('id')
      .single()
    if (error || !data) throw new Error(error?.message)
    return data.id as string
  }

  beforeAll(async () => {
    service = createServiceClient()
    coupleA = await createTestUser(service, 'story-a')
    coupleB = await createTestUser(service, 'story-b')
    weddingA = await createTestWedding(service, coupleA.userId, 'Casal A')
    weddingB = await createTestWedding(service, coupleB.userId, 'Casal B')

    const { data: a } = await service.from('site_story_moments').insert({ wedding_id: weddingA, title: 'A' }).select('id').single()
    const { data: b } = await service.from('site_story_moments').insert({ wedding_id: weddingB, title: 'B' }).select('id').single()
    momentA = a!.id as string
    momentB = b!.id as string
  })

  afterAll(async () => {
    if (coupleA) await deleteTestUser(service, coupleA.userId)
    if (coupleB) await deleteTestUser(service, coupleB.userId)
  })

  it('deve permitir ao casal ler os próprios momentos', async () => {
    const { data } = await coupleA.client.from('site_story_moments').select('id').eq('wedding_id', weddingA)
    expect(data?.map((m) => m.id)).toContain(momentA)
  })

  it('não deve deixar um casal ler, criar ou alterar momentos de outro', async () => {
    const { data: read } = await coupleB.client.from('site_story_moments').select('id').eq('wedding_id', weddingA)
    expect(read).toEqual([])

    const { error: insertError } = await coupleB.client.from('site_story_moments').insert({ wedding_id: weddingA, title: 'invasão' })
    expect(insertError).not.toBeNull()

    const { data: updated } = await coupleB.client.from('site_story_moments').update({ title: 'x' }).eq('id', momentA).select('id')
    expect(updated ?? []).toEqual([])
  })

  it('deve impedir no banco foto ligada a momento de outro casamento', async () => {
    const photoId = await insertPhoto(weddingA, coupleA.userId, 'story')
    const { error } = await service.from('site_story_photos').insert({ photo_id: photoId, wedding_id: weddingA, moment_id: momentB })
    expect(error?.code).toBe('23503')
  })

  it('deve impedir metadados de história em foto de galeria ou de outro casamento', async () => {
    const galleryPhoto = await insertPhoto(weddingA, coupleA.userId, 'gallery')
    const { error: purposeError } = await service.from('site_story_photos').insert({ photo_id: galleryPhoto, wedding_id: weddingA })
    expect(purposeError).not.toBeNull()

    const otherPhoto = await insertPhoto(weddingB, coupleB.userId, 'story')
    const { error: weddingError } = await service.from('site_story_photos').insert({ photo_id: otherPhoto, wedding_id: weddingA })
    expect(weddingError).not.toBeNull()
  })

  it('deve manter imutável a finalidade da foto', async () => {
    const photoId = await insertPhoto(weddingA, coupleA.userId, 'story')
    const { error } = await service.from('wedding_gallery_photos').update({ purpose: 'gallery' }).eq('id', photoId)
    expect(error?.code).toBe('23514')
  })

  it('deve desvincular as fotos ao excluir o momento, sem apagá-las', async () => {
    const { data: moment } = await service.from('site_story_moments').insert({ wedding_id: weddingA, title: 'temp' }).select('id').single()
    const photoId = await insertPhoto(weddingA, coupleA.userId, 'story')
    await service.from('site_story_photos').insert({ photo_id: photoId, wedding_id: weddingA, moment_id: moment!.id })

    await service.from('site_story_moments').delete().eq('id', moment!.id)
    const { data } = await service.from('site_story_photos').select('moment_id, wedding_id').eq('photo_id', photoId).single()
    expect(data).toEqual({ moment_id: null, wedding_id: weddingA })
  })

  it('não deve deixar outro casal usar as RPCs no casamento alheio', async () => {
    const { error: reorderError } = await coupleB.client.rpc('fn_reorder_site_story', { p_wedding_id: weddingA, p_kind: 'moments', p_ids: [momentA] })
    expect(reorderError?.code).toBe('42501')

    const { error: addError } = await coupleB.client.rpc('fn_add_site_story_photo', {
      p_wedding_id: weddingA, p_storage_path: `${weddingA}/x.jpg`, p_size_bytes: 10, p_mime_type: 'image/jpeg',
      p_width: null, p_height: null, p_caption: null, p_moment_id: null,
    })
    expect(addError?.code).toBe('42501')
  })

  it('deve registrar foto da história atomicamente pela RPC do próprio casal', async () => {
    const path = `${weddingA}/${crypto.randomUUID()}.jpg`
    const { data: photoId, error } = await coupleA.client.rpc('fn_add_site_story_photo', {
      p_wedding_id: weddingA, p_storage_path: path, p_size_bytes: 10, p_mime_type: 'image/jpeg',
      p_width: 800, p_height: 600, p_caption: ' Praia ', p_moment_id: momentA,
    })
    expect(error).toBeNull()
    const { data } = await service.from('site_story_photos').select('caption, moment_id').eq('photo_id', photoId as string).single()
    expect(data).toEqual({ caption: 'Praia', moment_id: momentA })
  })

  it('deve aplicar o teto de 20 momentos', async () => {
    const { count } = await service.from('site_story_moments').select('id', { count: 'exact', head: true }).eq('wedding_id', weddingB)
    const missing = 20 - (count ?? 0)
    await service.from('site_story_moments').insert(Array.from({ length: missing }, (_, i) => ({ wedding_id: weddingB, title: `m${i}` })))
    const { error } = await service.from('site_story_moments').insert({ wedding_id: weddingB, title: 'excedente' })
    expect(error?.hint).toBe('STORY_MOMENT_LIMIT')
  })
})
