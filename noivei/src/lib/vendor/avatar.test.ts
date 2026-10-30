import { describe, expect, it } from 'vitest'
import { avatarExtension, ownAvatarPath } from './avatar'
describe('foto de fornecedor', () => {
  it('aceita assinaturas de JPG, PNG e WEBP e rejeita MIME forjado', () => {
    expect(avatarExtension(new Uint8Array([255,216,255]), 'image/jpeg')).toBe('jpg')
    expect(avatarExtension(new Uint8Array([137,80,78,71,13,10,26,10]), 'image/png')).toBe('png')
    expect(avatarExtension(new TextEncoder().encode('RIFF1234WEBP'), 'image/webp')).toBe('webp')
    expect(avatarExtension(new TextEncoder().encode('<svg/>'), 'image/png')).toBeNull()
    expect(avatarExtension(new Uint8Array([255,216,255]), 'image/png')).toBeNull()
  })
  it('não permite assinar ou apagar foto de outra conta ou caminho com traversal', () => {
    expect(ownAvatarPath('vendor-1', 'vendor-1/foto.png')).toBe(true)
    expect(ownAvatarPath('vendor-1', 'vendor-2/foto.png')).toBe(false)
    expect(ownAvatarPath('vendor-1', 'vendor-1/../vendor-2/foto.png')).toBe(false)
    expect(ownAvatarPath('vendor-1', 'vendor-1/foto.svg')).toBe(false)
  })
})
