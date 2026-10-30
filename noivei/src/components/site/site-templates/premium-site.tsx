/* eslint-disable @next/next/no-img-element -- Fotos do casal vêm de URLs de upload ou externas. */
import GiftPaymentButton from '@/components/gifts/gift-payment-button'
import GiftPaymentReturnToast from '@/components/gifts/gift-payment-return-toast'
import LivePhotoGallery from '@/components/album/live-photo-gallery'
import { coverPhotoZoomScale } from '@/lib/site/cover-photo-zoom'
import type { PublicSiteInfo } from '@/lib/site/get-public-site-by-slug'
import type { ExclusiveSiteTemplate } from '@/lib/site/templates'
import InvitationEnvelope from './invitation-envelope'
import styles from './premium-site.module.css'

function dateLabel(date: string | null): string | null {
  if (!date) return null
  const [year, month, day] = date.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function coupleInitials(names: string): string {
  const parts = names.split(/\s*(?:&|\be\b|\band\b)\s*/i).filter(Boolean)
  return parts.slice(0, 2).map((part) => Array.from(part.trim())[0] ?? '').join(' & ') || '♥'
}

function BotanicalSprig({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 160 300" fill="none" aria-hidden="true">
    <path d="M22 288C104 210 38 135 129 14M55 238C71 213 103 209 135 211M63 180C29 165 21 141 22 115M77 125C102 124 132 104 139 76M101 65C78 56 69 39 72 16" stroke="currentColor" strokeWidth="1.3" />
    <g fill="currentColor" opacity=".2"><ellipse cx="112" cy="211" rx="30" ry="10" transform="rotate(-12 112 211)"/><ellipse cx="24" cy="138" rx="10" ry="30" transform="rotate(-27 24 138)"/><ellipse cx="125" cy="102" rx="12" ry="29" transform="rotate(43 125 102)"/><ellipse cx="75" cy="34" rx="10" ry="24" transform="rotate(-21 75 34)"/><ellipse cx="45" cy="249" rx="10" ry="28" transform="rotate(-43 45 249)"/></g>
    <g stroke="currentColor" strokeWidth="1"><ellipse cx="112" cy="211" rx="30" ry="10" transform="rotate(-12 112 211)"/><ellipse cx="24" cy="138" rx="10" ry="30" transform="rotate(-27 24 138)"/><ellipse cx="125" cy="102" rx="12" ry="29" transform="rotate(43 125 102)"/><ellipse cx="75" cy="34" rx="10" ry="24" transform="rotate(-21 75 34)"/></g>
  </svg>
}

export default function PremiumSite({ slug, site, variant }: { slug: string; site: PublicSiteInfo; variant: ExclusiveSiteTemplate }) {
  const { wedding, content } = site
  const date = dateLabel(wedding.wedding_date)
  const title = content.cover_title || wedding.couple_names
  const initials = coupleInitials(wedding.couple_names)
  const place = [wedding.venue, wedding.city].filter(Boolean).join(' · ')
  const mapsUrl = place ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}` : null
  const storyPhoto = content.story_photo_url || site.galleryPhotos[0]?.url
  const page = (
    <div className={`${styles.site} ${styles[variant]}`}>
      <header className={styles.header}>
        <a className={styles.monogram} href="#inicio" aria-label="Início">{initials}</a>
        <nav aria-label="Seções do site"><a href="#celebracao">O grande dia</a>{content.our_story && <a href="#historia">{variant === 'invitation' ? 'Nosso convite' : 'Nossa história'}</a>}{site.gifts.length > 0 && <a href="#presentes">Presentes</a>}<a href="#rsvp">Sua presença</a></nav>
        <span className={styles.headerDate}>{date || 'Vamos celebrar'}</span>
      </header>

      <section id="inicio" className={styles.hero} aria-labelledby="wedding-title">
        <div className={styles.heroCopy}>
          {variant === 'garden' && <BotanicalSprig className={styles.heroBotanical} />}
          <p className={styles.eyebrow}>{variant === 'editorial' ? 'UM NOVO CAPÍTULO, JUNTOS' : variant === 'garden' ? 'O AMOR FLORESCE AQUI' : 'TEMOS A ALEGRIA DE CONVIDAR VOCÊ'}</p>
          {variant === 'invitation' && <div className={styles.crest} aria-hidden="true">{initials}</div>}
          <h1 id="wedding-title">{title}</h1>
          <p className={styles.heroSubtitle}>{content.hero_subtitle || 'Para a vida inteira. E para celebrar com quem faz parte dela.'}</p>
          {date && <p className={styles.weddingDate}>{date}</p>}
          {place && <p className={styles.place}>{place}</p>}
          <a className={styles.button} href="#celebracao">Conheça o nosso grande dia <span aria-hidden="true">↗</span></a>
        </div>
        <div className={styles.heroImage}>
          {site.cover_photo_url ? <img src={site.cover_photo_url} alt={`Retrato de ${wedding.couple_names}`} fetchPriority="high" style={{ objectPosition: `center ${site.cover_photo_position}%`, transform: `scale(${coverPhotoZoomScale(site.cover_photo_zoom)})`, transformOrigin: `center ${site.cover_photo_position}%` }} />
            : <div className={styles.photoPlaceholder}><BotanicalSprig /><span>{initials}</span><p>O NOSSO SIM</p></div>}
          <span className={styles.imageCaption}>A NOSSA HISTÓRIA CONTINUA AQUI</span>
        </div>
        {variant === 'garden' && <BotanicalSprig className={styles.heroBotanicalRight} />}
      </section>

      <div className={styles.dateBand}><span>GUARDE ESTA DATA</span><strong>{date || 'Em breve'}</strong><span>{wedding.city || 'Com as pessoas que amamos'}</span></div>

      {content.our_story && <section id="historia" className={styles.story}>
        {storyPhoto && <figure><img src={storyPhoto} alt={`Um momento especial de ${wedding.couple_names}`} loading="lazy" /><figcaption>NÓS, EM TODOS OS CAPÍTULOS.</figcaption></figure>}
        <div><p className={styles.eyebrow}>{variant === 'invitation' ? 'UMA MENSAGEM ESPECIAL' : '01 / A NOSSA HISTÓRIA'}</p><h2>{variant === 'invitation' ? 'Com carinho, para você.' : content.story_heading || 'De todos os encontros, o nosso.'}</h2><p className={styles.prose}>{content.our_story}</p></div>
      </section>}

      <section id="celebracao" className={styles.celebration}>
        <p className={styles.eyebrow}>O DIA QUE QUEREMOS VIVER COM VOCÊ</p><h2>Vamos celebrar <em>o amor.</em></h2>
        <div className={styles.events}>
          <article><span className={styles.eventNumber}>I.</span><h3>A cerimônia</h3>{date && <p className={styles.eventDate}>{date}</p>}<p className={styles.prose}>{content.ceremony_info || 'Os detalhes da cerimônia serão compartilhados em breve.'}</p>{place && <p>{place}</p>}{mapsUrl && <a className={styles.textLink} href={mapsUrl} target="_blank" rel="noopener noreferrer">Como chegar ↗</a>}</article>
          {content.reception_info && <article><span className={styles.eventNumber}>II.</span><h3>A celebração</h3><p className={styles.prose}>{content.reception_info}</p></article>}
          {content.dress_code && <article><span className={styles.eventNumber}>✧</span><h3>Para vestir</h3><p className={styles.prose}>{content.dress_code}</p></article>}
        </div>
      </section>

      {content.custom_message && <section className={styles.message}><span aria-hidden="true">“</span><blockquote>{content.custom_message}</blockquote><p>COM AMOR, {wedding.couple_names}</p></section>}

      {site.galleryPhotos.length > 0 && <section className={styles.gallerySection}>
        <p className={styles.eyebrow}>MEMÓRIAS QUE NOS TROUXERAM ATÉ AQUI</p><h2>{variant === 'invitation' ? 'Memórias de nós dois.' : content.gallery_heading || 'O amor mora nos detalhes.'}</h2>
        <div className={styles.gallery}>{site.galleryPhotos.map((photo, index) => <figure key={`${photo.url}-${index}`}><img src={photo.url} alt={`Memória ${index + 1} de ${wedding.couple_names}`} loading="lazy" style={{ objectFit: photo.fit_contain ? 'contain' : 'cover', objectPosition: `center ${photo.position_y}%` }} /><figcaption>{String(index + 1).padStart(2, '0')} / NOSSOS MOMENTOS</figcaption></figure>)}</div>
      </section>}

      {site.gifts.length > 0 && <section id="presentes" className={styles.giftsSection}>
        <GiftPaymentReturnToast /><p className={styles.eyebrow}>PARA O NOSSO NOVO CAPÍTULO</p><h2>Pequenos gestos,<br /><em>grandes lembranças.</em></h2>
        <p className={styles.sectionIntro}>Sua presença é o nosso maior presente. Se quiser nos presentear, preparamos esta lista com carinho.</p>
        <div className={styles.gifts}>{site.gifts.map((gift) => <article key={gift.id} className={styles.gift}>
          {gift.image_url && <img src={gift.image_url} alt={gift.name} loading="lazy" />}
          <div><h3>{gift.name}</h3>{gift.description && <p>{gift.description}</p>}{gift.price_cents != null && <p className={styles.giftPrice}>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(gift.price_cents / 100)}</p>}
          {gift.is_purchased ? <span className={styles.giftStatus}>Já foi dado ♥</span> : gift.gift_type === 'app_payment' ? <GiftPaymentButton giftId={gift.id} giftName={gift.name} /> : gift.store_url ? <a className={styles.textLink} href={gift.store_url} target="_blank" rel="noopener noreferrer">Ver na loja ↗</a> : <span>Disponível</span>}</div>
        </article>)}</div>
      </section>}

      {site.albumEnabled && <section className={styles.albumSection}><p className={styles.eyebrow}>PELO OLHAR DE QUEM AMAMOS</p><h2>O nosso mural <em>de memórias.</em></h2><p className={styles.sectionIntro}>As fotos compartilhadas pelos convidados durante o casamento aparecem aqui.</p><LivePhotoGallery slug={slug} limit={8} columnsClassName="columns-2 sm:columns-4" emptyTitle="As próximas memórias ainda estão por vir" emptyMessage="No dia do casamento, envie suas fotos pelo QR code do álbum." /><a className={styles.textLink} href={`/mural/${slug}`}>Ver o mural completo ↗</a></section>}

      <section id="rsvp" className={styles.rsvp}><p className={styles.eyebrow}>VOCÊ FAZ PARTE DESTA HISTÓRIA</p><h2>O nosso sim fica mais bonito<br /><em>com você por perto.</em></h2><p>Cada convidado recebe um link pessoal para confirmar presença. Use o link do seu convite; se ainda não recebeu, fale diretamente com o casal.</p><span className={styles.rsvpMonogram} aria-hidden="true">{initials}</span></section>
      <footer className={styles.footer}><span>{wedding.couple_names}</span><span>{date || 'Com amor'}</span><small>Feito com amor no Wednest</small></footer>
    </div>
  )
  return variant === 'invitation' ? <InvitationEnvelope names={wedding.couple_names} date={date} initials={initials} caption={content.envelope_caption} openingHint={content.opening_hint}>{page}</InvitationEnvelope> : page
}