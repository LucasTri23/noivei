import Link from 'next/link'

import type { VendorListItem } from '@/lib/vendor/list-vendors'

interface VendorCardProps {
  vendor: VendorListItem
}

// Card de marketplace — mesmo tratamento visual de PlanCard (plan-cards-grid.tsx):
// superfície elevada, ring sutil, lift no hover. Sem foto (o bucket de portfólio é
// privado e signed URLs em lote pra uma grade inteira de cards ficaria caro/fora de
// escopo desta fase — só o perfil público gera signed URL, ver
// GET /api/v1/vendors/[slug]/portfolio); o avatar de iniciais cobre a ausência de
// imagem sem deixar o card com aparência de tabela administrativa.
export default function VendorCard({ vendor }: VendorCardProps) {
  const initial = vendor.business_name.charAt(0).toUpperCase()
  const location = [vendor.city, vendor.state].filter(Boolean).join(', ')

  return (
    <Link href={`/profissionais/${vendor.slug}`} className="group block h-full">
      <div
        className="flex h-full flex-col rounded-[var(--radius-xl)] bg-[var(--surface)] p-6 ring-1 ring-[var(--border)] transition-transform duration-300 ease-out group-hover:-translate-y-1"
        style={{ boxShadow: 'var(--shadow), var(--shadow-lg)' }}
      >
        <div className="flex items-center gap-3" style={{ marginBottom: '14px' }}>
          <div
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full font-display text-lg font-semibold"
            style={{ background: 'color-mix(in srgb, var(--wedding-color) 18%, transparent)', color: 'var(--wedding-color-dark)' }}
          >
            {initial}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {vendor.business_name}
            </div>
            {location && (
              <div style={{ fontSize: '12.5px', color: 'var(--muted-fg)' }}>{location}</div>
            )}
          </div>
        </div>

        {vendor.description && (
          <p
            style={{
              fontSize: '13px', color: 'var(--muted-fg)', lineHeight: 1.55, margin: '0 0 14px',
              display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}
          >
            {vendor.description}
          </p>
        )}

        <div style={{ flex: 1 }} />

        <div className="flex flex-wrap items-center gap-1.5" style={{ marginTop: '4px' }}>
          {vendor.price_range && (
            <span
              style={{
                fontSize: '11.5px', fontWeight: 700, padding: '3px 9px', borderRadius: 'var(--radius-full)',
                background: 'var(--wedding-color-subtle)', color: 'var(--wedding-color-dark)',
              }}
            >
              {vendor.price_range}
            </span>
          )}
          {vendor.categories.slice(0, 2).map((category) => (
            <span
              key={category.id}
              style={{
                fontSize: '11.5px', fontWeight: 600, padding: '3px 9px', borderRadius: 'var(--radius-full)',
                background: 'var(--muted)', color: 'var(--muted-fg)',
              }}
            >
              {category.label}
            </span>
          ))}
          {vendor.categories.length > 2 && (
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--muted-fg)' }}>
              +{vendor.categories.length - 2}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
