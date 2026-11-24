import { MONOGRAM_IMAGE_LIMITS } from '@/lib/site/customization'
import { fitWithin, ImageOptimizationError } from '@/lib/site/story/optimize-image'

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/**
 * Prepara a imagem do monograma: no máximo 600px, regravada em WEBP (ou PNG onde
 * WEBP não existe) — os dois mantêm a transparência, nunca JPEG. SVG é recusado:
 * o bucket é público e um SVG aberto direto pela URL pode executar script.
 */
export async function optimizeMonogramImage(file: File): Promise<File> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new ImageOptimizationError('Envie o monograma em PNG, JPG ou WEBP (PNG com fundo transparente fica melhor).')
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new ImageOptimizationError('Não foi possível ler a imagem do monograma.')
  }

  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, MONOGRAM_IMAGE_LIMITS.maxDimension)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new ImageOptimizationError('Seu navegador não conseguiu processar a imagem.')
    context.drawImage(bitmap, 0, 0, width, height)

    const webp = await canvasToBlob(canvas, 'image/webp', 0.92)
    const blob = webp && webp.type === 'image/webp' ? webp : await canvasToBlob(canvas, 'image/png')
    if (!blob) throw new ImageOptimizationError('Seu navegador não conseguiu processar a imagem.')
    if (blob.size > MONOGRAM_IMAGE_LIMITS.maxFileBytes) throw new ImageOptimizationError('A imagem do monograma ficou maior que 2 MB. Use um arquivo mais simples.')

    const extension = blob.type === 'image/webp' ? 'webp' : 'png'
    return new File([blob], `monograma.${extension}`, { type: blob.type })
  } finally {
    bitmap.close()
  }
}
