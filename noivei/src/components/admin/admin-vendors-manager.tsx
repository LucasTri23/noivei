'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toastError } from '@/store/toast.store'
import type { MarketplaceVendorStatus } from '@/types/database'

interface VendorRow {
  id:                   string
  business_name:        string
  slug:                 string
  city:                 string | null
  state:                string | null
  status:               MarketplaceVendorStatus
  featured:             boolean
  created_at:           string
  category_labels:      string[]
  subscription_plan_id: string | null
  subscription_status:  string | null
}

const STATUS_OPTS: { value: MarketplaceVendorStatus | ''; label: string }[] = [
  { value: '',               label: 'Todos os status' },
  { value: 'draft',          label: 'Rascunho' },
  { value: 'pending_review', label: 'Em análise' },
  { value: 'active',         label: 'Ativo' },
  { value: 'paused',         label: 'Pausado' },
  { value: 'suspended',      label: 'Suspenso' },
  { value: 'rejected',       label: 'Não aprovado' },
]

const STATUS_COLOR: Record<MarketplaceVendorStatus, string> = {
  draft:          '#8A7D6E',
  pending_review: '#B8862F',
  active:         '#5E8B6A',
  paused:         '#8A7D6E',
  suspended:      '#C0553F',
  rejected:       '#C0553F',
}

const inputStyle: React.CSSProperties = {
  border: '1.5px solid #E4D8C8', borderRadius: '10px', padding: '10px 13px',
  fontSize: '14px', color: '#2A1E10', background: '#fff', outline: 'none',
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

export default function AdminVendorsManager() {
  const [vendors, setVendors] = useState<VendorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [status, setStatus]   = useState('')

  async function loadVendors() {
    setLoading(true)
    const params = new URLSearchParams()
    if (search.trim()) params.set('q', search.trim())
    if (status) params.set('status', status)

    const res = await fetch(`/api/v1/admin/vendors?${params.toString()}`)
    const body = (await res.json().catch(() => null)) as { data?: VendorRow[]; error?: { message: string } } | null
    setLoading(false)

    if (!res.ok) {
      toastError(body?.error?.message ?? 'Não foi possível carregar os fornecedores.')
      return
    }
    setVendors(body?.data ?? [])
  }

  useEffect(() => {
    const timeout = setTimeout(loadVendors, 250)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só refaz a busca quando search/status mudam
  }, [search, status])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
        <h1 className="font-display" style={{ fontSize: '26px', fontWeight: 500, color: '#3C2818', margin: 0 }}>Fornecedores</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link href="/admin/fornecedores/planos" style={{ fontSize: '13.5px', fontWeight: 700, color: '#8A5A2E', textDecoration: 'none' }}>Planos</Link>
          <Link href="/admin/fornecedores/cupons" style={{ fontSize: '13.5px', fontWeight: 700, color: '#8A5A2E', textDecoration: 'none' }}>Cupons</Link>
          <Link href="/admin/fornecedores/categorias" style={{ fontSize: '13.5px', fontWeight: 700, color: '#8A5A2E', textDecoration: 'none' }}>Categorias</Link>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome da empresa…"
          style={{ ...inputStyle, flex: '1 1 240px' }}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
          {STATUS_OPTS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>

      <div style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 16px rgba(60,40,24,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
          <thead>
            <tr style={{ background: '#F4EFE7', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px' }}>Empresa</th>
              <th style={{ padding: '12px 16px' }}>Categorias</th>
              <th style={{ padding: '12px 16px' }}>Cidade</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px' }}>Assinatura</th>
              <th style={{ padding: '12px 16px' }}>Cadastro</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} style={{ padding: '18px', textAlign: 'center', color: '#8A7D6E' }}>Carregando…</td></tr>
            )}
            {!loading && vendors.length === 0 && (
              <tr><td colSpan={6} style={{ padding: '18px', textAlign: 'center', color: '#8A7D6E' }}>Nenhum fornecedor encontrado.</td></tr>
            )}
            {vendors.map((vendor) => (
              <tr key={vendor.id} style={{ borderTop: '1px solid #F0E6D8' }}>
                <td style={{ padding: '12px 16px' }}>
                  <Link href={`/admin/fornecedores/${vendor.id}`} style={{ fontWeight: 700, color: '#3C2818', textDecoration: 'none' }}>
                    {vendor.business_name}
                  </Link>
                  {vendor.featured && (
                    <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: 700, color: '#B8862F' }}>★ destaque</span>
                  )}
                </td>
                <td style={{ padding: '12px 16px', color: '#6B5B47' }}>{vendor.category_labels.join(', ') || '—'}</td>
                <td style={{ padding: '12px 16px', color: '#6B5B47' }}>{[vendor.city, vendor.state].filter(Boolean).join(' - ') || '—'}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: STATUS_COLOR[vendor.status] }}>
                    {STATUS_OPTS.find((o) => o.value === vendor.status)?.label ?? vendor.status}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', color: '#6B5B47' }}>{vendor.subscription_status ?? '—'}</td>
                <td style={{ padding: '12px 16px', color: '#6B5B47' }}>{fmtDate(vendor.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
