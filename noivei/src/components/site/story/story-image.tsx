/* eslint-disable @next/next/no-img-element -- URLs do Storage do casal, sem domínio fixo para next/image. */
import type { StoryPhotoView } from '@/lib/site/story/story-model'

interface StoryImageProps {
  photo:      StoryPhotoView
  alt:        string
  className?: string
  style?:     React.CSSProperties
}

/**
 * Imagem da história usada por todos os estilos: lazy, decodificação assíncrona
 * e width/height reais (quando conhecidos) para o navegador reservar a
 * proporção antes de carregar — sem deslocamento de layout. O enquadramento
 * (position_y / contain) é o mesmo ajuste usado na galeria.
 */
export default function StoryImage({ photo, alt, className, style }: StoryImageProps) {
  return (
    <img
      src={photo.url}
      alt={alt}
      loading="lazy"
      decoding="async"
      width={photo.width ?? undefined}
      height={photo.height ?? undefined}
      className={className}
      style={{
        objectFit:      photo.fit_contain ? 'contain' : 'cover',
        objectPosition: `center ${photo.position_y}%`,
        ...style,
      }}
    />
  )
}

/** Texto alternativo: a legenda quando existe; senão uma descrição neutra com o nome do casal. */
export function storyPhotoAlt(photo: StoryPhotoView, coupleNames: string, index: number): string {
  return photo.displayCaption ?? `Foto ${index + 1} da história de ${coupleNames}`
}

/** Proporção da foto para reservar espaço quando a altura não é fixa no layout. */
export function storyPhotoAspect(photo: StoryPhotoView, fallback = '4 / 5'): string {
  return photo.width && photo.height ? `${photo.width} / ${photo.height}` : fallback
}
