import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import type { MarketplaceVendorStatus, VendorProfile } from '@/types/database'

// Página privada de status do fornecedor — nunca indexável.
export const metadata = { robots: { index: false, follow: false } }

const STATUS_COPY: Record<MarketplaceVendorStatus, { title: string; body: string }> = {
  draft: {
    title: 'Continue seu cadastro',
    body:  'Você começou o cadastro da sua empresa, mas ainda não terminou. Continue de onde parou.',
  },
  pending_review: {
    title: 'Seu cadastro está em análise',
    body:  'Recebemos os dados da sua empresa. Nossa equipe revisa cada cadastro antes de publicar — você recebe uma resposta em breve.',
  },
  active: {
    title: 'Seu perfil está ativo',
    body:  'Sua solicitação foi aprovada. Para aparecer no marketplace e receber contatos de casais, você tamb?m precisa de uma assinatura ativa e válida. Gerencie seus dados em "Perfil" e seu plano em "Assinatura".',
  },
  paused: {
    title: 'Seu perfil está pausado',
    body:  'Seu perfil não está visível no marketplace no momento. O painel completo para gerenciar isso chega em breve — fale com o suporte se precisar reativar antes disso.',
  },
  suspended: {
    title: 'Seu perfil está suspenso',
    body:  'Seu perfil foi suspenso pela nossa equipe. Entre em contato com o suporte para mais informações.',
  },
  rejected: {
    title: 'Seu cadastro não foi aprovado',
    body:  'Revise as informações da sua empresa e reenvie para uma nova análise.',
  },
}

export default async function VendorStatusPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('vendor_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  // Defesa extra: o layout do grupo (vendor) já garante isso na prática, mas uma
  // página nunca deve confiar cegamente no layout pai pra dado obrigatório.
  if (!data) redirect('/fornecedor/cadastro')

  const vendor = data as VendorProfile
  const copy = STATUS_COPY[vendor.status]
  const canEditAndResubmit = vendor.status === 'draft' || vendor.status === 'rejected'

  return (
    <div>
      <p
        style={{
          fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase',
          color: 'var(--wedding-color-dark)', marginBottom: '8px',
        }}
      >
        {vendor.business_name}
      </p>

      <h1 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(26px,3.4vw,34px)', margin: '0 0 10px', color: 'var(--fg)' }}>
        {copy.title}
      </h1>
      <p style={{ fontSize: '14.5px', color: 'var(--muted-fg)', lineHeight: 1.6, marginBottom: '24px' }}>
        {copy.body}
      </p>

      {vendor.status === 'rejected' && vendor.rejection_reason && (
        <div style={{ background: '#FBEEE6', border: '1px solid #E3C2AE', borderRadius: '12px', padding: '14px 16px', marginBottom: '24px' }}>
          <p style={{ fontSize: '12.5px', fontWeight: 700, color: '#9A4A30', marginBottom: '4px' }}>Motivo da rejeição</p>
          <p style={{ fontSize: '14px', color: '#7A3A24', lineHeight: 1.5 }}>{vendor.rejection_reason}</p>
        </div>
      )}

      {canEditAndResubmit && (
        <Link
          href="/fornecedor/cadastro"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--wedding-color)', color: '#fff', borderRadius: '12px',
            padding: '13px 22px', fontWeight: 600, fontSize: '14.5px', textDecoration: 'none',
            boxShadow: '0 10px 24px rgba(198,148,58,0.28)',
          }}
        >
          {vendor.status === 'rejected' ? 'Revisar e reenviar' : 'Continuar cadastro'}
        </Link>
      )}
    </div>
  )
}
