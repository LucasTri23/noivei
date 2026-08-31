import AdminVendorsManager from '@/components/admin/admin-vendors-manager'

export const metadata = { title: 'Admin · Fornecedores' }

// Fase 7 — lista carregada client-side (GET /api/v1/admin/vendors) porque os
// filtros (busca/status/categoria) precisam reconsultar sem reload de página, mesmo
// padrão de outras telas de admin com filtro interativo deste projeto.
export default function AdminFornecedoresPage() {
  return <AdminVendorsManager />
}
