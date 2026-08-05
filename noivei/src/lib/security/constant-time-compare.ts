import { timingSafeEqual } from 'node:crypto'

/**
 * Compara duas strings em tempo constante (evita timing attack em comparação de
 * segredo, ex. CRON_SECRET). `timingSafeEqual` do Node exige buffers do MESMO
 * tamanho, senão lança exceção — por isso o tamanho é checado ANTES, e só então
 * os buffers são comparados. Vazar o COMPRIMENTO das strings por esse early return
 * é aceitável: comprimento não é o segredo, o conteúdo é.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false

  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}
