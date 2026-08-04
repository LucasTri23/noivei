import type { Metadata } from 'next'

import AlbumMuralClient from '@/components/album/album-mural-client'
import { getAlbumBySlug } from '@/lib/album/get-album-by-slug'
import { isTodayWeddingDay } from '@/lib/album/wedding-day'
import { createSupabaseService } from '@/lib/supabase/service'
import { deriveBrandDarkGradient, deriveWeddingColorScale } from '@/lib/theme/wedding-color'

export const metadata: Metadata = {
  title:  'Mural de fotos',
  robots: { index: false, follow: false },
}

interface MuralPageProps {
  params: Promise<{ slug: string }>
}

function MuralMessageShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ background: 'var(--bg)', fontFamily: 'var(--font-body)', padding: '24px' }}
    >
      <div
        className="w-full overflow-hidden rounded-3xl bg-[var(--surface)]"
        style={{ maxWidth: '480px', boxShadow: '0 24px 60px rgba(42,30,16,0.14)' }}
      >
        {children}
      </div>
    </div>
  )
}

function MuralMessage({ emoji, title, message }: { emoji: string; title: string; message: string }) {
  return (
    <MuralMessageShell>
      <div style={{ padding: '48px 36px', textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '10px' }}>{emoji}</div>
        <h1 className="font-display" style={{ fontWeight: 500, fontSize: '28px', color: 'var(--fg)', margin: '0 0 10px' }}>
          {title}
        </h1>
        <p style={{ fontSize: '14.5px', color: 'var(--muted-fg)', margin: 0, lineHeight: 1.6 }}>
          {message}
        </p>
      </div>
    </MuralMessageShell>
  )
}

export default async function MuralPage({ params }: MuralPageProps) {
  const { slug } = await params
  const decodedSlug = decodeURIComponent(slug)

  let album: Awaited<ReturnType<typeof getAlbumBySlug>> = null
  try {
    const supabase = createSupabaseService()
    album = await getAlbumBySlug(supabase, decodedSlug)
  } catch {
    // Ambiente sem service role configurado — trata como mural indisponível
    album = null
  }

  if (!album) {
    return (
      <MuralMessage
        emoji="📷"
        title="Mural não encontrado"
        message="Este link é inválido, ou o site deste casamento ainda não foi publicado. Confira o QR code ou o link recebido dos noivos."
      />
    )
  }

  if (!album.moduleEnabled) {
    return (
      <MuralMessage
        emoji="📷"
        title="Recurso não disponível"
        message="O mural de fotos deste casamento não está disponível no momento."
      />
    )
  }

  const colorScale = deriveWeddingColorScale(album.weddingColor)
  const brandDarkGradient = deriveBrandDarkGradient(album.weddingColorSecondary ?? album.weddingColor)

  const colorVars = {
    '--wedding-color':            colorScale.color,
    '--wedding-color-light':      colorScale.light,
    '--wedding-color-dark':       colorScale.dark,
    '--wedding-color-subtle':     colorScale.subtle,
    '--brand-dark-gradient-from': brandDarkGradient.from,
    '--brand-dark-gradient-to':   brandDarkGradient.to,
  } as React.CSSProperties

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', fontFamily: 'var(--font-body)', ...colorVars }}>
      <AlbumMuralClient
        slug={decodedSlug}
        coupleNames={album.coupleNames}
        weddingDate={album.weddingDate}
        isWeddingDay={isTodayWeddingDay(album.weddingDate)}
      />
    </div>
  )
}
