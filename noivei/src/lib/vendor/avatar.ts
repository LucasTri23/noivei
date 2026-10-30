export const VENDOR_AVATAR_MAX_BYTES = 2 * 1024 * 1024
export function avatarExtension(bytes: Uint8Array, mime: string): string | null {
  if (mime === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpg'
  if (mime === 'image/png' && [137,80,78,71,13,10,26,10].every((n, i) => bytes[i] === n)) return 'png'
  if (mime === 'image/webp' && String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP') return 'webp'
  return null
}
export function ownAvatarPath(vendorId: string, path: string): boolean {
  const parts = path.split('/')
  return parts.length === 2 && parts[0] === vendorId && /^[a-zA-Z0-9._-]+\.(jpg|jpeg|png|webp)$/.test(parts[1] ?? '')
}
