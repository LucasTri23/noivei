import AdminVendorDetail from '@/components/admin/admin-vendor-detail'

export const metadata = { title: 'Admin · Fornecedor' }

interface AdminVendorDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function AdminVendorDetailPage({ params }: AdminVendorDetailPageProps) {
  const { id } = await params
  return <AdminVendorDetail vendorId={id} />
}
