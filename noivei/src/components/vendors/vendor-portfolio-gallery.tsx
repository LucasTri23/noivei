'use client'

import { useEffect, useRef, useState } from 'react'

import Spinner from '@/components/ui/spinner'

// Espelha o shape devolvido por GET /api/v1/vendors/[slug]/portfolio (ver
// PublicVendorPortfolioItem na Route Handler) — não importado de lá de propósito,
// mesmo critério de PublicAlbumPhoto em live-photo-gallery.tsx (Route Handlers não
// são pensadas pra serem importadas por componentes client).
interface PublicVendorPortfolioItem {
  id:      string
  caption: string | null
  url:     string | null
}

interface VendorPortfolioGalleryProps {
  slug: string
}

function ImageOffIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="2" x2="22" y2="22" />
      <path d="M10.41 10.41a2 2 0 1 1-2.83-2.83" />
      <line x1="13.5" y1="13.5" x2="6" y2="21" />
      <path d="M18 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h.5" />
      <path d="M21 15V6a2 2 0 0 0-2-2H9" />
    </svg>
  )
}

// Sem polling (diferente de LivePhotoGallery, usada no mural "ao vivo" de
// convidados): o portfólio de um fornecedor muda raramente, um único fetch ao
// montar já é suficiente — não faz sentido recarregar a cada 25s aqui.
export default function VendorPortfolioGallery({ slug }: VendorPortfolioGalleryProps) {
  const [items, setItems]   = useState<PublicVendorPortfolioItem[] | null>(null)
  const mountedRef           = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    async function load() {
      try {
        const res = await fetch(`/api/v1/vendors/${slug}/portfolio`, { cache: 'no-store' })
        if (!mountedRef.current || !res.ok) return
        const { data } = (await res.json()) as { data: PublicVendorPortfolioItem[] }
        if (mountedRef.current) setItems(data)
      } catch {
        // Melhor esforço: uma falha de rede aqui só deixa a galeria vazia, sem
        // travar o resto do perfil (contato/descrição continuam visíveis).
      }
    }

    void load()
    return () => { mountedRef.current = false }
  }, [slug])

  if (items === null) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center' }}>
        <Spinner size={20} color="var(--wedding-color)" />
      </div>
    )
  }

  const visible = items.filter((item) => item.url)

  if (visible.length === 0) {
    return (
      <div style={{ padding: '32px 24px', textAlign: 'center' }}>
        <div style={{ color: 'var(--muted-fg)', marginBottom: '10px', display: 'flex', justifyContent: 'center' }}>
          <ImageOffIcon />
        </div>
        <p style={{ fontSize: '13.5px', color: 'var(--muted-fg)', margin: 0 }}>
          Este fornecedor ainda não adicionou fotos ao portfólio.
        </p>
      </div>
    )
  }

  return (
    <div className="columns-2 sm:columns-3" style={{ columnGap: '8px' }}>
      {visible.map((item) => (
        <div key={item.id} style={{ breakInside: 'avoid', marginBottom: '8px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- signed URL do Storage, expira em minutos, sem domínio fixo pra configurar no next/image */}
          <img
            src={item.url ?? undefined}
            alt={item.caption ?? ''}
            style={{ width: '100%', display: 'block', borderRadius: 'var(--radius-lg)' }}
            loading="lazy"
          />
        </div>
      ))}
    </div>
  )
}
