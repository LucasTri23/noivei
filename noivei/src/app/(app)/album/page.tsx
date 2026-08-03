import QRCode from 'qrcode'

import ModuleAccessGate from '@/components/billing/module-access-gate'
import PaywallGate from '@/components/billing/paywall-gate'
import AlbumManager from '@/components/album/album-manager'
import { APP_URL } from '@/lib/email/app-url'
import { createSupabaseServer } from '@/lib/supabase/server'

export default async function AlbumPage() {
  const supabase = await createSupabaseServer()

  const { data: wedding } = await supabase
    .from('weddings')
    .select('id, album_token, couple_names')
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

  const weddingId  = wedding.id as string
  const albumToken = wedding.album_token as string
  const albumLink  = `${APP_URL}/mural/${albumToken}`

  // QR gerado no servidor como data URL — mesmo padrão do QR de ingresso do
  // check-in (QRCode.toDataURL), sem depender de nenhuma lib nova no client.
  const qrDataUrl = await QRCode.toDataURL(albumLink, { width: 320, margin: 1 })

  return (
    <ModuleAccessGate module="album">
      <PaywallGate feature="album">
        <AlbumManager
          weddingId={weddingId}
          coupleNames={wedding.couple_names as string}
          albumLink={albumLink}
          qrDataUrl={qrDataUrl}
        />
      </PaywallGate>
    </ModuleAccessGate>
  )
}
