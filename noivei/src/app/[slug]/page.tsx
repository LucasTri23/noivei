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

// Ícones pequenos e decorativos que ciclam por posição do bloco da timeline (não há dado
// estruturado de "categoria" por bloco de texto) — coração, alianças, recado, estrela.
function TimelineHeartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}
function TimelineRingIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="15" r="5" /><circle cx="16" cy="9" r="5" />
    </svg>
  )
}
function TimelineChatIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}
function TimelineStarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}
const TIMELINE_NODE_ICONS = [TimelineHeartIcon, TimelineRingIcon, TimelineChatIcon, TimelineStarIcon]

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
// aparece, só que centralizado, sem quebrar o zigue-zague dos vizinhos. Só as primeiras
// TIMELINE_MAX_PHOTOS fotos entram aqui; o restante (inclusive as que sobram depois de
// preencher os blocos) fecha o site numa seção de galeria tradicional. Diferente dos blocos
// de cerimônia/festa (que mantêm seu rótulo próprio), os parágrafos da história não têm
// `label` — evita repetir "Nossa história" em cima de cada trecho.
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

// Gera um path SVG em "S" contínuo (um monte por bloco, alternando o lado) que serve de fio
// orgânico ligando os blocos da timeline. Usa preserveAspectRatio="none" no <svg> pai pra
// esticar em qualquer altura de container sem precisar calcular a altura real em pixels
// no servidor — não é pixel-perfeito, mas fica visualmente ondulado em vez de uma reta.
function buildTimelineWavePath(blockCount: number): string {
  const width     = 40
  const segment    = 100
  const midX       = width / 2
  const amplitude  = 13

  let d = `M ${midX} 0`
  for (let i = 0; i < blockCount; i++) {
    const yStart = i * segment
    const yEnd   = yStart + segment
    const yMid   = yStart + segment / 2
    const dir    = i % 2 === 0 ? 1 : -1
    const cx     = midX + dir * amplitude
    d += ` Q ${cx} ${yMid} ${midX} ${yEnd}`
  }
  return d
}

// Foto em moldura "polaroid" — fundo creme simulando a borda física, sombra suave, leve
// rotação por índice e um pin decorativo em forma de coração no topo.
function PolaroidPhoto({ photo, index, alt }: { photo: PublicGalleryPhoto; index: number; alt: string }) {
  const rotation = TIMELINE_PHOTO_ROTATIONS[index % TIMELINE_PHOTO_ROTATIONS.length]

  return (
    <div style={{ position: 'relative', maxWidth: '320px', width: '100%', margin: '0 auto', transform: `rotate(${rotation}deg)` }}>
      <div
        aria-hidden
        style={{
          position: 'absolute', top: '-13px', left: '50%', width: '28px', height: '28px',
          transform: 'translateX(-50%) rotate(-8deg)', borderRadius: '50%',
          background: 'var(--wedding-color-secondary)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 3px 8px rgba(60,40,24,0.28)', zIndex: 2,
        }}
      >
        <TimelineHeartIcon />
      </div>
      <div
        style={{
          background: '#FFFCF6', padding: '10px 10px 30px', borderRadius: '3px',
          boxShadow: '0 16px 32px rgba(60,40,24,0.18), 0 3px 8px rgba(60,40,24,0.12)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- URL do Storage/externa, sem domínio fixo para configurar no next/image */}
        <img
          src={photo.url}
          alt={alt}
          style={{
            width: '100%', height: '250px', display: 'block', borderRadius: '2px',
            objectFit:     photo.fit_contain ? 'contain' : 'cover',
            objectPosition: `center ${photo.position_y}%`,
            background:    photo.fit_contain ? '#F1E9DD' : undefined,
          }}
        />
      </div>
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

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '56px 24px 80px' }}>
        {/* Nossa história — linha do tempo com fotos em moldura polaroid alternando de
            lado, ligadas por um fio dourado orgânico/curvo (só aparece em telas médias+,
            onde há duas colunas de fato; no mobile os blocos empilham e o fio some). */}
        {timelineEntries.length > 0 && (
          <section style={{ marginBottom: '56px', position: 'relative' }}>
            <SectionTitle>{timelineTitle}</SectionTitle>

            <svg
              aria-hidden
              className="hidden md:block"
              viewBox={`0 0 40 ${timelineEntries.length * 100}`}
              preserveAspectRatio="none"
              style={{
                position: 'absolute', top: '8px', left: '50%', width: '40px',
                height: 'calc(100% - 16px)', transform: 'translateX(-50%)', zIndex: 0,
              }}
            >
              <path
                d={buildTimelineWavePath(timelineEntries.length)}
                fill="none"
                stroke="var(--wedding-color-secondary)"
                strokeWidth="2.5"
                strokeLinecap="round"
                opacity="0.55"
              />
            </svg>

            <div className="flex flex-col gap-14" style={{ position: 'relative', zIndex: 1 }}>
              {timelineEntries.map((entry, index) => {
                // Blocos ímpares invertem os lados (foto à esquerda, texto à direita) —
                // é o que produz o zigue-zague conforme a página desce.
                const photoFirst = index % 2 === 1
                const NodeIcon   = TIMELINE_NODE_ICONS[index % TIMELINE_NODE_ICONS.length] ?? TimelineHeartIcon

                // Só os blocos de cerimônia/festa têm rótulo próprio — os parágrafos da
                // história não repetem "Nossa história" em cima de cada trecho.
                const label = entry.label && (
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
                    {/* Ícone circular sobre o fio, centralizado no meio vertical do bloco —
                        cicla entre coração/alianças/recado/estrela por posição do bloco. */}
                    <div
                      aria-hidden
                      className="hidden md:flex"
                      style={{
                        position: 'absolute', top: '50%', left: '50%', width: '34px', height: '34px',
                        alignItems: 'center', justifyContent: 'center', borderRadius: '50%',
                        background: 'var(--surface)', color: 'var(--wedding-color-secondary-dark)',
                        border: '2px solid var(--wedding-color-secondary)',
                        transform: 'translate(-50%,-50%)', zIndex: 2,
                        boxShadow: '0 4px 10px rgba(60,40,24,0.14)',
                      }}
                    >
                      <NodeIcon />
                    </div>

                    {entry.photo ? (
                      <div className="grid gap-6 md:grid-cols-2 md:items-center">
                        <div className={photoFirst ? 'md:order-2' : 'md:order-1'}>
                          {label}
                          {body}
                        </div>
                        <div className={photoFirst ? 'md:order-1' : 'md:order-2'}>
                          <PolaroidPhoto photo={entry.photo} index={index} alt="Foto do casal" />
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
