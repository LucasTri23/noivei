import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import PublicSiteView from '@/components/site/public-site-view'
import { getPublicSiteBySlug } from '@/lib/site/get-public-site-by-slug'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createSupabaseService } from '@/lib/supabase/service'
import { getUserWedding, hasModuleAccess } from '@/lib/weddings/get-user-wedding'

export const metadata: Metadata = {
  title:  'Pré-visualização do site',
  robots: { index: false, follow: false },
}

// Fora do grupo (app) de propósito: a prévia mostra o site como o convidado vê, sem a
// barra lateral do painel. /site continua sendo prefixo autenticado no middleware.
export default async function SitePreviewPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/site/previa')

  const wedding = await getUserWedding(supabase, user.id)
  if (!wedding) redirect('/onboarding')
  if (!hasModuleAccess(wedding, 'site')) notFound()

  // Consulta com o client do próprio usuário (RLS) — só encontra o site do casal dele.
  const { data: config } = await supabase
    .from('site_config')
    .select('slug, published')
    .eq('wedding_id', wedding.id)
    .maybeSingle()
  if (!config) redirect('/site')

  const slug = config.slug as string
  const site = await getPublicSiteBySlug(createSupabaseService(), slug, { includeUnpublished: true })
  if (!site) notFound()

  return (
    <>
      <div
        role="status"
        style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '8px 16px',
          padding: '10px 16px', background: '#2A1E10', color: '#FAF0E6', fontSize: '13px', textAlign: 'center',
        }}
      >
        <span>
          <strong>Pré-visualização</strong>
          {' · '}
          {config.published ? 'Esta é a versão salva do seu site publicado.' : 'Rascunho — só vocês veem esta página.'}
        </span>
        <Link href="/site" style={{ color: '#E0B870', fontWeight: 700, textDecoration: 'underline' }}>
          Voltar ao editor
        </Link>
      </div>
      <PublicSiteView slug={slug} site={site} />
    </>
  )
}
