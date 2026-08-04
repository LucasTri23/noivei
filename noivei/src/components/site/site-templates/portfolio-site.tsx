import GiftPaymentButton from '@/components/gifts/gift-payment-button'
import GiftPaymentReturnToast from '@/components/gifts/gift-payment-return-toast'
import LivePhotoGallery from '@/components/album/live-photo-gallery'
import { coverPhotoZoomScale } from '@/lib/site/cover-photo-zoom'
import type { PublicSiteInfo, PublicGalleryPhoto } from '@/lib/site/get-public-site-by-slug'
import PortfolioCountdown from './portfolio-countdown'

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

// Link de busca do Google Maps — não precisa de API key nem mapa embutido, só abre
// os resultados de busca para o endereço que o casal preencheu (venue e/ou city).
function buildMapsUrl(venue: string | null, city: string | null): string | null {
  const address = [venue, city].filter((part): part is string => Boolean(part?.trim())).join(', ')
  if (!address) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

/* ───────────────────────── Ícones (linha fina, 24×24) ───────────────────────── */

function RingsIcon() {
  return (
    <svg width="26" height="18" viewBox="0 0 32 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="7" />
      <circle cx="20" cy="12" r="7" />
    </svg>
  )
}

function HeartGlyphIcon({ color = 'var(--wedding-color)' }: { color?: string }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill={color} stroke="none" aria-hidden>
      <path d="M12 21s-7.5-4.6-10-9.3C.5 8.4 2 4.8 5.6 4.1c2-.4 4 .5 5 2.2 1-1.7 3-2.6 5-2.2 3.6.7 5.1 4.3 3.6 7.6C19.5 16.4 12 21 12 21z" />
    </svg>
  )
}

function HeartLineIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

function MapPinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" /><circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function CameraLineIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
    </svg>
  )
}

function GiftLineIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" />
      <path d="M12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  )
}

function MailLineIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /><path d="m16 19 2 2 4-4" />
    </svg>
  )
}

function ClockLineIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" />
    </svg>
  )
}

function InfoLineIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><line x1="12" y1="11" x2="12" y2="16" /><circle cx="12" cy="8" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  )
}

/* ───────────────────────── Blocos decorativos reutilizados ───────────────────────── */

// Rótulo pequeno em versalete — mesmo idioma visual em toda seção, sempre seguido do
// divisor linha+coração antes do título grande (ver SectionHeader abaixo).
function Eyebrow({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'onDark' }) {
  return (
    <div
      style={{
        fontSize: '11.5px', fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase',
        color: tone === 'onDark' ? 'var(--wedding-color-light)' : 'var(--wedding-color-dark)',
      }}
    >
      {children}
    </div>
  )
}

// Linha fina + coraçãozinho no meio — separador padrão entre o eyebrow e o título de
// cada seção. `className` controla o alinhamento (flex, não obedece text-align do pai).
function SectionDivider({ tone = 'default', className = 'justify-center' }: { tone?: 'default' | 'onDark'; className?: string }) {
  const lineColor = tone === 'onDark' ? 'rgba(250,240,230,0.4)' : 'var(--wedding-color-secondary)'
  return (
    <div className={`flex items-center gap-2.5 ${className}`} style={{ margin: '12px 0 20px' }} aria-hidden>
      <span style={{ width: '34px', height: '1px', background: lineColor, opacity: tone === 'onDark' ? 1 : 0.6 }} />
      <HeartGlyphIcon color={tone === 'onDark' ? 'var(--wedding-color-light)' : 'var(--wedding-color)'} />
      <span style={{ width: '34px', height: '1px', background: lineColor, opacity: tone === 'onDark' ? 1 : 0.6 }} />
    </div>
  )
}

// Cabeçalho padrão de seção: eyebrow + divisor + título serifado grande + subtítulo
// opcional — usado em (quase) toda seção abaixo da hero, centralizado ou alinhado à
// esquerda conforme o layout do bloco.
function SectionHeader(
  { eyebrow, title, subtitle, align = 'center' }:
  { eyebrow: string; title: React.ReactNode; subtitle?: string; align?: 'center' | 'left' },
) {
  return (
    <div style={{ textAlign: align, marginBottom: '44px' }} className={align === 'center' ? 'mx-auto max-w-2xl' : ''}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <SectionDivider className={align === 'center' ? 'justify-center' : 'justify-start'} />
      <h2
        className="font-display"
        style={{ fontWeight: 500, fontSize: 'clamp(30px,4.4vw,46px)', color: 'var(--fg)', margin: 0, lineHeight: 1.06 }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          style={{
            fontSize: '15px', color: 'var(--muted-fg)', marginTop: '14px', lineHeight: 1.7, maxWidth: '520px',
            marginLeft: align === 'center' ? 'auto' : 0, marginRight: align === 'center' ? 'auto' : 0,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  )
}

// Círculo suave atrás de cada ícone de linha fina — mesma assinatura visual pedida no
// briefing ("ícones de linha fina, círculos decorativos com fundo suave atrás").
function IconCircle({ children, size = 44 }: { children: React.ReactNode; size?: number }) {
  return (
    <div
      style={{
        width: `${size}px`, height: `${size}px`, borderRadius: '50%', flexShrink: 0,
        background: 'var(--wedding-color-subtle)', color: 'var(--wedding-color-dark)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {children}
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)', borderRadius: '26px', padding: '30px',
  boxShadow: '0 10px 28px rgba(60,40,24,0.07)',
}

const pillButtonStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '8px',
  background: 'var(--wedding-color)', color: '#241708', textDecoration: 'none',
  borderRadius: '99px', padding: '11px 22px', fontWeight: 700, fontSize: '13.5px',
}

const pillOutlineButtonStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '8px',
  fontSize: '13px', fontWeight: 700, color: 'var(--wedding-color-secondary-dark)', textDecoration: 'none',
  border: '1.5px solid var(--wedding-color-secondary)', borderRadius: '99px', padding: '10px 20px',
  background: 'var(--wedding-color-secondary-subtle)',
}

/* ───────────────────────── Galeria em linhas de tamanho fixo ─────────────────────────
 * Ciclo de 3 linhas — 4 fotos maiores, depois 5 e 5 menores — repetido enquanto houver
 * fotos (14 = um ciclo completo, ver GALLERY_PHOTO_LIMIT_BY_TEMPLATE). As classes
 * `.pf-gallery-row-a`/`-b` (globals.css) fixam a contagem de colunas por breakpoint —
 * `object-fit: cover` (definido por foto abaixo) garante que nenhuma imagem seja
 * distorcida mesmo com a altura de linha fixa. */
const GALLERY_ROW_PATTERN = [4, 5, 5]

function chunkIntoGalleryRows(photos: PublicGalleryPhoto[]): PublicGalleryPhoto[][] {
  const rows: PublicGalleryPhoto[][] = []
  let index = 0
  let cycle = 0
  while (index < photos.length) {
    const size = GALLERY_ROW_PATTERN[cycle % GALLERY_ROW_PATTERN.length] ?? 5
    rows.push(photos.slice(index, index + size))
    index += size
    cycle += 1
  }
  return rows
}

function PortfolioGalleryGrid({ photos }: { photos: PublicGalleryPhoto[] }) {
  if (photos.length === 0) return null
  const rows = chunkIntoGalleryRows(photos)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {rows.map((row, rowIndex) => {
        const isFeatureRow = rowIndex % GALLERY_ROW_PATTERN.length === 0
        return (
          <div key={rowIndex} className={`pf-gallery-row ${isFeatureRow ? 'pf-gallery-row-a' : 'pf-gallery-row-b'}`}>
            {row.map((photo, photoIndex) => (
              <div key={`${photo.url}-${photoIndex}`} style={{ borderRadius: '18px', overflow: 'hidden', background: 'var(--muted)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- URL do Storage/externa, sem domínio fixo para configurar no next/image */}
                <img
                  src={photo.url}
                  alt={`Foto ${rowIndex * 4 + photoIndex + 1} do casal`}
                  style={{
                    width: '100%', height: '100%', display: 'block',
                    objectFit: photo.fit_contain ? 'contain' : 'cover',
                    objectPosition: `center ${photo.position_y}%`,
                  }}
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

/* ───────────────────────── Linha do tempo de horários (Cerimônia/Festa) ─────────────────────────
 * Sem campo estruturado de horário no conteúdo do site (só os blocos de texto livre
 * `ceremony_info`/`reception_info`, os mesmos que o template clássico usa) — em vez de
 * inventar 4 marcos fixos (Cerimônia/Coquetel/Jantar/Festa) sem dado real por trás, os nós
 * desta linha do tempo são só os dois blocos que o casal de fato preencheu. */
interface ScheduleNode {
  key:   string
  label: string
  text:  string
}

function ScheduleTimeline({ nodes }: { nodes: ScheduleNode[] }) {
  if (nodes.length === 0) return null

  return (
    <div className="flex flex-col gap-8 sm:flex-row sm:gap-0">
      {nodes.map((node, index) => (
        <div key={node.key} style={{ flex: 1, position: 'relative', paddingRight: index < nodes.length - 1 ? '28px' : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <IconCircle size={36}><ClockLineIcon /></IconCircle>
            <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--fg)' }}>{node.label}</span>
          </div>
          <p style={{ fontSize: '13.5px', color: 'var(--muted-fg)', lineHeight: 1.7, whiteSpace: 'pre-line', margin: 0, paddingLeft: '46px' }}>
            {node.text}
          </p>
          {index < nodes.length - 1 && (
            <span
              aria-hidden
              className="hidden sm:block"
              style={{ position: 'absolute', top: '17px', left: 'calc(100% - 14px)', width: '28px', borderTop: '2px dotted var(--wedding-color-secondary)' }}
            />
          )}
        </div>
      ))}
    </div>
  )
}

/* ───────────────────────── Template "portfolio" ─────────────────────────
 * Redesenho no espírito de um site de portfólio de casamento: capa em tela cheia com
 * navegação sobreposta + contagem regressiva, grade de acesso rápido às seções, blocos
 * grandes com eyebrow+divisor+título serifado, e a galeria organizada num ciclo de
 * linhas de tamanho fixo (ver PortfolioGalleryGrid). Cores sempre derivadas da paleta
 * do casal (--wedding-color*, injetadas em /[slug]/page.tsx) — nunca uma cor fixa.
 * Gated ao mesmo plano que libera o mural de fotos (ver get-public-site-by-slug.ts):
 * nunca renderiza aqui se o plano ATUAL não tiver 'album' habilitado, mesmo que
 * site_config.template esteja salvo como 'portfolio'.
 */
export default function PortfolioSite({ slug, site }: PortfolioSiteProps) {
  const weddingDate      = formatWeddingDate(site.wedding.wedding_date)
  const weddingDateUpper = weddingDate?.toUpperCase() ?? null
  const coverTitle       = site.content.cover_title || site.wedding.couple_names
  const mapsUrl          = buildMapsUrl(site.wedding.venue, site.wedding.city)
  const galleryPhotos    = site.galleryPhotos
  const hasCeremony      = Boolean(site.content.ceremony_info || site.content.reception_info)
  const hasVenue         = Boolean(site.wedding.venue || site.wedding.city)
  const hasGallery       = galleryPhotos.length > 0
  const hasGifts         = site.gifts.length > 0

  // Foto de destaque da seção "Nossa história" — usa `content.story_photo_url` quando o
  // casal escolheu explicitamente uma foto pra essa seção (ver HistoriaSection no editor).
  // Se a mesma URL também estiver na galeria, reaproveita o recorte/posição já configurado
  // lá (metaByUrl); senão cai no padrão (centro, sem "contain"). Sites publicados antes
  // desse campo existir (ou que nunca o preencheram) mantêm o comportamento antigo:
  // reaproveitar a primeira foto da galeria curada pelo casal.
  const aboutPhoto = site.content.story_photo_url
    ? (galleryPhotos.find((photo) => photo.url === site.content.story_photo_url) ??
        { url: site.content.story_photo_url, position_y: 50, fit_contain: false })
    : galleryPhotos[0]

  const scheduleNodes: ScheduleNode[] = [
    site.content.ceremony_info && { key: 'ceremony', label: 'Cerimônia', text: site.content.ceremony_info },
    site.content.reception_info && { key: 'reception', label: 'Festa', text: site.content.reception_info },
  ].filter((node): node is ScheduleNode => Boolean(node))

  // Só entram na navegação (barra do topo, grade de acesso rápido) as seções que o
  // casal de fato preencheu — "Início" e "Confirmação de presença" sempre existem.
  const navItems: { href: string; label: string }[] = [
    { href: '#hero', label: 'Início' },
    ...(site.content.our_story ? [{ href: '#historia', label: 'Sobre os noivos' }] : []),
    ...(hasCeremony ? [{ href: '#cerimonia', label: 'Cerimônia e Festa' }] : []),
    ...(hasGallery ? [{ href: '#galeria', label: 'Álbum de Fotos' }] : []),
    ...(hasGifts ? [{ href: '#presentes', label: 'Lista de Presentes' }] : []),
    { href: '#rsvp', label: 'Confirmação de Presença' },
  ]

  const quickLinks: { href: string; icon: React.ReactNode; title: string; desc: string }[] = [
    ...(site.content.our_story
      ? [{ href: '#historia', icon: <HeartLineIcon />, title: 'Sobre os noivos', desc: 'Conheça um pouco da nossa história.' }]
      : []),
    ...(hasCeremony
      ? [{ href: '#cerimonia', icon: <MapPinIcon />, title: 'Cerimônia e Festa', desc: 'Endereço, horários e o que você precisa saber.' }]
      : []),
    ...(hasGallery
      ? [{ href: '#galeria', icon: <CameraLineIcon />, title: 'Álbum de Fotos', desc: 'Os registros mais especiais dessa história.' }]
      : []),
    ...(hasGifts
      ? [{ href: '#presentes', icon: <GiftLineIcon />, title: 'Lista de Presentes', desc: 'Ajude a construir esse novo capítulo.' }]
      : []),
    { href: '#rsvp', icon: <MailLineIcon />, title: 'Confirmação de Presença', desc: 'Confirme sua presença pelo seu link pessoal.' },
  ]

  // Fator de zoom extra (ver cover-photo-zoom.ts) — aplicado via transform: scale por
  // cima do background-size: cover, já que o CSS puro não permite combinar "cover
  // automático" (calculado em runtime a partir do aspect ratio real da imagem) com um
  // "+N% de zoom" explícito. A capa deste template é tela cheia (minHeight: 100vh), bem
  // mais alta que a do clássico — o mesmo cover_photo_position pode precisar de mais
  // zoom aqui para não deixar a foto "afastada demais".
  const coverPhotoScale = coverPhotoZoomScale(site.cover_photo_zoom)

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {/* ── Capa em tela cheia — navegação sobreposta + contagem regressiva ── */}
      <header
        id="hero"
        className="relative flex flex-col"
        style={{ minHeight: '100vh' }}
      >
        {/* Camada de fundo — só a foto (ou o gradiente de marca da capa, sem foto).
            Mesma lógica de ClassicSite: frame com overflow:hidden recorta o excesso do
            filho com o transform de zoom (aplicar o scale direto no frame não
            funcionaria, já que overflow:hidden não recorta a própria transformação do
            elemento que o define). */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
          {site.cover_photo_url ? (
            <div
              style={{
                position: 'absolute', inset: 0,
                backgroundImage: `url(${site.cover_photo_url})`,
                backgroundSize: 'cover',
                backgroundPosition: `center ${site.cover_photo_position}%`,
                transform: `scale(${coverPhotoScale})`,
                transformOrigin: `center ${site.cover_photo_position}%`,
              }}
            />
          ) : (
            <div
              style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(150deg, var(--brand-dark-gradient-from), var(--brand-dark-gradient-to))',
              }}
            />
          )}
        </div>

        {/* Overlay escuro (legibilidade da nav/título sobre a foto) — camada própria,
            por cima da foto, SEM o transform de zoom (senão nav/título também ficariam
            ampliados/distorcidos). */}
        {site.cover_photo_url && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ zIndex: 1, background: 'linear-gradient(to top right, rgba(10,6,2,0.86), rgba(10,6,2,0.22))' }}
          />
        )}

        <nav className="relative z-10 flex items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-12">
          <a href="#hero" style={{ display: 'flex', alignItems: 'center', gap: '9px', color: '#FAF0E6', textDecoration: 'none', minWidth: 0 }}>
            <RingsIcon />
            <span
              className="font-display"
              style={{ fontSize: '16px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {coverTitle}
            </span>
          </a>

          <div className="hidden items-center gap-7 lg:flex">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                style={{ fontSize: '12.5px', fontWeight: 600, letterSpacing: '0.02em', color: 'rgba(250,240,230,0.86)', textDecoration: 'none' }}
              >
                {item.label}
              </a>
            ))}
          </div>

          <a href="#rsvp" style={pillButtonStyle}>RSVP</a>
        </nav>

        <div className="relative z-[1] flex flex-1 flex-col items-center justify-end px-6 pb-14 text-center lg:flex-row lg:items-center lg:justify-end lg:px-14 lg:pb-0 lg:text-left">
          <div style={{ maxWidth: '620px', color: '#FAF0E6' }}>
            <Eyebrow tone="onDark">Sejam bem-vindos!</Eyebrow>
            <SectionDivider tone="onDark" className="justify-center lg:justify-start" />
            <h1
              className="font-display"
              style={{ fontWeight: 500, fontSize: 'clamp(46px,8.5vw,104px)', margin: 0, lineHeight: 0.98 }}
            >
              {coverTitle}
            </h1>
            <p style={{ fontStyle: 'italic', fontSize: 'clamp(15px,2vw,18px)', color: 'rgba(250,240,230,0.86)', margin: '18px 0 0' }}>
              nosso grande dia está chegando!
            </p>
            {(weddingDateUpper || site.wedding.city) && (
              <div style={{ marginTop: '14px' }}>
                {weddingDateUpper && (
                  <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.2em', color: 'var(--wedding-color-light)' }}>
                    {weddingDateUpper}
                  </div>
                )}
                {site.wedding.city && (
                  <div style={{ fontSize: '14px', color: 'rgba(250,240,230,0.72)', marginTop: '4px' }}>
                    {site.wedding.city}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-center lg:justify-start">
              <PortfolioCountdown weddingDate={site.wedding.wedding_date} />
            </div>
          </div>
        </div>
      </header>

      {/* ── Grade de acesso rápido às seções ── */}
      {quickLinks.length > 0 && (
        <section style={{ padding: '64px 20px 12px' }}>
          <div
            className="grid gap-4"
            style={{ maxWidth: '1180px', margin: '0 auto', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}
          >
            {quickLinks.map((item) => (
              <a
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex', flexDirection: 'column', gap: '14px', padding: '26px 22px',
                  borderRadius: '22px', background: 'var(--surface)', textDecoration: 'none',
                  boxShadow: '0 10px 24px rgba(60,40,24,0.06)',
                }}
              >
                <IconCircle>{item.icon}</IconCircle>
                <div>
                  <div style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--fg)', marginBottom: '4px' }}>{item.title}</div>
                  <p style={{ fontSize: '12.5px', color: 'var(--muted-fg)', lineHeight: 1.55, margin: 0 }}>{item.desc}</p>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '20px 20px 0' }}>
        {/* ── Citação ── */}
        {site.content.custom_message && (
          <section style={{ padding: '80px 0', textAlign: 'center' }}>
            <Eyebrow>Uma mensagem para vocês</Eyebrow>
            <SectionDivider />
            <p
              className="font-display"
              style={{ fontStyle: 'italic', fontSize: 'clamp(20px,3vw,30px)', color: 'var(--fg)', lineHeight: 1.5, margin: '0 auto', maxWidth: '760px' }}
            >
              &ldquo;{site.content.custom_message}&rdquo;
            </p>
          </section>
        )}

        {/* ── Sobre os noivos / Nossa história ── */}
        {site.content.our_story && (
          <section id="historia" style={{ padding: '40px 0 80px' }}>
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
              {aboutPhoto && (
                <div style={{ borderRadius: '28px', overflow: 'hidden', order: 1 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- URL do Storage/externa, sem domínio fixo para configurar no next/image */}
                  <img
                    src={aboutPhoto.url}
                    alt="Foto do casal"
                    style={{
                      width: '100%', height: 'clamp(320px,42vw,520px)', display: 'block',
                      objectFit:      aboutPhoto.fit_contain ? 'contain' : 'cover',
                      objectPosition: `center ${aboutPhoto.position_y}%`,
                    }}
                  />
                </div>
              )}
              <div style={{ order: 2 }}>
                <Eyebrow>Nossa história</Eyebrow>
                <SectionDivider className="justify-start" />
                <h2
                  className="font-display"
                  style={{ fontWeight: 500, fontSize: 'clamp(30px,4.4vw,46px)', color: 'var(--fg)', margin: '0 0 14px', lineHeight: 1.06 }}
                >
                  Como tudo começou
                </h2>
                <p style={{ fontStyle: 'italic', fontSize: '15.5px', color: 'var(--wedding-color-dark)', margin: '0 0 18px' }}>
                  Uma história para contar durante toda a vida.
                </p>
                <p style={{ fontSize: '15px', color: 'var(--fg)', lineHeight: 1.9, whiteSpace: 'pre-line', margin: 0 }}>
                  {site.content.our_story}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ── Cerimônia & Festa ── */}
        {hasCeremony && (
          <section id="cerimonia" style={{ padding: '40px 0 80px' }}>
            <SectionHeader
              eyebrow="Cerimônia e festa"
              title="Tudo pra esse dia inesquecível"
              subtitle="O endereço, os horários e as informações que vocês precisam antes de vir celebrar com a gente."
            />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {hasVenue && (
                <div style={cardStyle}>
                  <IconCircle><MapPinIcon /></IconCircle>
                  <h3 className="font-display" style={{ fontSize: '21px', fontWeight: 600, color: 'var(--fg)', margin: '18px 0 6px' }}>
                    Local
                  </h3>
                  <p style={{ fontSize: '14px', color: 'var(--muted-fg)', lineHeight: 1.65, margin: '0 0 20px' }}>
                    {[site.wedding.venue, site.wedding.city].filter(Boolean).join(', ')}
                  </p>
                  {mapsUrl && (
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={pillOutlineButtonStyle}>
                      <MapPinIcon /> Como chegar
                    </a>
                  )}
                </div>
              )}

              <div style={cardStyle}>
                <IconCircle><ClockLineIcon /></IconCircle>
                <h3 className="font-display" style={{ fontSize: '21px', fontWeight: 600, color: 'var(--fg)', margin: '18px 0 20px' }}>
                  Horários
                </h3>
                <ScheduleTimeline nodes={scheduleNodes} />
              </div>

              {site.content.dress_code && (
                <div style={{ ...cardStyle }} className="lg:col-span-2">
                  <IconCircle><InfoLineIcon /></IconCircle>
                  <h3 className="font-display" style={{ fontSize: '21px', fontWeight: 600, color: 'var(--fg)', margin: '18px 0 16px' }}>
                    Informações importantes
                  </h3>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--wedding-color-dark)', marginBottom: '6px' }}>
                        Dress code
                      </div>
                      <p style={{ fontSize: '13.5px', color: 'var(--muted-fg)', lineHeight: 1.7, whiteSpace: 'pre-line', margin: 0 }}>
                        {site.content.dress_code}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Lista de presentes ── */}
        {hasGifts && (
          <section id="presentes" style={{ padding: '40px 0 80px' }}>
            <GiftPaymentReturnToast />
            <SectionHeader eyebrow="Lista de presentes" title="Ajude a construir esse novo capítulo" />
            <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px,1fr))' }}>
              {site.gifts.map((gift) => (
                <div key={gift.id} style={{ ...cardStyle, padding: 0, overflow: 'hidden', opacity: gift.is_purchased ? 0.6 : 1 }}>
                  {gift.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- URL arbitrária colada pelo casal, sem domínio fixo para configurar no next/image
                    <img src={gift.image_url} alt={gift.name} style={{ width: '100%', height: '150px', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <div style={{ height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--wedding-color-subtle)' }}>
                      <IconCircle size={52}><GiftLineIcon /></IconCircle>
                    </div>
                  )}
                  <div style={{ padding: '20px' }}>
                    <div style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--fg)' }}>{gift.name}</div>
                    {gift.price_cents != null && (
                      <div style={{ fontSize: '13.5px', color: 'var(--muted-fg)', marginTop: '3px' }}>
                        {currencyFmt.format(gift.price_cents / 100)}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '11.5px', fontWeight: 700, padding: '4px 12px', borderRadius: '99px',
                          background: gift.is_purchased ? '#E9EFE6' : 'var(--wedding-color-subtle)',
                          color: gift.is_purchased ? '#5E8B6A' : 'var(--wedding-color-dark)',
                        }}
                      >
                        {gift.is_purchased ? 'Já foi dado' : 'Disponível'}
                      </span>
                      {!gift.is_purchased && gift.gift_type === 'link' && gift.store_url && (
                        <a
                          href={gift.store_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: '12px', fontWeight: 700, color: 'var(--wedding-color-dark)', textDecoration: 'none' }}
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

        {/* ── Galeria — fotos curadas pelo casal, em linhas de tamanho fixo ── */}
        {hasGallery && (
          <section id="galeria" style={{ padding: '40px 0 80px' }}>
            <SectionHeader eyebrow="Galeria" title="Momentos" />
            <PortfolioGalleryGrid photos={galleryPhotos} />
          </section>
        )}

        {/* ── Mural de fotos ao vivo — grade completa embutida nativamente, sem
            prévia/link separado (a densidade visual deste template pede isso, ao
            contrário do template clássico, onde é só um teaser). Sempre visível
            quando o plano libera 'album', mesmo com o mural ainda vazio. */}
        {site.albumEnabled && (
          <section style={{ padding: '40px 0 80px' }}>
            <SectionHeader
              eyebrow="Ao vivo"
              title="Mural de fotos"
              subtitle="As fotos que os convidados forem enviando durante o casamento aparecem aqui, ao vivo."
            />
            <LivePhotoGallery
              slug={slug}
              emptyTitle="O mural ainda está vazio"
              emptyMessage="Volte no dia do casamento — os convidados poderão enviar fotos ao vivo pelo QR code."
            />
            <div style={{ textAlign: 'center', marginTop: '22px' }}>
              <a href={`/mural/${slug}`} style={{ ...pillOutlineButtonStyle, border: 'none', background: 'none', padding: 0, color: 'var(--wedding-color-dark)' }}>
                Abrir mural em tela cheia <ArrowRightIcon />
              </a>
            </div>
          </section>
        )}

        {/* ── RSVP ── */}
        <section
          id="rsvp"
          style={{ background: 'var(--wedding-color-subtle)', borderRadius: '32px', padding: '64px 24px', textAlign: 'center', marginBottom: '64px' }}
        >
          <Eyebrow>Presença</Eyebrow>
          <SectionDivider />
          <h2 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(28px,4.2vw,38px)', color: 'var(--fg)', margin: '0 0 12px' }}>
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
