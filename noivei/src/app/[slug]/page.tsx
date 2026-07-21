import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { getPublicSiteBySlug } from '@/lib/site/get-public-site-by-slug'
import { createSupabaseService } from '@/lib/supabase/service'

// Sites de casal ainda não entraram no roadmap de SEO/indexação do produto
export const metadata: Metadata = {
  title:  'Site do casal',
  robots: { index: false, follow: false },
}

interface PublicSitePageProps {
  params: Promise<{ slug: string }>
}

const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function formatWeddingDate(date: string | null): string | null {
  if (!date) return null
  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

// Link de busca do Google Maps — não precisa de API key nem mapa embutido, só abre
// os resultados de busca para o endereço que o casal preencheu (venue e/ou city).
function buildMapsUrl(venue: string | null, city: string | null): string | null {
  const address = [venue, city].filter((part): part is string => Boolean(part?.trim())).join(', ')
  if (!address) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="font-display"
      style={{ fontWeight: 500, fontSize: 'clamp(26px,4vw,34px)', color: 'var(--fg)', margin: '0 0 18px', textAlign: 'center' }}
    >
      {children}
    </h2>
  )
}

export default async function PublicSitePage({ params }: PublicSitePageProps) {
  const { slug } = await params

  let site: Awaited<ReturnType<typeof getPublicSiteBySlug>> = null
  try {
    const supabase = createSupabaseService()
    site = await getPublicSiteBySlug(supabase, slug)
  } catch {
    // Ambiente sem service role configurado — trata como site indisponível
    site = null
  }

  if (!site) notFound()

  const weddingDate = formatWeddingDate(site.wedding.wedding_date)
  const place       = [site.wedding.venue, site.wedding.city].filter(Boolean).join(' · ')
  const coverTitle  = site.content.cover_title || site.wedding.couple_names
  const mapsUrl     = buildMapsUrl(site.wedding.venue, site.wedding.city)

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Capa */}
      <div
        className="relative overflow-hidden"
        style={{
          background: 'linear-gradient(150deg, #2A1E10, #3A2A18)',
          color: '#FAF0E6', padding: '96px 24px', textAlign: 'center',
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(color-mix(in srgb, var(--wedding-color) 18%, transparent) 1.3px, transparent 1.5px)',
            backgroundSize: '26px 26px',
          }}
        />
        <div className="relative">
          <div style={{ fontSize: '12px', letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--wedding-color-light)' }}>
            Casamento de
          </div>
          <h1
            className="font-display"
            style={{ fontWeight: 500, fontSize: 'clamp(44px,8vw,84px)', margin: '10px 0 0', lineHeight: 1.02 }}
          >
            {coverTitle}
          </h1>
          {(weddingDate || place) && (
            <p style={{ fontSize: '15px', color: 'rgba(250,240,230,0.75)', margin: '16px 0 0' }}>
              {[weddingDate, place].filter(Boolean).join(' — ')}
            </p>
          )}
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '7px', marginTop: '18px',
                fontSize: '13px', fontWeight: 700, color: '#FAF0E6', textDecoration: 'none',
                border: '1.5px solid rgba(250,240,230,0.4)', borderRadius: '99px', padding: '9px 18px',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" /><circle cx="12" cy="10" r="3" />
              </svg>
              Como chegar
            </a>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '56px 24px 80px' }}>
        {/* Nossa história */}
        {site.content.our_story && (
          <section style={{ marginBottom: '56px' }}>
            <SectionTitle>Nossa história</SectionTitle>
            <p style={{ fontSize: '15.5px', color: 'var(--fg)', lineHeight: 1.8, whiteSpace: 'pre-line', textAlign: 'center' }}>
              {site.content.our_story}
            </p>
          </section>
        )}

        {site.content.custom_message && (
          <section style={{ marginBottom: '56px', textAlign: 'center' }}>
            <p
              className="font-display"
              style={{ fontStyle: 'italic', fontSize: '20px', color: 'var(--wedding-color-dark)', lineHeight: 1.6, margin: 0 }}
            >
              &ldquo;{site.content.custom_message}&rdquo;
            </p>
          </section>
        )}

        {/* Cerimônia & festa */}
        {(site.content.ceremony_info || site.content.reception_info) && (
          <section style={{ marginBottom: '56px' }}>
            <SectionTitle>Cerimônia &amp; festa</SectionTitle>
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px,1fr))' }}>
              {site.content.ceremony_info && (
                <div className="rounded-2xl bg-[var(--surface)] p-6" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--wedding-color-dark)', marginBottom: '8px' }}>
                    Cerimônia
                  </div>
                  <p style={{ fontSize: '14.5px', color: 'var(--fg)', lineHeight: 1.7, whiteSpace: 'pre-line', margin: 0 }}>
                    {site.content.ceremony_info}
                  </p>
                </div>
              )}
              {site.content.reception_info && (
                <div className="rounded-2xl bg-[var(--surface)] p-6" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--wedding-color-dark)', marginBottom: '8px' }}>
                    Festa
                  </div>
                  <p style={{ fontSize: '14.5px', color: 'var(--fg)', lineHeight: 1.7, whiteSpace: 'pre-line', margin: 0 }}>
                    {site.content.reception_info}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Lista de presentes */}
        {site.gifts.length > 0 && (
          <section style={{ marginBottom: '56px' }}>
            <SectionTitle>Lista de presentes</SectionTitle>
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))' }}>
              {site.gifts.map((gift) => (
                <div
                  key={gift.id}
                  className="overflow-hidden rounded-2xl bg-[var(--surface)]"
                  style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)', opacity: gift.is_purchased ? 0.6 : 1 }}
                >
                  {gift.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element -- URL arbitrária colada pelo casal, sem domínio fixo para configurar no next/image
                    <img src={gift.image_url} alt={gift.name} style={{ width: '100%', height: '140px', objectFit: 'cover' }} />
                  )}
                  <div style={{ padding: '14px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--fg)' }}>{gift.name}</div>
                    {gift.price_cents != null && (
                      <div style={{ fontSize: '13px', color: 'var(--muted-fg)', marginTop: '2px' }}>
                        {currencyFmt.format(gift.price_cents / 100)}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '11.5px', fontWeight: 700, padding: '3px 10px', borderRadius: '99px',
                          background: gift.is_purchased ? '#E9EFE6' : 'var(--wedding-color-subtle)',
                          color: gift.is_purchased ? '#5E8B6A' : '#9A7A60',
                        }}
                      >
                        {gift.is_purchased ? 'Já foi dado' : 'Disponível'}
                      </span>
                      {gift.store_url && !gift.is_purchased && (
                        <a
                          href={gift.store_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: '12px', fontWeight: 600, color: 'var(--wedding-color)', textDecoration: 'none' }}
                        >
                          Ver na loja
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Galeria */}
        {site.content.gallery_urls && site.content.gallery_urls.length > 0 && (
          <section style={{ marginBottom: '56px' }}>
            <SectionTitle>Galeria</SectionTitle>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))' }}>
              {site.content.gallery_urls.map((url, index) => (
                // eslint-disable-next-line @next/next/no-img-element -- URL arbitrária colada pelo casal, sem domínio fixo para configurar no next/image
                <img
                  key={`${url}-${index}`}
                  src={url}
                  alt={`Foto ${index + 1} do casal`}
                  className="rounded-2xl"
                  style={{ width: '100%', height: '160px', objectFit: 'cover' }}
                />
              ))}
            </div>
          </section>
        )}

        {/* RSVP */}
        <section
          className="rounded-2xl text-center"
          style={{ background: 'var(--wedding-color-subtle)', padding: '32px 24px', border: '1px dashed #D8C6A6' }}
        >
          <h2 className="font-display" style={{ fontWeight: 500, fontSize: '24px', color: 'var(--fg)', margin: '0 0 8px' }}>
            Confirmação de presença
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--muted-fg)', margin: '0 auto', lineHeight: 1.6, maxWidth: '440px' }}>
            Cada convidado recebe um link pessoal para confirmar presença. Se você não recebeu o seu,
            fale diretamente com o casal.
          </p>
        </section>

        <p style={{ fontSize: '12px', color: 'var(--muted-fg)', marginTop: '40px', textAlign: 'center' }}>
          Feito com <span style={{ color: 'var(--wedding-color)' }}>♥</span> no Wednest
        </p>
      </div>
    </div>
  )
}
