import { STORY_LIMITS } from './story-limits'

export interface OptimizedImage {
  blob:      Blob
  mimeType:  'image/webp' | 'image/jpeg'
  extension: 'webp' | 'jpg'
  width:     number
  height:    number
}

export class ImageOptimizationError extends Error {}

/** Dimensões finais mantendo a proporção, com o maior lado limitado a `max`. */
export function fitWithin(width: number, height: number, max: number = STORY_LIMITS.maxDimension): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/**
 * Reduz a foto no navegador antes do envio (maior lado ≤ 2400px) e regrava em
 * WEBP (JPEG onde WEBP não é suportado). Efeitos: arquivos bem menores na cota
 * do casal, formato que todos os navegadores exibem e remoção dos metadados
 * EXIF (incluindo localização GPS). A orientação da câmera é aplicada pelo
 * próprio createImageBitmap.
 */
export async function optimizeStoryImage(file: File): Promise<OptimizedImage> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new ImageOptimizationError(`Não foi possível ler "${file.name}". Envie a foto em JPG, PNG ou WEBP.`)
  }

  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new ImageOptimizationError('Seu navegador não conseguiu processar a foto.')
    context.drawImage(bitmap, 0, 0, width, height)

    // toBlob devolve PNG quando o tipo pedido não é suportado — por isso conferir blob.type.
    const webp = await canvasToBlob(canvas, 'image/webp', 0.86)
    if (webp && webp.type === 'image/webp') {
      return { blob: webp, mimeType: 'image/webp', extension: 'webp', width, height }
    }
    const jpeg = await canvasToBlob(canvas, 'image/jpeg', 0.86)
    if (!jpeg) throw new ImageOptimizationError('Seu navegador não conseguiu processar a foto.')
    return { blob: jpeg, mimeType: 'image/jpeg', extension: 'jpg', width, height }
  } finally {
    bitmap.close()
  }
}
