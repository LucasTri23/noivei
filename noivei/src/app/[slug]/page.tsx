import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { getPublicSiteBySlug, type PublicGalleryPhoto } from '@/lib/site/get-public-site-by-slug'
import type { SiteContent } from '@/lib/site/site-content'
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

// Só as 8 primeiras fotos entram no layout intercalado da timeline — a partir da 9ª (ou
// se sobrar foto além dos blocos de texto disponíveis), tudo cai na Galeria tradicional.
const TIMELINE_MAX_PHOTOS = 8

interface TimelineEntry {
  key:   string
  label?: string
  body:  string
  photo: PublicGalleryPhoto | null
}

// Divide o texto único de "Nossa história" em parágrafos — quebra em uma ou mais linhas em
// branco (`\n\s*\n`), que é como o casal naturalmente separa trechos num textarea. Cada
// parágrafo vira seu próprio bloco na timeline, sem título repetido acima do texto (só a
// seção como um todo tem um título, via SectionTitle) — diferente da versão anterior com
// capítulos cadastrados manualmente, que repetia o mesmo rótulo em cada bloco.
function splitStoryParagraphs(ourStory: string | undefined): string[] {
  if (!ourStory) return []
  return ourStory
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}

// Cada bloco de texto (parágrafos da história + cerimônia/festa) vira uma "parada" na linha do
// tempo e consome uma foto da galeria, na ordem em que ambas aparecem. Decisão de design:
// o número de blocos segue o texto disponível (não as fotos) — um bloco sem foto ainda
// aparece, só que sem imagem ao lado. Só as primeiras TIMELINE_MAX_PHOTOS fotos entram
// aqui; o restante (inclusive as que sobram depois de preencher os blocos) fecha o site
// numa seção de galeria tradicional. Diferente dos blocos de cerimônia/festa (que mantêm
// seu rótulo próprio), os parágrafos da história não têm `label` — evita repetir "Nossa
// história" em cima de cada trecho.
function buildTimelineEntries(
  content:       Pick<SiteContent, 'our_story' | 'ceremony_info' | 'reception_info'>,
  galleryPhotos: PublicGalleryPhoto[],
): TimelineEntry[] {
  const source: { key: string; label?: string; body: string | undefined }[] = [
    ...splitStoryParagraphs(content.our_story).map((paragraph, index) => ({
      key:  `historia-${index}`,
      body: paragraph,
    })),
    { key: 'cerimonia', label: 'Cerimônia', body: content.ceremony_info },
    { key: 'festa',     label: 'Festa',     body: content.reception_info },
  ]

  return source
    .filter((entry): entry is { key: string; label?: string; body: string } => Boolean(entry.body))
    .map((entry, index) => ({
      ...entry,
      photo: index < TIMELINE_MAX_PHOTOS ? (galleryPhotos[index] ?? null) : null,
    }))
}

// Foto em moldura "polaroid" — usada somente nas laterais da história.
function PolaroidPhoto({ photo, index, alt, align }: { photo: PublicGalleryPhoto; index: number; alt: string; align?: 'left' | 'right' }) {
  const rotation = TIMELINE_PHOTO_ROTATIONS[index % TIMELINE_PHOTO_ROTATIONS.length]
  // Centralizado no mobile (coluna única); a partir de `lg` encosta na borda externa da
  // sua coluna, reforçando a sensação de "foto na lateral" do layout de 3 colunas.
  const alignClassName =
    align === 'left' ? 'mx-auto lg:ml-0 lg:mr-auto' : align === 'right' ? 'mx-auto lg:ml-auto lg:mr-0' : 'mx-auto'

  return (
    <div
      className={alignClassName}
      style={{ position: 'relative', maxWidth: '255px', width: '100%', transform: `rotate(${rotation}deg)` }}
    >
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

// Fio curvo que sai da fotografia lateral e chega ao texto central. Só é exibido junto
// com o layout de 3 colunas (a partir de `lg`) — no mobile as fotos vão abaixo do texto
// e não há fio nenhum (ver "hidden lg:block" no chamador).
function StoryWire({ side }: { side: 'left' | 'right' }) {
  const path = side === 'left'
    ? 'M 205 82 C 285 82, 275 145, 420 145 C 455 145, 465 120, 500 120'
    : 'M 795 82 C 715 82, 725 145, 580 145 C 545 145, 535 120, 500 120'

  return (
    <svg
      aria-hidden
      viewBox="0 0 1000 180"
      preserveAspectRatio="none"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0, overflow: 'visible' }}
    >
      <path
        d={path}
        fill="none"
        stroke="var(--wedding-color-secondary)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.62"
      />
      <circle cx="500" cy="120" r="8" fill="var(--surface)" stroke="var(--wedding-color-secondary)" strokeWidth="2" />
      <path
        d="M496.5 118.5c0-2.8 4-3.7 4-0.5 0-3.2 4-2.3 4 0.5 0 2.8-4 5.2-4 5.2s-4-2.4-4-5.2Z"
        fill="none"
        stroke="var(--wedding-color-secondary-dark)"
        strokeWidth="1.2"
      />
    </svg>
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

  // Fotos da galeria espalhadas pelo site em vez de só num bloco isolado: acompanham os
  // blocos da linha do tempo "Nossa história" (ver buildTimelineEntries), até o teto de
  // TIMELINE_MAX_PHOTOS; o restante (as que sobram dos blocos + tudo após a 8ª) fecha o
  // site numa seção de galeria tradicional.
  const galleryPhotos     = site.galleryPhotos
  const timelineEntries   = buildTimelineEntries(site.content, galleryPhotos)
  const timelineTitle     = site.content.our_story ? 'Nossa história' : 'Cerimônia & festa'
  const consumedPhotos    = Math.min(timelineEntries.length, TIMELINE_MAX_PHOTOS)
  const remainingPhotos   = galleryPhotos.slice(consumedPhotos)

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
        {/* Nossa história — texto sempre centralizado, fotos alternando de lado e ligadas
            ao texto por um fio curvo. O layout de 3 colunas só entra a partir de `lg`
            (1024px) — o grid precisa de ~860px pra caber (270px + 320-460px + 270px de
            colunas fixas/mínimas), então ativar já em `md` (768px) estouraria a largura
            em tablets e janelas de notebook menores; no mobile/tablet a foto cai abaixo
            do texto (ver bloco "lg:hidden" mais abaixo). */}
        {timelineEntries.length > 0 && (
          <section style={{ marginBottom: '56px', position: 'relative' }}>
            <SectionTitle>{timelineTitle}</SectionTitle>

            <div className="flex flex-col gap-16">
              {timelineEntries.map((entry, index) => {
                const photoSide: 'left' | 'right' = index % 2 === 0 ? 'left' : 'right'

                const label = entry.label && (
                  <div
                    style={{
                      fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em',
                      textTransform: 'uppercase', color: 'var(--wedding-color-dark)', marginBottom: '10px',
                    }}
                  >
                    {entry.label}
                  </div>
                )

                return (
                  <div
                    key={entry.key}
                    style={{ position: 'relative', minHeight: entry.photo ? '260px' : undefined }}
                  >
                    {entry.photo && (
                      <div className="hidden lg:block">
                        <StoryWire side={photoSide} />
                      </div>
                    )}

                    <div
                      className="grid items-center gap-6 lg:grid-cols-[270px_minmax(320px,460px)_270px] lg:justify-center"
                      style={{ position: 'relative', zIndex: 1 }}
                    >
                      <div className="hidden lg:block">
                        {entry.photo && photoSide === 'left' && (
                          <PolaroidPhoto photo={entry.photo} index={index} alt="Foto do casal" align="left" />
                        )}
                      </div>

                      <div
                        style={{
                          maxWidth: '460px', margin: '0 auto', textAlign: 'center',
                          background: 'color-mix(in srgb, var(--bg) 92%, transparent)',
                          padding: '14px 18px', borderRadius: '18px',
                        }}
                      >
                        {label}
                        <p
                          style={{
                            fontSize: '15px', color: 'var(--fg)', lineHeight: 1.8,
                            whiteSpace: 'pre-line', margin: 0,
                          }}
                        >
                          {entry.body}
                        </p>
                      </div>

                      <div className="hidden lg:block">
                        {entry.photo && photoSide === 'right' && (
                          <PolaroidPhoto photo={entry.photo} index={index} alt="Foto do casal" align="right" />
                        )}
                      </div>

                      {/* No celular/tablet: texto aparece primeiro (já renderizado acima),
                          foto vem logo abaixo — o conteúdo não muda, só a posição. */}
                      {entry.photo && (
                        <div className="lg:hidden" style={{ marginTop: '18px' }}>
                          <PolaroidPhoto photo={entry.photo} index={index} alt="Foto do casal" />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

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
