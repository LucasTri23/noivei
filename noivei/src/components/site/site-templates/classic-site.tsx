import GiftPaymentButton from '@/components/gifts/gift-payment-button'
import GiftPaymentReturnToast from '@/components/gifts/gift-payment-return-toast'
import LivePhotoGallery from '@/components/album/live-photo-gallery'
import { coverPhotoZoomScale } from '@/lib/site/cover-photo-zoom'
import type { PublicSiteInfo, PublicGalleryPhoto } from '@/lib/site/get-public-site-by-slug'
import SiteRichText from '@/components/site/site-rich-text'
import { storyPhotoAlt } from '@/components/site/story/story-image'
import type { StoryMomentView, StoryPhotoView, StoryView } from '@/lib/site/story/story-model'

interface ClassicSiteProps {
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

function ArrowRightIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
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
          loading="lazy"
          decoding="async"
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

/* ───────────────────────── Nossa História (apresentações novas) ─────────────────────────
 * Só entra quando o casal escolhe uma apresentação no editor (site.story.layout !==
 * 'legacy'); até lá a seção original acima (polaroids da galeria) fica intacta.
 * Reaproveita a PolaroidPhoto e o coração da linha do tempo deste estilo. */
const storyTextStyle: React.CSSProperties = { fontSize: '15px', color: 'var(--fg)', lineHeight: 1.9, whiteSpace: 'pre-line', margin: 0 }

function ClassicStoryPhoto({ photo, index, coupleNames }: { photo: StoryPhotoView; index: number; coupleNames: string }) {
  return (
    <figure style={{ margin: 0 }}>
      <PolaroidPhoto photo={photo} index={index} alt={storyPhotoAlt(photo, coupleNames, index)} />
      {photo.displayCaption && (
        <figcaption
          className="font-display"
          style={{ fontStyle: 'italic', fontSize: '14px', color: 'var(--muted-fg)', textAlign: 'center', marginTop: '16px', lineHeight: 1.4 }}
        >
          {photo.displayCaption}
        </figcaption>
      )}
    </figure>
  )
}

function ClassicPhotoRow({ photos, coupleNames, offset = 0 }: { photos: StoryPhotoView[]; coupleNames: string; offset?: number }) {
  if (photos.length === 0) return null
  return (
    <div
      className={photos.length === 1 ? 'grid grid-cols-1' : 'grid grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(200px,255px))] sm:justify-center'}
      style={{ gap: '36px 28px', maxWidth: '620px', margin: '40px auto' }}
    >
      {photos.map((photo, index) => (
        <ClassicStoryPhoto key={photo.id} photo={photo} index={offset + index} coupleNames={coupleNames} />
      ))}
    </div>
  )
}

// Linha do tempo: eixo central com o coração do estilo; no celular o eixo vai
// para a esquerda e tudo fica em uma coluna. Texto e fotos alternam de lado.
function ClassicTimeline({ moments, showPhotos, coupleNames, markdown }: {
  moments: StoryMomentView[]; showPhotos: boolean; coupleNames: string; markdown: boolean
}) {
  if (moments.length === 0) return null
  return (
    <ol style={{ position: 'relative', listStyle: 'none', padding: 0, margin: '48px auto 0', maxWidth: '980px' }}>
      <span
        aria-hidden
        className="left-[17px] md:left-1/2"
        style={{ position: 'absolute', top: 0, bottom: 0, width: '2px', transform: 'translateX(-1px)', background: 'color-mix(in srgb, var(--wedding-color-secondary) 45%, transparent)' }}
      />
      {moments.map((moment, index) => {
        const photos = showPhotos ? moment.photos.slice(0, 2) : []
        const textFirst = index % 2 === 0
        return (
          <li key={moment.id} className="relative grid grid-cols-1 md:grid-cols-2 md:gap-x-20" style={{ paddingLeft: 0, marginBottom: '56px' }}>
            <span
              aria-hidden
              className="left-[17px] md:left-1/2"
              style={{
                position: 'absolute', top: '6px', width: '30px', height: '30px', transform: 'translateX(-50%)', borderRadius: '50%',
                background: 'var(--wedding-color-secondary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 3px 8px rgba(60,40,24,0.2)', zIndex: 1,
              }}
            >
              <TimelineHeartIcon />
            </span>

            <div className={`pl-12 md:pl-0 ${textFirst ? 'md:text-right md:pr-6' : 'md:order-2 md:pl-6'}`}>
              {moment.dateLabel && (
                <p style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--wedding-color-dark)', margin: '8px 0 6px' }}>
                  {moment.dateLabel}
                </p>
              )}
              {moment.title && (
                <h3 className="font-display" style={{ fontSize: '26px', fontWeight: 500, color: 'var(--fg)', margin: '0 0 10px', lineHeight: 1.15 }}>
                  {moment.title}
                </h3>
              )}
              {moment.description && <SiteRichText text={moment.description} markdown={markdown} style={{ ...storyTextStyle, fontSize: '14.5px', lineHeight: 1.8 }} />}
            </div>

            {photos.length > 0 && (
              <div className={`pl-12 md:pl-0 ${textFirst ? 'md:pl-6' : 'md:order-1 md:pr-6'}`} style={{ marginTop: '22px' }}>
                <div className={photos.length > 1 ? 'grid grid-cols-2' : 'grid grid-cols-1'} style={{ gap: '24px', maxWidth: photos.length > 1 ? '420px' : '255px' }}>
                  {photos.map((photo, photoIndex) => (
                    <ClassicStoryPhoto key={photo.id} photo={photo} index={index + photoIndex} coupleNames={coupleNames} />
                  ))}
                </div>
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

interface ClassicStoryProps {
  view:        Exclude<StoryView, { layout: 'legacy' }>
  coupleNames: string
  markdown:    boolean
}

/** Nossa História do estilo Clássico nas apresentações novas — também usada na pré-visualização do editor. */
export function ClassicStory({ view, coupleNames, markdown }: ClassicStoryProps) {
  const intro = view.text && (
    <div style={{ maxWidth: '560px', margin: '0 auto', textAlign: 'center' }}>
      <SiteRichText text={view.text} markdown={markdown} style={storyTextStyle} />
    </div>
  )

  if (view.layout === 'illustrated') {
    return (
      <div>
        {view.blocks.map((block, index) => {
          if (block.type === 'text') {
            return (
              <div key={`t-${index}`} style={{ maxWidth: '560px', margin: '0 auto 18px', textAlign: 'center' }}>
                <SiteRichText text={block.text} markdown={markdown} style={storyTextStyle} />
              </div>
            )
          }
          return <ClassicPhotoRow key={`p-${index}`} photos={block.photos} coupleNames={coupleNames} offset={block.offset} />
        })}
        <ClassicTimeline moments={view.moments} showPhotos coupleNames={coupleNames} markdown={markdown} />
      </div>
    )
  }

  if (view.layout === 'gallery') {
    return (
      <div>
        {intro}
        {view.allPhotos.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4" style={{ gap: '44px 28px', marginTop: '44px' }}>
            {view.allPhotos.map((photo, index) => (
              <ClassicStoryPhoto key={photo.id} photo={photo} index={index} coupleNames={coupleNames} />
            ))}
          </div>
        )}
        <ClassicTimeline moments={view.moments} showPhotos={false} coupleNames={coupleNames} markdown={markdown} />
      </div>
    )
  }

  return (
    <div>
      {intro}
      <ClassicPhotoRow photos={view.loosePhotos} coupleNames={coupleNames} />
      <ClassicTimeline moments={view.moments} showPhotos coupleNames={coupleNames} markdown={markdown} />
    </div>
  )
}

// Estilo de site "clássico" — renderização inalterada do site público original
// (capa + história em polaroids + cerimônia/festa + presentes + galeria +
// RSVP), com uma seção nova: uma prévia pequena do mural de fotos ao vivo
// (LivePhotoGallery) + link "ver mural completo", só quando o plano libera o
// módulo 'album'. O template "portfolio" (site-templates/portfolio-site.tsx)
// embute a grade completa nativamente; aqui o mural é só um teaser, porque a
// densidade visual deste template não pega bem com uma grade grande.
export default function ClassicSite({ slug, site }: ClassicSiteProps) {
  const weddingDate = formatWeddingDate(site.wedding.wedding_date)
  const place       = [site.wedding.venue, site.wedding.city].filter(Boolean).join(' · ')
  const coverTitle  = site.content.cover_title || site.wedding.couple_names
  const mapsUrl     = buildMapsUrl(site.wedding.venue, site.wedding.city)

  // Até oito fotos compõem a história: metade na lateral esquerda e metade na direita,
  // independente dos parágrafos do texto (o texto é um bloco único e contínuo).
  const galleryPhotos    = site.galleryPhotos
  const storyPhotos      = galleryPhotos.slice(0, TIMELINE_MAX_PHOTOS)
  const leftStoryPhotos  = storyPhotos.filter((_, index) => index % 2 === 0)
  const rightStoryPhotos = storyPhotos.filter((_, index) => index % 2 === 1)
  // Na apresentação nova a história usa as próprias fotos (purpose = 'story') e
  // todas as fotos da galeria voltam para a seção de galeria.
  const legacyStory      = site.story.layout === 'legacy'
  const markdown         = site.content.rich_text === true
  const consumedPhotos   = legacyStory ? storyPhotos.length : 0
  const remainingPhotos  = galleryPhotos.slice(consumedPhotos)

  // Posição vertical ajustável pelo casal no editor (0=topo, 50=centro, 100=base) —
  // evita que o "cover" corte o casal fora do quadro em fotos com composição diferente.
  const coverBackgroundPositionY = site.cover_photo_position
  // Fator de zoom extra (ver cover-photo-zoom.ts) — aplicado via transform: scale por
  // cima do background-size: cover, já que o CSS puro não permite combinar "cover
  // automático" (calculado em runtime a partir do aspect ratio real da imagem) com um
  // "+N% de zoom" explícito.
  const coverPhotoScale = coverPhotoZoomScale(site.cover_photo_zoom)

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Capa */}
      <div
        className="relative overflow-hidden"
        style={{ color: '#FAF0E6', padding: '96px 24px', textAlign: 'center' }}
      >
        {/* Camada de fundo — só a foto (ou o gradiente de marca da capa, sem foto). O
            zoom é aplicado num filho interno; o frame com overflow:hidden é quem recorta
            o excesso (aplicar o scale direto num elemento com overflow:hidden não
            funciona — a própria transformação não é recortada por seu próprio overflow). */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
          {site.cover_photo_url ? (
            <div
              style={{
                position: 'absolute', inset: 0,
                backgroundImage: `url(${site.cover_photo_url})`,
                backgroundSize: 'cover',
                backgroundPosition: `center ${coverBackgroundPositionY}%`,
                transform: `scale(${coverPhotoScale})`,
                transformOrigin: `center ${coverBackgroundPositionY}%`,
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

        {/* Overlay escuro (legibilidade do texto sobre a foto) + conteúdo — camada
            própria, por cima da foto, SEM o transform de zoom (senão o texto também
            ficaria ampliado/distorcido). */}
        {site.cover_photo_url && (
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{ zIndex: 1, background: 'rgba(20,12,4,0.6)' }} />
        )}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            zIndex: 1,
            backgroundImage: 'radial-gradient(color-mix(in srgb, var(--wedding-color) 18%, transparent) 1.3px, transparent 1.5px)',
            backgroundSize: '26px 26px',
          }}
        />
        <div className="relative" style={{ zIndex: 1 }}>
          {site.content.envelope_monogram && <p className="font-display mb-4 text-3xl italic text-[var(--wedding-color-light)]">{site.content.envelope_monogram}</p>}
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
        {site.story.layout !== 'legacy' && site.story.hasContent && (
          <section id="historia" style={{ marginBottom: '64px' }}>
            <SectionTitle>Nossa história</SectionTitle>
            <ClassicStory view={site.story} coupleNames={site.wedding.couple_names} markdown={markdown} />
          </section>
        )}

        {legacyStory && site.content.our_story && (
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
                <SiteRichText
                  text={site.content.our_story}
                  markdown={markdown}
                  style={{ fontSize: '15px', color: 'var(--fg)', lineHeight: 2, whiteSpace: 'pre-line', margin: 0 }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '180px', paddingTop: '150px' }}>
                {rightStoryPhotos.map((photo, index) => (
                  <StorySidePhoto key={`${photo.url}-right-${index}`} photo={photo} index={index * 2 + 1} side="right" />
                ))}
              </div>
            </div>

            {/* No celular/tablet, o texto continua inteiro e as fotos aparecem abaixo em duas colunas. */}
            <div className="xl:hidden">
              <SiteRichText
                text={site.content.our_story}
                markdown={markdown}
                style={{
                  maxWidth: '560px', margin: '0 auto', textAlign: 'center',
                  fontSize: '15px', color: 'var(--fg)', lineHeight: 1.9, whiteSpace: 'pre-line',
                }}
              />

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
                <SiteRichText text={site.content.ceremony_info} markdown={markdown} style={{ fontSize: '15px', color: 'var(--fg)', lineHeight: 1.8, whiteSpace: 'pre-line', margin: 0 }} />
              </div>
            )}

            {site.content.reception_info && (
              <div style={{ maxWidth: '560px', margin: '0 auto' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--wedding-color-dark)', marginBottom: '10px' }}>
                  Festa
                </div>
                <SiteRichText text={site.content.reception_info} markdown={markdown} style={{ fontSize: '15px', color: 'var(--fg)', lineHeight: 1.8, whiteSpace: 'pre-line', margin: 0 }} />
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
              <SiteRichText text={site.content.dress_code} markdown={markdown} style={{ fontSize: '14.5px', color: 'var(--fg)', lineHeight: 1.7, whiteSpace: 'pre-line', margin: 0 }} />
            </div>
          </section>
        )}

        {site.content.custom_message && (
          <section style={{ marginBottom: '56px', textAlign: 'center' }}>
            <SiteRichText
              text={`\u201C${site.content.custom_message}\u201D`}
              markdown={markdown}
              className="font-display"
              style={{ fontStyle: 'italic', fontSize: '20px', color: 'var(--wedding-color-dark)', lineHeight: 1.6, margin: 0 }}
            />
          </section>
        )}

        {/* Lista de presentes */}
        {site.gifts.length > 0 && (
          <section style={{ marginBottom: '56px' }}>
            <GiftPaymentReturnToast />
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

        {/* Mural de fotos ao vivo — prévia pequena + link pro mural completo
            (/mural/[slug]). Aparece sempre que o plano libera o módulo 'album',
            mesmo sem nenhuma foto ainda (estado vazio explica que ele abre no
            dia do casamento) — mostrar incondicionalmente é intencional. */}
        {site.albumEnabled && (
          <section style={{ marginBottom: '56px' }}>
            <SectionTitle>Mural de fotos</SectionTitle>
            <p style={{ fontSize: '13.5px', color: 'var(--muted-fg)', textAlign: 'center', margin: '-8px 0 20px' }}>
              As fotos que os convidados forem enviando durante o casamento aparecem aqui, ao vivo.
            </p>
            <div className="overflow-hidden rounded-2xl" style={{ border: '1px solid #EBDDD0' }}>
              <LivePhotoGallery
                slug={slug}
                limit={8}
                columnsClassName="columns-2 sm:columns-4"
                emptyTitle="O mural ainda está vazio"
                emptyMessage="Volte no dia do casamento (ou no dia seguinte) — os convidados poderão enviar fotos ao vivo pelo QR code."
              />
            </div>
            <div style={{ textAlign: 'center', marginTop: '18px' }}>
              <a
                href={`/mural/${slug}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '7px',
                  fontSize: '13px', fontWeight: 700, color: 'var(--wedding-color-dark)', textDecoration: 'none',
                }}
              >
                Ver mural completo <ArrowRightIcon />
              </a>
            </div>
          </section>
        )}

        {/* RSVP — o casal pode ocultar no editor */}
        {!site.content.hide_rsvp && (
        <section
          id="rsvp"
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
        )}

        <p style={{ fontSize: '12px', color: 'var(--muted-fg)', marginTop: '40px', textAlign: 'center' }}>
          Feito com <span style={{ color: 'var(--wedding-color)' }}>♥</span> no Wednest
        </p>
      </div>
    </div>
  )
}
