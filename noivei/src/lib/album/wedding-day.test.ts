import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { isAlbumUploadWindowOpen } from './wedding-day'

// "Hoje" fixado em 2026-08-15 no fuso America/Sao_Paulo (meio-dia UTC-3, longe
// da meia-noite, sem risco de cair no dia errado por causa do fake timer).
const FAKE_NOW = new Date('2026-08-15T12:00:00-03:00')

describe('isAlbumUploadWindowOpen', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FAKE_NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('deve retornar false quando weddingDate é null', () => {
    expect(isAlbumUploadWindowOpen(null)).toBe(false)
  })

  it('deve retornar true no dia do casamento', () => {
    expect(isAlbumUploadWindowOpen('2026-08-15')).toBe(true)
  })

  it('deve retornar true no dia seguinte ao casamento', () => {
    expect(isAlbumUploadWindowOpen('2026-08-14')).toBe(true)
  })

  it('deve retornar false a partir de 2 dias depois do casamento', () => {
    expect(isAlbumUploadWindowOpen('2026-08-13')).toBe(false)
  })

  it('deve retornar false no dia anterior ao casamento', () => {
    expect(isAlbumUploadWindowOpen('2026-08-16')).toBe(false)
  })
})
