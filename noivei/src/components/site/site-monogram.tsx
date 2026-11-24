/* eslint-disable @next/next/no-img-element -- Imagem do Storage do casal, sem domínio fixo para o next/image. */

interface SiteMonogramProps {
  /** content.monogram_image_url — já validada (arquivo do próprio casamento). */
  imageUrl?:  string
  /** Monograma em texto ou iniciais: conteúdo sem imagem e texto alternativo da imagem. */
  text:       string
  imgClassName?: string
  imgStyle?:  React.CSSProperties
}

/** Monograma do casal: a imagem enviada, quando houver; senão o texto de sempre. */
export default function SiteMonogram({ imageUrl, text, imgClassName, imgStyle }: SiteMonogramProps) {
  if (!imageUrl) return <>{text}</>
  return <img src={imageUrl} alt={`Monograma ${text}`} className={imgClassName} style={imgStyle} decoding="async" />
}
