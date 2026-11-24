import SiteRichText from '@/components/site/site-rich-text'
import { mapsSearchUrl, phoneHref, type SiteFaqItem, type SiteLodgingItem } from '@/lib/site/customization'

// Perguntas frequentes e hospedagem nos estilos Clássico e Portfólio (que usam as
// variáveis do app: --fg, --surface, --wedding-color-*). Os estilos premium têm a
// versão própria no CSS module. `look` só ajusta raio, sombra e espaçamento.

type Look = 'classic' | 'portfolio'

const radius: Record<Look, string> = { classic: '16px', portfolio: '26px' }

export function FaqAccordion({ items, markdown, look }: { items: SiteFaqItem[]; markdown: boolean; look: Look }) {
  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: look === 'portfolio' ? '12px' : '10px' }}>
      {items.map((item, index) => (
        <details
          key={`${index}-${item.question}`}
          className="site-faq-item"
          style={{ background: 'var(--surface)', borderRadius: radius[look], padding: '0 22px', boxShadow: '0 8px 22px rgba(60,40,24,0.06)' }}
        >
          <summary
            style={{
              cursor: 'pointer', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px',
              padding: '18px 0', fontWeight: 700, fontSize: '15px', color: 'var(--fg)',
            }}
          >
            <span style={{ overflowWrap: 'anywhere' }}>{item.question}</span>
            <span aria-hidden className="site-faq-icon" style={{ color: 'var(--wedding-color-dark)', fontSize: '20px', lineHeight: 1, flexShrink: 0 }}>+</span>
          </summary>
          <SiteRichText
            text={item.answer}
            markdown={markdown}
            style={{ fontSize: '14.5px', color: 'var(--muted-fg)', lineHeight: 1.8, whiteSpace: 'pre-line', margin: 0, padding: '0 0 20px', overflowWrap: 'anywhere' }}
          />
        </details>
      ))}
    </div>
  )
}

const linkStyle: React.CSSProperties = {
  fontSize: '13px', fontWeight: 700, color: 'var(--wedding-color-dark)', textDecoration: 'underline', textUnderlineOffset: '4px',
}

export function LodgingCards({ items, markdown, look }: { items: SiteLodgingItem[]; markdown: boolean; look: Look }) {
  return (
    <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))' }}>
      {items.map((item, index) => {
        const mapUrl = item.map_url ?? (item.address ? mapsSearchUrl(item.address) : null)
        return (
          <article
            key={`${index}-${item.name}`}
            style={{ background: 'var(--surface)', borderRadius: radius[look], padding: look === 'portfolio' ? '28px' : '22px', boxShadow: '0 8px 22px rgba(60,40,24,0.06)', minWidth: 0 }}
          >
            <h3 className="font-display" style={{ fontSize: '22px', fontWeight: 600, color: 'var(--fg)', margin: '0 0 8px', overflowWrap: 'anywhere' }}>{item.name}</h3>
            {item.address && <p style={{ fontSize: '13.5px', color: 'var(--muted-fg)', lineHeight: 1.65, margin: '0 0 6px', overflowWrap: 'anywhere' }}>{item.address}</p>}
            {item.notes && (
              <SiteRichText text={item.notes} markdown={markdown} style={{ fontSize: '13.5px', color: 'var(--fg)', lineHeight: 1.7, whiteSpace: 'pre-line', margin: '8px 0 0', overflowWrap: 'anywhere' }} />
            )}
            {item.discount_code && (
              <p style={{ display: 'inline-block', margin: '12px 0 0', padding: '5px 12px', borderRadius: '99px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.04em', background: 'var(--wedding-color-subtle)', color: 'var(--wedding-color-dark)', overflowWrap: 'anywhere' }}>
                Código de desconto: {item.discount_code}
              </p>
            )}
            {(mapUrl || item.phone) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', marginTop: '14px' }}>
                {mapUrl && <a href={mapUrl} target="_blank" rel="noopener noreferrer nofollow" style={linkStyle}>Ver no mapa ↗</a>}
                {item.phone && <a href={phoneHref(item.phone)} style={linkStyle}>{item.phone}</a>}
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}
