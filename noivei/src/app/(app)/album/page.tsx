import Link from 'next/link'
import QRCode from 'qrcode'

import ModuleAccessGate from '@/components/billing/module-access-gate'
import PaywallGate from '@/components/billing/paywall-gate'
import AlbumManager from '@/components/album/album-manager'
import { APP_URL } from '@/lib/email/app-url'
import { createSupabaseServer } from '@/lib/supabase/server'

interface AlbumContentProps {
  weddingId:   string
  coupleNames: string
}

// O mural de fotos vive no mesmo endereço do site público do casal
// (/mural/[slug], mesmo slug de site_config) — sem site publicado, não existe
// link/QR nenhum pra gerar. Diferente do antigo album_token (removido, nunca
// existiu de fato em produção — ver migration 20260803000001), este link não
// pode ser criado "cedo": depende do casal ter passado pela Capa do site em
// /site e ativado "Publicar site".
async function AlbumContent({ weddingId, coupleNames }: AlbumContentProps) {
  const supabase = await createSupabaseServer()

  const { data: site } = await supabase
    .from('site_config')
    .select('slug, published')
    .eq('wedding_id', weddingId)
    .maybeSingle()

  if (!site || !(site.published as boolean)) {
    return (
      <div
        className="rounded-2xl bg-[var(--surface)] p-10 text-center"
        style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)' }}
      >
        <h1
          className="font-display"
          style={{ fontWeight: 500, fontSize: 'clamp(26px,3.6vw,32px)', color: 'var(--fg)', margin: '0 0 10px' }}
        >
          Publique seu site primeiro
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--muted-fg)', margin: '0 auto 22px', lineHeight: 1.6, maxWidth: '420px' }}>
          O mural de fotos usa o mesmo endereço do site do casal. Defina um slug e publique o site
          para gerar o link e o QR code do mural.
        </p>
        <Link
          href="/site"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'var(--wedding-color)', color: '#fff', textDecoration: 'none',
            borderRadius: '12px', padding: '11px 20px', fontWeight: 600, fontSize: '14px',
          }}
        >
          Ir para o site do casal
        </Link>
      </div>
    )
  }

  const slug      = site.slug as string
  const albumLink = `${APP_URL}/mural/${slug}`

  // QR gerado no servidor como data URL — mesmo padrão do QR de ingresso do
  // check-in (QRCode.toDataURL), sem depender de nenhuma lib nova no client.
  const qrDataUrl = await QRCode.toDataURL(albumLink, { width: 320, margin: 1 })

  return (
    <AlbumManager
      weddingId={weddingId}
      coupleNames={coupleNames}
      albumLink={albumLink}
      qrDataUrl={qrDataUrl}
    />
  )
}

export default async function AlbumPage() {
  const supabase = await createSupabaseServer()

  const { data: wedding } = await supabase
    .from('weddings')
    .select('id, couple_names')
    .is('deleted_at', null)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  if (!wedding) {
    return (
      <div
        className="rounded-2xl bg-[var(--surface)] p-10 text-center"
        style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)', color: 'var(--muted-fg)', fontSize: '14px' }}
      >
        Complete o onboarding para começar a usar o álbum de fotos.
      </div>
    )
  }

  return (
    <ModuleAccessGate module="album">
      <PaywallGate feature="album">
        <AlbumContent weddingId={wedding.id as string} coupleNames={wedding.couple_names as string} />
      </PaywallGate>
    </ModuleAccessGate>
  )
}
