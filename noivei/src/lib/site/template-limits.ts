import type { SiteTemplate } from '@/types/database'

/**
 * Teto de fotos na galeria por estilo do site público — a grade de cada template foi
 * desenhada para uma quantidade prevista de fotos, então um número muito maior quebra
 * o equilíbrio visual (e, no caso do portfólio, o próprio padrão de linhas).
 *
 * - classic: grade solta (`repeat(auto-fill, minmax(...))`), cresce bem com qualquer
 *   quantidade — sem limite.
 * - portfolio: a seção "Galeria" (ver portfolio-site.tsx) organiza as fotos em um ciclo
 *   de linhas fixas — 4 fotos grandes, depois 5 e 5 menores — e repete esse ciclo
 *   enquanto houver fotos. 4 + 5 + 5 = 14 é exatamente um ciclo completo do padrão:
 *   menos que isso deixa a última linha capenga (poucas fotos "perdidas" numa linha de
 *   5), mais que isso começa a repetir o mesmo padrão de novo e alonga demais a seção
 *   num template que é, de propósito, mais enxuto que o clássico.
 */
export const GALLERY_PHOTO_LIMIT_BY_TEMPLATE: Record<SiteTemplate, number | null> = {
  classic:   null,
  portfolio: 14,
}
