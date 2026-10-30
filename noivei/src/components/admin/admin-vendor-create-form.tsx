'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AdminCreateVendorSchema } from '@/lib/api/validation/admin-vendor.schema'
import { toastSuccess } from '@/store/toast.store'

const inputStyle = { width: '100%', padding: '11px 13px', border: '1.5px solid #E4D8C8', borderRadius: '10px', background: '#fff', color: '#3C2818', fontSize: '14px' }
const fields = [
  ['business_name', 'Nome da empresa *', 'text', true],
  ['email', 'E-mail do fornecedor *', 'email', true],
  ['cnpj', 'CNPJ *', 'text', true],
  ['phone', 'Telefone', 'tel', false],
  ['whatsapp', 'WhatsApp', 'tel', false],
  ['city', 'Cidade', 'text', false],
  ['state', 'Estado', 'text', false],
] as const

export default function AdminVendorCreateForm({ categories }: { categories: { id: string; label: string }[] }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<string[]>([])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    setError('')
    const data = new FormData(event.currentTarget)
    const values = Object.fromEntries(data.entries())
    const parsed = AdminCreateVendorSchema.safeParse({ ...values, show_whatsapp: data.get('show_whatsapp') === 'on', category_ids: selected })
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Confira os dados.'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/v1/admin/vendors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed.data) })
      const body = await res.json() as { data?: { id: string; invited: boolean }; error?: { message: string } }
      if (!res.ok || !body.data) { setError(body.error?.message ?? 'Não foi possível cadastrar.'); return }
      toastSuccess(body.data.invited ? 'Fornecedor cadastrado e aprovado. Convite enviado por e-mail.' : 'Fornecedor cadastrado e aprovado, vinculado à conta existente.')
      router.push('/admin/fornecedores/' + body.data.id)
      router.refresh()
    } catch { setError('Não foi possível conectar. Confira a conexão e tente novamente.') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ maxWidth: '760px' }}>
      <Link href="/admin/fornecedores" style={{ color: '#8A5A2E', fontSize: '14px' }}>Voltar para fornecedores</Link>
      <h1 className="font-display" style={{ fontSize: '28px', color: '#3C2818', margin: '16px 0 10px' }}>Adicionar fornecedor</h1>
      <p style={{ color: '#6B5B47', lineHeight: 1.6 }}>O cadastro feito pelo administrador já fica aprovado. Uma conta de fornecedor existente será vinculada pelo e-mail. Contas de noivos precisam usar outro e-mail; quem ainda não tem conta receberá um convite para definir a senha. Para aparecer no marketplace, o fornecedor também precisa de uma assinatura ativa.</p>
      <form onSubmit={submit} style={{ background: '#fff', borderRadius: '16px', padding: '24px', marginTop: '20px' }}>
        <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map(([name, label, type, required]) => (
              <div key={name}>
                <label htmlFor={'create-vendor-' + name} style={{ display: 'block', marginBottom: '6px', color: '#3C2818', fontSize: '14px', fontWeight: 600 }}>{label}</label>
                <input id={'create-vendor-' + name} name={name} type={type} required={required} style={inputStyle} />
              </div>
            ))}
          </div>
          <label style={{ display: 'flex', gap: '8px', margin: '18px 0', color: '#3C2818' }}><input type="checkbox" name="show_whatsapp" />Exibir WhatsApp no perfil</label>
          <label htmlFor="create-vendor-description" style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>Descrição</label>
          <textarea id="create-vendor-description" name="description" rows={4} maxLength={2000} style={inputStyle} />
          <fieldset style={{ border: '1px solid #E4D8C8', borderRadius: '10px', margin: '18px 0', padding: '14px' }}>
            <legend>Categorias *</legend>
            {categories.length === 0 && <p>Cadastre uma categoria ativa antes de adicionar fornecedores.</p>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
              {categories.map((category) => <label key={category.id} style={{ display: 'flex', gap: '6px' }}>
                <input type="checkbox" checked={selected.includes(category.id)} onChange={(event) => setSelected((ids) => event.target.checked ? [...ids, category.id] : ids.filter((id) => id !== category.id))} />{category.label}
              </label>)}
            </div>
          </fieldset>
          {error && <p role="alert" style={{ color: '#C0553F', marginBottom: '14px' }}>{error}</p>}
          <button type="submit" disabled={saving || categories.length === 0} style={{ padding: '12px 20px', border: 0, borderRadius: '10px', background: '#5E8B6A', color: '#fff', fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>{saving ? 'Cadastrando…' : 'Cadastrar e aprovar fornecedor'}</button>
        </fieldset>
      </form>
    </div>
  )
}
