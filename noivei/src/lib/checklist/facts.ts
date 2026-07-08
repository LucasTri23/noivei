// Modelo de fatos do motor de regras do Checklist/Timeline.
// Fonte da verdade do conteúdo: docs/checklist-rule-engine.md (§2 fatos derivados, §3 perguntas Q1-Q24).
// As respostas são persistidas em wedding_preferences.answers (JSONB) no formato de WeddingAnswers.

import { z } from 'zod'
import type { Json } from '@/types/database'

const NAO_SEI = 'nao_sei' as const

// ── Q3–Q24: respostas do questionário (Q1 = weddings.wedding_date; Q2 = número de convidados) ──

export const WeddingAnswersSchema = z.object({
  // Passo 1 — Sobre o grande dia
  /** Q2 — número estimado de convidados (a faixa do doc é derivada do número). */
  convidados: z.number().int().positive().nullable().catch(null),
  /** Q3 — faixa de orçamento total. */
  orcamento: z.enum(['ate_30', '30_80', '80_150', '150_mais', NAO_SEI]).catch(NAO_SEI),
  /** Q4 — quem participa da organização. */
  organizacao: z.enum(['so_nos', 'com_familia', NAO_SEI]).catch(NAO_SEI),
  /** Q5 — assessoria/cerimonial. */
  assessoria: z.enum(['completa', 'dia', 'nao', NAO_SEI]).catch(NAO_SEI),

  // Passo 2 — A cerimônia
  /** Q6 — casamento civil. */
  civil: z.enum(['cartorio', 'no_local', 'ja_casados', 'sem_civil', NAO_SEI]).catch(NAO_SEI),
  /** Q7 — cerimônia religiosa ou simbólica. */
  cerimonia: z.enum(['catolica', 'outra_religiao', 'simbolica', 'nao', NAO_SEI]).catch(NAO_SEI),
  /** Q8 — onde será. */
  local: z.enum(['espaco_cidade', 'campo', 'praia', 'casa', 'outra_cidade', 'outro_pais', NAO_SEI]).catch(NAO_SEI),
  /** Q9 — regime de bens. */
  regime_bens: z.enum(['comunhao_parcial', 'outro', NAO_SEI]).catch(NAO_SEI),
  /** Q10 — alguém vai alterar o sobrenome. */
  alterar_sobrenome: z.enum(['sim', 'nao', NAO_SEI]).catch(NAO_SEI),

  // Passo 3 — A festa
  /** Q11 — formato da recepção. */
  recepcao: z.enum(['festa_pista', 'sem_pista', 'nao', NAO_SEI]).catch(NAO_SEI),
  /** Q12 — música da festa. */
  musica: z.enum(['dj', 'banda', 'dj_banda', 'playlist', NAO_SEI]).catch(NAO_SEI),
  /** Q13 — bebidas. */
  bebidas: z.enum(['open_bar', 'simples', 'sem_alcool', NAO_SEI]).catch(NAO_SEI),
  /** Q14 — crianças entre os convidados. */
  criancas: z.enum(['muitas', 'algumas', 'nao', NAO_SEI]).catch(NAO_SEI),
  /** Q15 — cortejo (múltipla escolha; vazio = nenhum). */
  cortejo: z.array(z.enum(['padrinhos', 'daminhas_pajens'])).catch([]),

  // Passo 4 — Fornecedores
  /** Q16 — o que pretendem contratar (múltipla escolha). DJ/banda vem de Q12. */
  fornecedores: z
    .array(
      z.enum([
        'buffet',
        'fotografia',
        'filmagem',
        'doces',
        'bolo',
        'flores_decoracao',
        'carro_cerimonia',
        'cabine_fotos',
        'iluminacao_cenica',
        'som_estrutura',
        'beleza',
        'transporte_convidados',
      ]),
    )
    .catch([]),

  // Passo 5 — Trajes e convites
  /** Q17a — traje da noiva (2 campos fixos por decisão do produto, §8 item 6). */
  traje_noiva: z.enum(['sob_medida', 'pronto', 'alugado', NAO_SEI]).catch(NAO_SEI),
  /** Q17b — traje do noivo. */
  traje_noivo: z.enum(['sob_medida', 'pronto', 'alugado', NAO_SEI]).catch(NAO_SEI),
  /** Q18 — segundo traje para a festa. */
  segundo_traje: z.enum(['sim', 'nao', NAO_SEI]).catch(NAO_SEI),
  /** Q19 — convites. */
  convites: z.enum(['impressos', 'digitais', 'os_dois', NAO_SEI]).catch(NAO_SEI),
  /** Q20 — save the date. */
  save_the_date: z.enum(['sim', 'nao', NAO_SEI]).catch(NAO_SEI),
  /** Q21 — canal de RSVP. */
  rsvp: z.enum(['online', 'manual', NAO_SEI]).catch(NAO_SEI),

  // Passo 6 — Depois do sim
  /** Q22 — lua de mel. */
  lua_de_mel: z.enum(['internacional', 'nacional', 'adiar', 'nao', NAO_SEI]).catch(NAO_SEI),
  /** Q23 — momentos especiais no dia (múltipla escolha). */
  momentos: z.array(z.enum(['making_of', 'first_look', 'votos'])).catch([]),
  /** Q24 — eventos ao redor do casamento (múltipla escolha). */
  eventos: z.array(z.enum(['cha_panela', 'cha_bar', 'despedida', 'jantar_ensaio'])).catch([]),
})

export type WeddingAnswers = z.infer<typeof WeddingAnswersSchema>

export const DEFAULT_ANSWERS: WeddingAnswers = WeddingAnswersSchema.parse({})

/**
 * Faz o parse defensivo do JSONB de wedding_preferences.answers.
 * Campos ausentes ou inválidos caem no default ('nao_sei' / vazio) — comportamento
 * "mostrar por padrão" do §2 do doc.
 */
export function parseAnswers(raw: Record<string, Json | undefined> | null | undefined): WeddingAnswers {
  return WeddingAnswersSchema.parse(raw ?? {})
}

// ── Fatos derivados (§2 do doc) ──

export interface WeddingFacts extends WeddingAnswers {
  /** Q1 — o casal já tem data marcada (weddings.wedding_date preenchido). */
  tem_data: boolean
  /** local ∈ {outra_cidade, outro_pais}. */
  destination: boolean
  /** convidados ≤ 50. */
  mini_wedding: boolean
  /** local ∈ {campo, praia, casa}. */
  ar_livre: boolean
  /** Meses até o casamento (null sem data). Sem tratamento especial para < 12 (§8 item 2). */
  meses_disponiveis: number | null
}

/**
 * Deriva os fatos usados pelas condições do catálogo a partir das respostas
 * do questionário e da data do casamento (weddings.wedding_date, 'YYYY-MM-DD' ou null).
 */
export function deriveFacts(answers: WeddingAnswers, weddingDate: string | null): WeddingFacts {
  const date = weddingDate ? new Date(`${weddingDate}T00:00:00`) : null
  const validDate = date && !Number.isNaN(date.getTime()) ? date : null

  const meses = validDate
    ? Math.floor((validDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30))
    : null

  return {
    ...answers,
    tem_data: validDate !== null,
    destination: answers.local === 'outra_cidade' || answers.local === 'outro_pais',
    mini_wedding: answers.convidados !== null && answers.convidados <= 50,
    ar_livre: answers.local === 'campo' || answers.local === 'praia' || answers.local === 'casa',
    meses_disponiveis: meses,
  }
}

// ── Helpers de condição (regra "ainda não sei" → mostrar por padrão, §8 item 1) ──

/**
 * Verdadeiro se a resposta é uma das opções esperadas OU 'nao_sei'
 * (é mais seguro mostrar uma tarefa dispensável do que esconder uma essencial — §2).
 */
export function isOrUnknown<T extends string>(value: T | 'nao_sei', ...options: T[]): boolean {
  return value === 'nao_sei' || options.includes(value as T)
}

/** Verdadeiro se o número de convidados excede o limite OU ainda não foi informado (mostrar por padrão). */
export function guestsOver(facts: WeddingFacts, limit: number): boolean {
  return facts.convidados === null || facts.convidados > limit
}

/** `ar_livre` com fallback "mostrar por padrão" quando o local ainda não foi decidido. */
export function isArLivre(facts: WeddingFacts): boolean {
  return facts.ar_livre || facts.local === 'nao_sei'
}

/** `destination` com fallback "mostrar por padrão" quando o local ainda não foi decidido. */
export function isDestination(facts: WeddingFacts): boolean {
  return facts.destination || facts.local === 'nao_sei'
}
