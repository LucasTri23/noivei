'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import VendorAvatar from '@/components/vendors/vendor-avatar'
import { toastError, toastSuccess } from '@/store/toast.store'
export default function VendorAvatarManager({ name, slug, hasPhoto }: { name: string; slug: string; hasPhoto: boolean }) {
  const [src, setSrc] = useState<string | null>(hasPhoto ? '/api/v1/vendors/' + slug + '/avatar' : null)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const router = useRouter()
  async function save(file?: File) {
    if (busy) return
    if (file && (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024)) { toastError('Use JPG, PNG ou WEBP de até 2 MB.'); return }
    setBusy(true)
    try {
      const form = new FormData()
      if (file) form.append('photo', file)
      const res = await fetch('/api/v1/vendor/avatar', { method: file ? 'POST' : 'DELETE', body: file ? form : undefined })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error?.message ?? 'Não foi possível salvar a foto.')
      setSrc(file ? result.data.avatar_url : null)
      toastSuccess(file ? 'Foto atualizada.' : 'Foto removida.')
      router.refresh()
    } catch (error) { toastError(error instanceof Error ? error.message : 'Erro ao salvar foto.') }
    finally { setBusy(false) }
  }
  return <section style={{ display: 'flex', gap: 20, alignItems: 'center', padding: 22, border: '1px solid var(--border)', borderRadius: 16, background: 'var(--surface)', marginBottom: 24, flexWrap: 'wrap' }}>
    <VendorAvatar name={name} src={src} size={80} />
    <div><h2 style={{ fontSize: 16, fontWeight: 600 }}>Foto da empresa</h2><p style={{ fontSize: 13, color: 'var(--muted-fg)', margin: '5px 0 12px' }}>Sua foto ou logotipo aparecerá no perfil, na busca e nas conversas.</p>
    <input ref={input} aria-label="Enviar foto da empresa" type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void save(file) }} />
    <button type="button" disabled={busy} onClick={() => input.current?.click()} style={{ padding: '9px 15px', background: 'var(--wedding-color-dark)', color: '#fff', borderRadius: 9 }}>{busy ? 'Salvando…' : 'Escolher foto'}</button>
    {src && <button type="button" disabled={busy} onClick={() => void save()} style={{ marginLeft: 14, color: 'var(--muted-fg)' }}>Remover</button>}</div>
  </section>
}
