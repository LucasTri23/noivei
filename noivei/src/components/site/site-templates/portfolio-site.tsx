import GiftPaymentButton from '@/components/gifts/gift-payment-button'
import GiftPaymentReturnToast from '@/components/gifts/gift-payment-return-toast'
import LivePhotoGallery from '@/components/album/live-photo-gallery'
import type { PublicSiteInfo } from '@/lib/site/get-public-site-by-slug'

interface PortfolioSiteProps {
  slug: string
  site: PublicSiteInfo
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

function buildMapsUrl(venue: string | null, city: string | null): string | null {
  const address = [venue, city].filter((part): part is string => Boolean(part?.trim())).join(', ')
  if (!address) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

function ArrowRightIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  )
}

function MapPinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" /><circle cx="12" cy="10" r="3" />
    </svg>
  )
}

// Rótulo pequeno em versalete, mesmo idioma visual do eyebrow do hero — usado
// como "kicker" de cada seção em vez do SectionTitle centralizado do template
// clássico (aqui os títulos são grandes, à esquerda, tipografia como
// protagonista, no espírito "editorial/portfólio" pedido no briefing).
function SectionKicker({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--wedding-color-dark)', marginBottom: '10px' }}>
      {children}
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="font-display"
      style={{ fontWeight: 500, fontSize: 'clamp(32px,5.5vw,52px)', color: 'var(--fg)', margin: '0 0 22px', lineHeight: 1.02 }}
    >
      {children}
    </h2>
  )
}

// Grade densa e assimétrica em colunas CSS — mesma técnica do mural ao vivo
// (LivePhotoGallery), aqui aplicada às fotos CURADAS pelo casal
// (wedding_gallery_photos / content.gallery_urls), que são estáticas — sem
// polling nem signed URL com expiração. Sem cantos arredondados e sem gap
// grosso, de propósito: é a assinatura visual deste template.
function StaticMasonryGrid({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null

  return (
    <div className="columns-2 sm:columns-3 lg:columns-4" style={{ columnGap: '4px' }}>
      {urls.map((url, index) => (
        <div key={`${url}-${index}`} style={{ breakInside: 'avoid', marginBottom: '4px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- URL do Storage/externa, sem domínio fixo para configurar no next/image */}
          <img src={url} alt={`Foto ${index + 1} do casal`} style={{ width: '100%', display: 'block', borderRadius: 0 }} loading="lazy" />
        </div>
      ))}
    </div>
  )
}

// Estilo de site "portfolio" — linguagem visual ousada/editorial (hero em tela
// cheia, CTA em pílula, grades assimétricas sem cantos arredondados), gated ao
// mesmo plano que libera o mural de fotos (ver get-public-site-by-slug.ts:
// nunca renderiza aqui se o plano ATUAL não tiver 'album' habilitado, mesmo
// que site_config.template esteja salvo como 'portfolio'). Cores sempre
// derivadas da paleta do casal (wedding-color.ts) — nunca uma cor fixa.
export default function PortfolioSite({ slug, site }: PortfolioSiteProps) {
  const weddingDate = formatWeddingDate(site.wedding.wedding_date)
  const place       = [site.wedding.venue, site.wedding.city].filter(Boolean).join(' · ')
  const coverTitle  = site.content.cover_title || site.wedding.couple_names
  const mapsUrl     = buildMapsUrl(site.wedding.venue, site.wedding.city)
  const galleryUrls = site.galleryPhotos.map((photo) => photo.url)

  const coverBackground = site.cover_photo_url
    ? `linear-gradient(rgba(12,8,4,0.68), rgba(12,8,4,0.68)), url(${site.cover_photo_url})`
    : 'linear-gradient(150deg, var(--brand-dark-gradient-from), var(--brand-dark-gradient-to))'

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Hero em tela cheia — título gigante, CTA em pílula levando direto pra RSVP */}
      <div
        className="relative flex items-center justify-center overflow-hidden"
        style={{
          background:         coverBackground,
          backgroundSize:     'cover',
          backgroundPosition: `center ${site.cover_photo_position}%`,
          color: '#FAF0E6', minHeight: '86vh', padding: '80px 24px', textAlign: 'center',
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(color-mix(in srgb, var(--wedding-color) 20%, transparent) 1.4px, transparent 1.6px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="relative">
          <div style={{ fontSize: '12px', letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--wedding-color-light)', fontWeight: 700 }}>
            {weddingDate ?? 'Casamento de'}
          </div>
          <h1
            className="font-display"
            style={{ fontWeight: 500, fontSize: 'clamp(52px,11vw,128px)', margin: '14px 0 0', lineHeight: 0.94 }}
          >
            {coverTitle}
          </h1>
          {place && (
            <p style={{ fontSize: '15px', color: 'rgba(250,240,230,0.72)', margin: '20px 0 0' }}>
              {place}
            </p>
          )}

          <a
            href="#rsvp"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '10px',
              background: 'var(--wedding-color)', color: '#241708', textDecoration: 'none',
              borderRadius: '99px', padding: '15px 26px', fontWeight: 700, fontSize: '14.5px',
              marginTop: '36px',
              boxShadow: '0 12px 30px color-mix(in srgb, var(--wedding-color) 42%, transparent)',
            }}
          >
            Confirmar presença
            <ArrowRightIcon />
          </a>
        </div>
      </div>

      <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '80px 20px 0' }}>
        {/* Nossa história */}
        {site.content.our_story && (
          <section className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" style={{ marginBottom: '80px', alignItems: 'start' }}>
            <div>
              <SectionKicker>Nossa história</SectionKicker>
              <SectionHeading>Como tudo começou</SectionHeading>
              <p style={{ fontSize: '15.5px', color: 'var(--fg)', lineHeight: 1.9, whiteSpace: 'pre-line', margin: 0 }}>
                {site.content.our_story}
              </p>
            </div>
            {galleryUrls.length > 0 && (
              <div>
                <StaticMasonryGrid urls={galleryUrls.slice(0, 6)} />
              </div>
            )}
          </section>
        )}

        {/* Cerimônia & Festa */}
        {(site.content.ceremony_info || site.content.reception_info) && (
          <section className="grid grid-cols-1 gap-10 sm:grid-cols-2" style={{ marginBottom: '80px' }}>
            {site.content.ceremony_info && (
              <div>
                <SectionKicker>Cerimônia</SectionKicker>
                <p style={{ fontSize: '15px', color: 'var(--fg)', lineHeight: 1.8, whiteSpace: 'pre-line', margin: 0 }}>
                  {site.content.ceremony_info}
                </p>
              </div>
            )}
            {site.content.reception_info && (
              <div>
                <SectionKicker>Festa</SectionKicker>
                <p style={{ fontSize: '15px', color: 'var(--fg)', lineHeight: 1.8, whiteSpace: 'pre-line', margin: 0 }}>
                  {site.content.reception_info}
                </p>
              </div>
            )}
            {mapsUrl && (
              <div className="sm:col-span-2">
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '7px',
                    fontSize: '13px', fontWeight: 700, color: 'var(--wedding-color-secondary-dark)', textDecoration: 'none',
                    border: '1.5px solid var(--wedding-color-secondary)', borderRadius: '99px', padding: '9px 18px',
                    background: 'var(--wedding-color-secondary-subtle)',
                  }}
                >
                  <MapPinIcon />
                  Como chegar
                </a>
              </div>
            )}
          </section>
        )}

        {site.content.dress_code && (
          <section
            style={{
              marginBottom: '80px', padding: '28px 30px',
              background: 'var(--wedding-color-secondary-subtle)',
            }}
          >
            <SectionKicker>Dress code</SectionKicker>
            <p style={{ fontSize: '15px', color: 'var(--fg)', lineHeight: 1.7, whiteSpace: 'pre-line', margin: 0 }}>
              {site.content.dress_code}
            </p>
          </section>
        )}

        {site.content.custom_message && (
          <section style={{ marginBottom: '80px', textAlign: 'center' }}>
            <p
              className="font-display"
              style={{ fontStyle: 'italic', fontSize: 'clamp(20px,3vw,28px)', color: 'var(--wedding-color-dark)', lineHeight: 1.5, margin: 0 }}
            >
              &ldquo;{site.content.custom_message}&rdquo;
            </p>
          </section>
        )}

        {/* Lista de presentes */}
        {site.gifts.length > 0 && (
          <section style={{ marginBottom: '80px' }}>
            <GiftPaymentReturnToast />
            <SectionKicker>Lista de presentes</SectionKicker>
            <SectionHeading>Ajude a construir esse novo capítulo</SectionHeading>
            <div className="grid gap-px" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', background: '#EBDDD0' }}>
              {site.gifts.map((gift) => (
                <div
                  key={gift.id}
                  style={{ background: 'var(--surface)', opacity: gift.is_purchased ? 0.6 : 1 }}
                >
                  {gift.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element -- URL arbitrária colada pelo casal, sem domínio fixo para configurar no next/image
                    <img src={gift.image_url} alt={gift.name} style={{ width: '100%', height: '150px', objectFit: 'cover', display: 'block' }} />
                  )}
                  <div style={{ padding: '16px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--fg)' }}>{gift.name}</div>
                    {gift.price_cents != null && (
                      <div style={{ fontSize: '13px', color: 'var(--muted-fg)', marginTop: '2px' }}>
                        {currencyFmt.format(gift.price_cents / 100)}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '11.5px', fontWeight: 700, padding: '3px 10px',
                          background: gift.is_purchased ? '#E9EFE6' : 'var(--wedding-color-subtle)',
                          color: gift.is_purchased ? '#5E8B6A' : '#9A7A60',
                        }}
                      >
                        {gift.is_purchased ? 'Já foi dado' : 'Disponível'}
                      </span>
                      {!gift.is_purchased && gift.gift_type === 'link' && gift.store_url && (
                        <a
                          href={gift.store_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: '12px', fontWeight: 600, color: 'var(--wedding-color)', textDecoration: 'none' }}
                        >
                          Ver na loja
                        </a>
                      )}
                      {!gift.is_purchased && gift.gift_type === 'app_payment' && (
                        <GiftPaymentButton giftId={gift.id} giftName={gift.name} />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Galeria — todas as fotos curadas pelo casal, em grade densa */}
        {galleryUrls.length > 0 && (
          <section style={{ marginBottom: '80px' }}>
            <SectionKicker>Galeria</SectionKicker>
            <SectionHeading>Momentos</SectionHeading>
            <StaticMasonryGrid urls={galleryUrls} />
          </section>
        )}

        {/* Mural de fotos ao vivo — aqui, diferente do template clássico, a grade
            completa é embutida nativamente (é a própria linguagem visual deste
            template), sem prévia/link separado. Sempre visível quando o plano
            libera 'album', mesmo com o mural ainda vazio. */}
        {site.albumEnabled && (
          <section style={{ marginBottom: '80px' }}>
            <SectionKicker>Ao vivo</SectionKicker>
            <SectionHeading>Mural de fotos</SectionHeading>
            <p style={{ fontSize: '14px', color: 'var(--muted-fg)', margin: '-8px 0 22px', maxWidth: '520px' }}>
              As fotos que os convidados forem enviando durante o casamento aparecem aqui, ao vivo.{' '}
              <a href={`/mural/${slug}`} style={{ color: 'var(--wedding-color-dark)', fontWeight: 700, textDecoration: 'underline' }}>
                Abrir mural em tela cheia
              </a>.
            </p>
            <LivePhotoGallery
              slug={slug}
              emptyTitle="O mural ainda está vazio"
              emptyMessage="Volte no dia do casamento — os convidados poderão enviar fotos ao vivo pelo QR code."
            />
          </section>
        )}

        {/* RSVP */}
        <section
          id="rsvp"
          style={{ background: 'var(--wedding-color-subtle)', padding: '56px 24px', textAlign: 'center', marginBottom: '56px' }}
        >
          <SectionKicker>Presença</SectionKicker>
          <h2 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(28px,4.5vw,40px)', color: 'var(--fg)', margin: '0 0 10px' }}>
            Confirmação de presença
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--muted-fg)', margin: '0 auto', lineHeight: 1.6, maxWidth: '440px' }}>
            Cada convidado recebe um link pessoal para confirmar presença. Se você não recebeu o seu,
            fale diretamente com o casal.
          </p>
        </section>

        <p style={{ fontSize: '12px', color: 'var(--muted-fg)', paddingBottom: '40px', textAlign: 'center' }}>
          Feito com <span style={{ color: 'var(--wedding-color)' }}>♥</span> no Wednest
        </p>
      </div>
    </div>
  )
}
