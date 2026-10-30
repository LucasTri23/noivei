import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import VendorAvatar from '@/components/vendors/vendor-avatar'
import VendorContactActions from '@/components/vendors/vendor-contact-actions'
import VendorPortfolioGallery from '@/components/vendors/vendor-portfolio-gallery'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createSupabaseService } from '@/lib/supabase/service'
import { getVendorBySlug, type PublicVendorProfile } from '@/lib/vendor/get-vendor-by-slug'

interface ProfissionalPageProps {
  params: Promise<{ slug: string }>
}

// React cache() — primeira vez no projeto que generateMetadata e a página
// precisam do MESMO fetch (todo outro export const metadata estático não tem esse
// problema): sem isso, o slug seria resolvido duas vezes por request (uma pro
// <head>, outra pro corpo da página).
const getVendor = cache(async (slug: string): Promise<PublicVendorProfile | null> => {
  const supabase = await createSupabaseServer()
  return getVendorBySlug(supabase, slug)
})

// Mesma ordem de grandeza do TTL da galeria pública (ver
// GET /api/v1/vendors/[slug]/portfolio) — crawlers buscam a imagem de OG quase na
// hora do crawl, não precisa durar mais que isso.
const OG_IMAGE_TTL_SECONDS = 8 * 60

async function resolveCoverImageUrl(coverStoragePath: string | null): Promise<string | undefined> {
  if (!coverStoragePath) return undefined

  try {
    const service = createSupabaseService()
    const { data } = await service.storage.from('vendor-portfolio').createSignedUrl(coverStoragePath, OG_IMAGE_TTL_SECONDS)
    return data?.signedUrl
  } catch {
    // Ambiente sem service role configurado, ou path inválido — perfil segue sem
    // imagem de OG em vez de quebrar a página inteira.
    return undefined
  }
}

export async function generateMetadata({ params }: ProfissionalPageProps): Promise<Metadata> {
  const { slug } = await params
  const vendor = await getVendor(slug)

  if (!vendor) {
    return { title: 'Fornecedor não encontrado' }
  }

  const description = vendor.description
    ? vendor.description.slice(0, 160)
    : `Conheça ${vendor.business_name} no marketplace de fornecedores do Wednest.`

  const coverImageUrl = await resolveCoverImageUrl(vendor.cover_storage_path)

  // Diferente de /[slug], /mural/[slug], /rsvp/[token], /convite/[token] e
  // /ingresso/[token] (todos com robots:{index:false} de propósito, porque
  // carregam dado pessoal privado do casal/convidado) — o perfil público de um
  // fornecedor é conteúdo COMERCIAL do marketplace, feito pra ser descoberto.
  // Indexável por padrão aqui é a decisão certa, já aprovada — nunca copiar o
  // robots dos outros por reflexo.
  return {
    title: vendor.business_name,
    description,
    openGraph: {
      title:       vendor.business_name,
      description,
      images:      coverImageUrl ? [{ url: coverImageUrl }] : undefined,
    },
  }
}

function InstagramIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

export default async function ProfissionalPage({ params }: ProfissionalPageProps) {
  const { slug } = await params
  const vendor = await getVendor(slug)

  if (!vendor) notFound()

  const location = [vendor.city, vendor.state].filter(Boolean).join(', ')
  const instagramUrl = vendor.instagram
    ? `https://instagram.com/${vendor.instagram.replace(/^@/, '')}`
    : null
  const websiteUrl = vendor.website
    ? (vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`)
    : null

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', fontFamily: 'var(--font-body)' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'clamp(20px, 4vw, 48px) clamp(16px, 4vw, 24px)' }}>
        {/* Header */}
        <div className="flex flex-wrap items-center gap-4" style={{ marginBottom: '28px' }}>
          <VendorAvatar name={vendor.business_name} size={64} src={vendor.logo_storage_path ? '/api/v1/vendors/' + vendor.slug + '/avatar' : null} />
          <div style={{ minWidth: 0 }}>
            <h1
              className="font-display"
              style={{ fontWeight: 500, fontSize: 'clamp(26px,4vw,34px)', lineHeight: 1.1, color: 'var(--fg)', margin: 0 }}
            >
              {vendor.business_name}
            </h1>
            {location && (
              <p style={{ fontSize: '14px', color: 'var(--muted-fg)', margin: '4px 0 0' }}>{location}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5" style={{ marginBottom: '24px' }}>
          {vendor.price_range && (
            <span
              style={{
                fontSize: '12px', fontWeight: 700, padding: '4px 11px', borderRadius: 'var(--radius-full)',
                background: 'var(--wedding-color-subtle)', color: 'var(--wedding-color-dark)',
              }}
            >
              {vendor.price_range}
            </span>
          )}
          {vendor.categories.map((category) => (
            <span
              key={category.id}
              style={{
                fontSize: '12px', fontWeight: 600, padding: '4px 11px', borderRadius: 'var(--radius-full)',
                background: 'var(--muted)', color: 'var(--muted-fg)',
              }}
            >
              {category.label}
            </span>
          ))}
        </div>

        <div className="grid gap-8" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
          <div className="flex flex-col gap-8 lg:flex-row">
            {/* Coluna principal */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {vendor.description && (
                <div
                  className="rounded-2xl bg-[var(--surface)] p-6"
                  style={{ boxShadow: 'var(--shadow), var(--shadow-lg)', marginBottom: '24px' }}
                >
                  <h2 style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted-fg)', margin: '0 0 10px' }}>
                    Sobre
                  </h2>
                  <p style={{ fontSize: '14.5px', color: 'var(--fg)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>
                    {vendor.description}
                  </p>
                </div>
              )}

              <div
                className="rounded-2xl bg-[var(--surface)] p-6"
                style={{ boxShadow: 'var(--shadow), var(--shadow-lg)' }}
              >
                <h2 style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted-fg)', margin: '0 0 14px' }}>
                  Portfólio
                </h2>
                <VendorPortfolioGallery slug={slug} />
              </div>
            </div>

            {/* Contato */}
            <div style={{ width: '100%', maxWidth: '320px', flexShrink: 0 }}>
              <div
                className="rounded-2xl bg-[var(--surface)] p-6"
                style={{ boxShadow: 'var(--shadow), var(--shadow-lg)', position: 'sticky', top: '24px' }}
              >
                <h2 style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted-fg)', margin: '0 0 14px' }}>
                  Entrar em contato
                </h2>

                <VendorContactActions
                  vendorId={vendor.id}
                  businessName={vendor.business_name}
                  whatsapp={vendor.whatsapp}
                  showWhatsapp={vendor.show_whatsapp}
                />

                {(instagramUrl || websiteUrl) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                    {instagramUrl && (
                      <a
                        href={instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--muted-fg)', textDecoration: 'none' }}
                      >
                        <InstagramIcon /> {vendor.instagram}
                      </a>
                    )}
                    {websiteUrl && (
                      <a
                        href={websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--muted-fg)', textDecoration: 'none' }}
                      >
                        <GlobeIcon /> {vendor.website}
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
