'use client'

import { useEffect, useRef, useState } from 'react'

import Spinner from '@/components/ui/spinner'

// Espelha o shape devolvido por GET /api/v1/album/[slug]/gallery (ver
// PublicAlbumPhoto na Route Handler) — não importado de lá de propósito,
// Route Handlers (route.ts) não são pensados pra serem importados por
// componentes client (mesmo critério de AlbumPhotoWithUrl em album-manager.tsx).
interface PublicAlbumPhoto {
  id:  string
  url: string | null
}

interface LivePhotoGalleryProps {
  slug: string
  // Sem limite, mostra tudo que a API devolver (até o teto do endpoint) — usado
  // pelo mural em tela cheia e pelo template "portfolio", cuja grade densa É a
  // própria seção. Com limite, corta no client (a versão "teaser" do template
  // clássico, que só quer uma prévia pequena antes do link "ver mural completo").
  limit?:         number
  emptyTitle:     string
  emptyMessage:   string
  // Contagem de colunas por breakpoint — a grade densa e assimétrica descrita no
  // briefing vem de pura coluna CSS (`columns-N`), sem nenhuma lib de masonry: a
  // altura de cada foto já varia sozinha com a proporção natural da imagem
  // enviada, o que já produz o efeito "encaixado" pedido.
  columnsClassName?: string
}

// Refetch periódico simples (sem WebSocket/Supabase Realtime): o mural é
// "ao vivo" no sentido de sempre refletir o estado atual do álbum a cada
// visita/poll, não de push instantâneo — mantém a superfície pública simples
// de além do rate limit já generoso o bastante para suportar isso (ver
// GET /api/v1/album/[slug]/gallery).
const AUTO_REFRESH_MS = 25_000

function ImageOffIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="2" x2="22" y2="22" />
      <path d="M10.41 10.41a2 2 0 1 1-2.83-2.83" />
      <line x1="13.5" y1="13.5" x2="6" y2="21" />
      <path d="M18 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h.5" />
      <path d="M21 15V6a2 2 0 0 0-2-2H9" />
    </svg>
  )
}

export default function LivePhotoGallery({
  slug, limit, emptyTitle, emptyMessage, columnsClassName = 'columns-2 sm:columns-3 lg:columns-4',
}: LivePhotoGalleryProps) {
  const [photos, setPhotos]   = useState<PublicAlbumPhoto[] | null>(null)
  const mountedRef            = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    async function load() {
      try {
        const res = await fetch(`/api/v1/album/${slug}/gallery`, { cache: 'no-store' })
        if (!mountedRef.current || !res.ok) return
        const { data } = (await res.json()) as { data: PublicAlbumPhoto[] }
        if (mountedRef.current) setPhotos(data)
      } catch {
        // Melhor esforço: uma falha de rede aqui não deve incomodar o visitante
        // com um toast a cada poll — a grade simplesmente mantém o último estado.
      }
    }

    void load()
    const interval = setInterval(() => void load(), AUTO_REFRESH_MS)
    return () => { mountedRef.current = false; clearInterval(interval) }
  }, [slug])

  if (photos === null) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center' }}>
        <Spinner size={22} color="var(--wedding-color)" />
      </div>
    )
  }

  const visible = limit ? photos.slice(0, limit) : photos

  if (visible.length === 0) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center' }}>
        <div style={{ color: 'var(--wedding-color)', marginBottom: '12px', display: 'flex', justifyContent: 'center' }}>
          <ImageOffIcon />
        </div>
        <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--fg)', marginBottom: '6px' }}>{emptyTitle}</div>
        <p style={{ fontSize: '13.5px', color: 'var(--muted-fg)', margin: 0, lineHeight: 1.6 }}>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className={columnsClassName} style={{ columnGap: '4px' }}>
      {visible.map((photo) => (
        photo.url && (
          <div key={photo.id} style={{ breakInside: 'avoid', marginBottom: '4px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- signed URL do Storage, expira em minutos, sem domínio fixo pra configurar no next/image */}
            <img
              src={photo.url}
              alt=""
              style={{ width: '100%', display: 'block', borderRadius: 0 }}
              loading="lazy"
            />
          </div>
        )
      ))}
    </div>
  )
}
