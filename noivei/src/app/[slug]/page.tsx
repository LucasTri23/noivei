import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { getPublicSiteBySlug } from '@/lib/site/get-public-site-by-slug'
import { createSupabaseService } from '@/lib/supabase/service'
import { deriveWeddingColorScale } from '@/lib/theme/wedding-color'

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

function MapPinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" /><circle cx="12" cy="10" r="3" />
    </svg>
  )
}

interface TimelineEntry {
  key:   string
  label: string
  body:  string
  photo: string | null
}

// Cada bloco de texto existente (história/cerimônia/festa) vira uma "parada" na linha do
// tempo e consome uma foto da galeria, na ordem em que ambas aparecem. Decisão de design:
// o número de blocos segue o texto disponível (não as fotos) — um bloco sem foto ainda
// aparece, só que centralizado, sem quebrar o zigue-zague dos vizinhos. As fotos que sobram
// depois de preencher os blocos fecham o site numa seção de galeria tradicional.
function buildTimelineEntries(content: { our_story?: string; ceremony_info?: string; reception_info?: string }, galleryUrls: string[]): TimelineEntry[] {
  const source: { key: string; label: string; body: string | undefined }[] = [
    { key: 'historia',  label: 'Nossa história', body: content.our_story },
    { key: 'cerimonia', label: 'Cerimônia',       body: content.ceremony_info },
    { key: 'festa',     label: 'Festa',           body: content.reception_info },
  ]

  return source
    .filter((entry): entry is { key: string; label: string; body: string } => Boolean(entry.body))
    .map((entry, index) => ({ ...entry, photo: galleryUrls[index] ?? null }))
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

  // Cor principal e secundária do casal — mesma derivação de escala (claro/escuro/fundo)
  // usada no app autenticado, aplicada aqui via CSS vars para todo o site público.
  const colorScale          = deriveWeddingColorScale(site.wedding.wedding_color)
  const colorScaleSecondary = deriveWeddingColorScale(site.wedding.wedding_color_secondary)
  const weddingColorVars = {
    '--wedding-color':                  colorScale.color,
    '--wedding-color-light':            colorScale.light,
    '--wedding-color-dark':             colorScale.dark,
    '--wedding-color-subtle':           colorScale.subtle,
    '--wedding-color-secondary':        colorScaleSecondary.color,
    '--wedding-color-secondary-light':  colorScaleSecondary.light,
    '--wedding-color-secondary-dark':   colorScaleSecondary.dark,
    '--wedding-color-secondary-subtle': colorScaleSecondary.subtle,
  } as React.CSSProperties

  // Fotos da galeria espalhadas pelo site em vez de só num bloco isolado: acompanham os
  // blocos da linha do tempo "Nossa história" (ver buildTimelineEntries); o restante (se
  // sobrarem muitas) fecha o site numa seção de galeria tradicional.
  const galleryUrls     = site.content.gallery_urls ?? []
  const timelineEntries = buildTimelineEntries(site.content, galleryUrls)
  const timelineTitle   = site.content.our_story ? 'Nossa história' : 'Cerimônia & festa'
  const remainingPhotos = galleryUrls.slice(timelineEntries.length)

  // Sem foto de capa, mantém o gradiente escuro atual; com foto, aplica um overlay
  // escuro semi-transparente por cima pra manter o texto legível.
  const coverBackground = site.cover_photo_url
    ? `linear-gradient(rgba(20,12,4,0.6), rgba(20,12,4,0.6)), url(${site.cover_photo_url})`
    : 'linear-gradient(150deg, #2A1E10, #3A2A18)'
  // Posição vertical ajustável pelo casal no editor (0=topo, 50=centro, 100=base) —
  // evita que o "cover" corte o casal fora do quadro em fotos com composição diferente.
  const coverBackgroundPositionY = site.cover_photo_position

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', ...weddingColorVars }}>
      {/* Capa */}
      <div
        className="relative overflow-hidden"
        style={{
          background:        coverBackground,
          backgroundSize:     'cover',
          backgroundPosition: `center ${coverBackgroundPositionY}%`,
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
        </div>
      </div>

      {/* Divisor com as duas cores do casal */}
      <div style={{ height: '5px', background: 'linear-gradient(90deg, var(--wedding-color), var(--wedding-color-secondary))' }} />

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '56px 24px 80px' }}>
        {/* Nossa história — linha do tempo com fotos alternando de lado, ligadas por um
            fio vertical na cor secundária (só aparece em telas médias+, onde há duas
            colunas de fato; no mobile os blocos empilham e o fio some). */}
        {timelineEntries.length > 0 && (
          <section style={{ marginBottom: '56px', position: 'relative' }}>
            <SectionTitle>{timelineTitle}</SectionTitle>

            <div
              aria-hidden
              className="hidden md:block"
              style={{
                position: 'absolute', top: '8px', bottom: '8px', left: '50%', width: '2px',
                background: 'linear-gradient(180deg, transparent, var(--wedding-color-secondary) 6%, var(--wedding-color-secondary) 94%, transparent)',
                transform: 'translateX(-50%)', zIndex: 0,
              }}
            />

            <div className="flex flex-col gap-14" style={{ position: 'relative', zIndex: 1 }}>
              {timelineEntries.map((entry, index) => {
                // Blocos ímpares invertem os lados (foto à esquerda, texto à direita) —
                // é o que produz o zigue-zague conforme a página desce.
                const photoFirst = index % 2 === 1

                const label = (
                  <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--wedding-color-dark)', marginBottom: '10px' }}>
                    {entry.label}
                  </div>
                )
                const body = (
                  <p style={{ fontSize: '15px', color: 'var(--fg)', lineHeight: 1.8, whiteSpace: 'pre-line', margin: 0 }}>
                    {entry.body}
                  </p>
                )

                return (
                  <div key={entry.key} style={{ position: 'relative' }}>
                    {/* Nó da linha do tempo, centralizado no meio vertical do bloco */}
                    <div
                      aria-hidden
                      className="hidden md:block"
                      style={{
                        position: 'absolute', top: '50%', left: '50%', width: '14px', height: '14px',
                        borderRadius: '50%', background: 'var(--wedding-color-secondary)',
                        border: '3px solid var(--bg)', transform: 'translate(-50%,-50%)', zIndex: 2,
                      }}
                    />

                    {entry.photo ? (
                      <div className="grid gap-6 md:grid-cols-2 md:items-center">
                        <div className={photoFirst ? 'md:order-2' : 'md:order-1'}>
                          {label}
                          {body}
                        </div>
                        <div className={photoFirst ? 'md:order-1' : 'md:order-2'}>
                          {/* eslint-disable-next-line @next/next/no-img-element -- URL do Storage, sem domínio fixo para configurar no next/image */}
                          <img
                            src={entry.photo}
                            alt="Foto do casal"
                            className="rounded-2xl"
                            style={{ width: '100%', height: '260px', objectFit: 'cover', display: 'block' }}
                          />
                        </div>
                      </div>
                    ) : (
                      // Bloco sem foto disponível: fica centralizado em vez de quebrar o
                      // zigue-zague dos vizinhos (acontece quando há mais texto que fotos).
                      <div style={{ maxWidth: '520px', margin: '0 auto', textAlign: 'center' }}>
                        {label}
                        {body}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* "Como chegar" mora aqui, perto das informações de local/horário, em vez de na capa */}
            {mapsUrl && (
              <div style={{ textAlign: 'center', marginTop: '36px' }}>
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

        {/* Galeria — só o que sobrou depois de espalhar fotos pelas seções acima */}
        {remainingPhotos.length > 0 && (
          <section style={{ marginBottom: '56px' }}>
            <SectionTitle>Galeria</SectionTitle>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))' }}>
              {remainingPhotos.map((url, index) => (
                // eslint-disable-next-line @next/next/no-img-element -- URL arbitrária colada pelo casal, sem domínio fixo para configurar no next/image
                <img
                  key={`${url}-${index}`}
                  src={url}
                  alt={`Foto ${timelineEntries.length + index + 1} do casal`}
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
