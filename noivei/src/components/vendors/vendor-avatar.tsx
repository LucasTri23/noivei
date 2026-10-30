'use client'
/* eslint-disable @next/next/no-img-element -- Avatar entregue por rota privada com URL assinada. */
import { useState } from 'react'
export default function VendorAvatar({ name, src, size = 44 }: { name: string; src?: string | null; size?: number }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  return <span style={{ display: 'inline-flex', position: 'relative', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: size, height: size, borderRadius: '50%', overflow: 'hidden', background: 'var(--wedding-color-subtle)', color: 'var(--wedding-color-dark)', fontSize: size * .38, fontFamily: 'var(--font-display)', fontWeight: 600 }}>
    {src && failedSrc !== src ? <img src={src} alt={name} loading="lazy" onError={() => setFailedSrc(src)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span aria-label={name}>{name.trim().charAt(0).toUpperCase()}</span>}
  </span>
}
