import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { getPublicSiteBySlug, type PublicGalleryPhoto } from '@/lib/site/get-public-site-by-slug'
import { createSupabaseService } from '@/lib/supabase/service'
import { deriveWeddingColorScale, deriveBrandDarkGradient } from '@/lib/theme/wedding-color'

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

// Ícone decorativo do pin da foto polaroid.
function TimelineHeartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

// Rotação leve e determinística por índice (não muda a cada render, mas varia foto a
// foto) — simula o efeito de polaroids coladas levemente tortas.
const TIMELINE_PHOTO_ROTATIONS = [-3, 2.5, -2, 3, -1.5, 2, -2.5, 1.5]

// Até 8 fotos entram na história (metade de cada lado) — o restante fecha o site
// numa seção de Galeria tradicional mais abaixo.
const TIMELINE_MAX_PHOTOS = 8

// Foto em moldura "polaroid" — usada tanto nas laterais da história (desktop)
// quanto na grade abaixo do texto (mobile).
function PolaroidPhoto({ photo, index, alt }: { photo: PublicGalleryPhoto; index: number; alt: string }) {
  const rotation = TIMELINE_PHOTO_ROTATIONS[index % TIMELINE_PHOTO_ROTATIONS.length]

  return (
    <div style={{ position: 'relative', maxWidth: '255px', width: '100%', margin: '0 auto', transform: `rotate(${rotation}deg)` }}>
      <div
        aria-hidden
        style={{
          position: 'absolute', top: '-12px', left: '50%', width: '24px', height: '24px',
          transform: 'translateX(-50%) rotate(-8deg)', borderRadius: '50%',
          background: 'var(--wedding-color-secondary)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 3px 8px rgba(60,40,24,0.25)', zIndex: 3,
        }}
      >
        <TimelineHeartIcon />
      </div>

      <div
        style={{
          background: '#FFFCF6', padding: '9px 9px 26px', borderRadius: '3px',
          boxShadow: '0 16px 32px rgba(60,40,24,0.16), 0 3px 8px rgba(60,40,24,0.10)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- URL do Storage/externa, sem domínio fixo para configurar no next/image */}
        <img
          src={photo.url}
          alt={alt}
          style={{
            width: '100%', height: '205px', display: 'block', borderRadius: '2px',
            objectFit: photo.fit_contain ? 'contain' : 'cover',
            objectPosition: `center ${photo.position_y}%`,
            background: photo.fit_contain ? '#F1E9DD' : undefined,
          }}
        />
      </div>
    </div>
  )
}

// Linha curta e independente por foto — termina antes da coluna central (não atravessa
// o texto) e nunca se cruza com a linha da foto vizinha, porque cada uma só ocupa o
// espaço entre a própria foto e a borda do texto, nunca o vão inteiro entre colunas.
function PhotoConnector({ side }: { side: 'left' | 'right' }) {
  const path = side === 'left'
    ? 'M 0 12 C 28 12, 34 34, 72 34 C 94 34, 102 24, 118 24'
    : 'M 118 12 C 90 12, 84 34, 46 34 C 24 34, 16 24, 0 24'

  return (
    <svg
      aria-hidden
      className="hidden xl:block"
      viewBox="0 0 118 46"
      style={{
        position: 'absolute', top: '50%',
        ...(side === 'left' ? { left: 'calc(100% - 8px)' } : { right: 'calc(100% - 8px)' }),
        width: '118px', height: '46px', transform: 'translateY(-50%)', overflow: 'visible', zIndex: 0,
      }}
    >
      <path
        d={path}
        fill="none"
        stroke="var(--wedding-color-secondary)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.62"
      />
      <circle
        cx={side === 'left' ? '118' : '0'}
        cy="24"
        r="4.5"
        fill="var(--bg)"
        stroke="var(--wedding-color-secondary)"
        strokeWidth="1.5"
      />
    </svg>
  )
}

function StorySidePhoto({ photo, index, side }: { photo: PublicGalleryPhoto; index: number; side: 'left' | 'right' }) {
  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <PolaroidPhoto photo={photo} index={index} alt={`Foto ${index + 1} do casal`} />
      <PhotoConnector side={side} />
    </div>
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

  // Cor principal e secundária do casal — mesma derivação de escala (claro/escuro/fundo)
  // usada no app autenticado, aplicada aqui via CSS vars para todo o site público.
  const colorScale          = deriveWeddingColorScale(site.wedding.wedding_color)
  const colorScaleSecondary = deriveWeddingColorScale(site.wedding.wedding_color_secondary)
  // Site do casal é recurso Premium (ver PaywallGate em (app)/site) — só chega a existir
  // publicado para um plano pago, então a cor (e o gradiente escuro derivado dela) já
  // pode ser aplicada sem checagem extra de plano aqui, igual ao restante desta página.
  const brandDarkGradient = deriveBrandDarkGradient(site.wedding.wedding_color_secondary)
  const weddingColorVars = {
    '--wedding-color':                  colorScale.color,
    '--wedding-color-light':            colorScale.light,
    '--wedding-color-dark':             colorScale.dark,
    '--wedding-color-subtle':           colorScale.subtle,
    '--wedding-color-secondary':        colorScaleSecondary.color,
    '--wedding-color-secondary-light':  colorScaleSecondary.light,
    '--wedding-color-secondary-dark':   colorScaleSecondary.dark,
    '--wedding-color-secondary-subtle': colorScaleSecondary.subtle,
    '--brand-dark-gradient-from':       brandDarkGradient.from,
    '--brand-dark-gradient-to':         brandDarkGradient.to,
  } as React.CSSProperties

  // Até oito fotos compõem a história: metade na lateral esquerda e metade na direita,
  // independente dos parágrafos do texto (o texto é um bloco único e contínuo).
  const galleryPhotos    = site.galleryPhotos
  const storyPhotos      = galleryPhotos.slice(0, TIMELINE_MAX_PHOTOS)
  const leftStoryPhotos  = storyPhotos.filter((_, index) => index % 2 === 0)
  const rightStoryPhotos = storyPhotos.filter((_, index) => index % 2 === 1)
  const consumedPhotos   = storyPhotos.length
  const remainingPhotos  = galleryPhotos.slice(consumedPhotos)

  // Sem foto de capa, mantém o gradiente escuro atual; com foto, aplica um overlay
  // escuro semi-transparente por cima pra manter o texto legível.
  const coverBackground = site.cover_photo_url
    ? `linear-gradient(rgba(20,12,4,0.6), rgba(20,12,4,0.6)), url(${site.cover_photo_url})`
    : 'linear-gradient(150deg, var(--brand-dark-gradient-from), var(--brand-dark-gradient-to))'
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

      <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '56px 24px 80px' }}>
        {/* Nossa história — texto único e contínuo no centro, fotos independentes nas
            laterais. O layout de 3 colunas só entra a partir de `xl` (1280px): as
            colunas de foto (255px cada) + o texto (360-520px) + os dois gaps de 80px
            somam ~1030px de largura mínima — ativar já em `md`/`lg` deixaria menos
            espaço do que isso disponível (o container tem no máximo 1180px, e ainda
            perde padding lateral), estourando a borda. No mobile/tablet, o texto
            aparece inteiro primeiro e as fotos vêm depois, numa grade de 2 colunas. */}
        {site.content.our_story && (
          <section style={{ marginBottom: '64px' }}>
            <SectionTitle>Nossa história</SectionTitle>

            <div className="hidden xl:grid xl:grid-cols-[255px_minmax(360px,520px)_255px] xl:gap-x-20 xl:items-start xl:justify-center">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '180px', paddingTop: '34px' }}>
                {leftStoryPhotos.map((photo, index) => (
                  <StorySidePhoto key={`${photo.url}-left-${index}`} photo={photo} index={index * 2} side="left" />
                ))}
              </div>

              <div
                style={{
                  position: 'relative', zIndex: 2, textAlign: 'center',
                  padding: '20px 24px 28px', borderRadius: '24px',
                  background: 'color-mix(in srgb, var(--bg) 96%, transparent)',
                }}
              >
                <p style={{ fontSize: '15px', color: 'var(--fg)', lineHeight: 2, whiteSpace: 'pre-line', margin: 0 }}>
                  {site.content.our_story}
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '180px', paddingTop: '150px' }}>
                {rightStoryPhotos.map((photo, index) => (
                  <StorySidePhoto key={`${photo.url}-right-${index}`} photo={photo} index={index * 2 + 1} side="right" />
                ))}
              </div>
            </div>

            {/* No celular/tablet, o texto continua inteiro e as fotos aparecem abaixo em duas colunas. */}
            <div className="xl:hidden">
              <p
                style={{
                  maxWidth: '560px', margin: '0 auto', textAlign: 'center',
                  fontSize: '15px', color: 'var(--fg)', lineHeight: 1.9, whiteSpace: 'pre-line',
                }}
              >
                {site.content.our_story}
              </p>

              {storyPhotos.length > 0 && (
                <div className="grid grid-cols-2 gap-6" style={{ marginTop: '38px' }}>
                  {storyPhotos.map((photo, index) => (
                    <PolaroidPhoto key={`${photo.url}-mobile-${index}`} photo={photo} index={index} alt={`Foto ${index + 1} do casal`} />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Cerimônia & Festa — sempre abaixo da história */}
        {(site.content.ceremony_info || site.content.reception_info) && (
          <section style={{ marginBottom: '56px', textAlign: 'center' }}>
            {site.content.ceremony_info && (
              <div style={{ maxWidth: '560px', margin: '0 auto 30px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--wedding-color-dark)', marginBottom: '10px' }}>
                  Cerimônia
                </div>
                <p style={{ fontSize: '15px', color: 'var(--fg)', lineHeight: 1.8, whiteSpace: 'pre-line', margin: 0 }}>
                  {site.content.ceremony_info}
                </p>
              </div>
            )}

            {site.content.reception_info && (
              <div style={{ maxWidth: '560px', margin: '0 auto' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--wedding-color-dark)', marginBottom: '10px' }}>
                  Festa
                </div>
                <p style={{ fontSize: '15px', color: 'var(--fg)', lineHeight: 1.8, whiteSpace: 'pre-line', margin: 0 }}>
                  {site.content.reception_info}
                </p>
              </div>
            )}

            {mapsUrl && (
              <div style={{ textAlign: 'center', marginTop: '30px' }}>
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
          <section style={{ marginBottom: '56px', textAlign: 'center' }}>
            <div
              style={{
                maxWidth: '560px', margin: '0 auto', padding: '16px 20px', borderRadius: '14px',
                background: 'var(--wedding-color-secondary-subtle)',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--wedding-color-dark)', marginBottom: '8px' }}>
                Dress code
              </div>
              <p style={{ fontSize: '14.5px', color: 'var(--fg)', lineHeight: 1.7, whiteSpace: 'pre-line', margin: 0 }}>
                {site.content.dress_code}
              </p>
            </div>
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
                      {/* Pagamento pelo app ainda não existe de fato — só sinaliza a intenção,
                          sem processar nada (ver migration 20260722000003). */}
                      {!gift.is_purchased && gift.gift_type === 'app_payment' && (
                        <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--muted-fg)' }}>
                          Presentear pelo app · em breve
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Galeria — só o que sobrou depois de espalhar fotos pela história */}
        {remainingPhotos.length > 0 && (
          <section style={{ marginBottom: '56px' }}>
            <SectionTitle>Galeria</SectionTitle>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))' }}>
              {remainingPhotos.map((photo, index) => (
                // eslint-disable-next-line @next/next/no-img-element -- URL arbitrária colada pelo casal, sem domínio fixo para configurar no next/image
                <img
                  key={`${photo.url}-${index}`}
                  src={photo.url}
                  alt={`Foto ${consumedPhotos + index + 1} do casal`}
                  className="rounded-2xl"
                  style={{
                    width: '100%', height: '160px',
                    objectFit:      photo.fit_contain ? 'contain' : 'cover',
                    objectPosition: `center ${photo.position_y}%`,
                    background:     photo.fit_contain ? 'var(--surface)' : undefined,
                  }}
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
