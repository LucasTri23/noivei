// Catálogo de tarefas do motor de regras — transcrição fiel do §4 de docs/checklist-rule-engine.md.
// Cada tarefa tem uma condição booleana sobre WeddingFacts; "sempre" = () => true.
//
// Conversão de prazos (texto do doc → offsetDays, dias ANTES do casamento; negativo = depois):
//   12–18 meses ≈ 420 · 12+ meses ≈ 365 · 11 meses ≈ 330 · 10–12 meses ≈ 330 · 10–11 meses ≈ 315
//   10 meses ≈ 300 · 9–12 meses ≈ 365 (início) / 270 (fechamento) · 9 meses ≈ 270 · 8–12 meses ≈ 300
//   8–10 meses ≈ 300 (início) / 240 (fechamento) · 8+ / 8 meses ≈ 240 · 6–9 / 6–8 meses ≈ 210
//   6 meses ≈ 180 · 5 meses ≈ 150 · 4–6 meses ≈ 150 · 4–5 meses ≈ 135 · 4 meses ≈ 120
//   3–4 meses ≈ 105 · 3 meses / 2–4 meses ≈ 90 · ~60 dias ≈ 60 · 2 meses ≈ 60 · 6–8 semanas ≈ 49
//   4 semanas ≈ 28 · 4–3 semanas ≈ 25 · 2–3 semanas ≈ 17 · 2 semanas ≈ 14 · 1 mês ≈ 30
//   semana do casamento ≈ 7 · 3–5 dias ≈ 4 · 2 dias / 1–2 dias ≈ 2 · véspera ≈ 1 · dia = 0
//   pós: até 3 dias ≈ -3 · 1–2 semanas ≈ -10 · 1º mês / até 1 mês ≈ -30 · 2º mês ≈ -60
//   até 3 meses ≈ -90 · recorrente / contínuo / quando quiser = null (sem prazo fixo)
//
// Fases (§5): decididas pelo offset e pelos exemplos explícitos de cada fase do doc.
// Tarefas com offset/fase dependentes de resposta (save the date destination; lua de mel adiada)
// usam funções — resolvidas por resolveOffsetDays/resolvePhase.

import {
  guestsOver,
  isArLivre,
  isDestination,
  isOrUnknown,
  type WeddingFacts,
} from './facts'

// ── Fases da timeline (§5, na ordem do doc) ──

export type TimelinePhaseId =
  | 'fundacao'
  | 'grandes-contratacoes'
  | 'fornecedores-e-trajes'
  | 'detalhes-e-papelaria'
  | 'burocracia-e-confirmacoes'
  | 'reta-final'
  | 'semana-do-casamento'
  | 'o-grande-dia'
  | 'recem-casados'

export const TIMELINE_PHASES: { id: TimelinePhaseId; label: string; window: string }[] = [
  { id: 'fundacao',                  label: 'Fundação',                  window: '12+ meses' },
  { id: 'grandes-contratacoes',      label: 'Grandes contratações',      window: '9–12 meses' },
  { id: 'fornecedores-e-trajes',     label: 'Fornecedores e trajes',     window: '6–9 meses' },
  { id: 'detalhes-e-papelaria',      label: 'Detalhes e papelaria',      window: '4–6 meses' },
  { id: 'burocracia-e-confirmacoes', label: 'Burocracia e confirmações', window: '2–4 meses' },
  { id: 'reta-final',                label: 'Reta final',                window: '3–8 semanas' },
  { id: 'semana-do-casamento',       label: 'Semana do casamento',       window: '7–1 dias' },
  { id: 'o-grande-dia',              label: 'O grande dia',              window: 'dia' },
  { id: 'recem-casados',             label: 'Recém-casados',             window: 'pós' },
]

// ── Categorias do checklist (§4, na ordem do doc) ──

export const CHECKLIST_CATEGORIES = [
  'Planejamento & Organização',
  'Orçamento & Pagamentos',
  'Convidados & RSVP',
  'Cerimônia',
  'Recepção & Festa',
  'Fornecedores',
  'Trajes & Beleza',
  'Papelaria & Identidade Visual',
  'Lua de Mel',
  'Documentação & Civil',
  'Semana do Casamento',
  'Dia do Casamento',
  'Pós-casamento',
] as const

export type ChecklistCategory = (typeof CHECKLIST_CATEGORIES)[number]

// ── Tipo do catálogo ──

export interface CatalogTask {
  /** Chave única e estável — vira checklist_items.catalog_key. */
  key: string
  category: ChecklistCategory
  label: string
  phase: TimelinePhaseId | ((facts: WeddingFacts) => TimelinePhaseId)
  offsetDays: number | null | ((facts: WeddingFacts) => number | null)
  /** Marcada "(opcional, dispensável)" no §4 do doc. */
  dismissable: boolean
  condition: (facts: WeddingFacts) => boolean
  /**
   * Força a tarefa a continuar na checklist fixa do Gratuito mesmo com uma
   * `condition` real (não `always`) — usado quando a condição depende de um fato que
   * só o plano pago coleta (ex: `style`, ver deriveFacts). Sem isso, `condition !==
   * always` tiraria a tarefa do Gratuito também, que nunca lê esse fato.
   */
  freeIncluded?: boolean
}

export function resolvePhase(task: CatalogTask, facts: WeddingFacts): TimelinePhaseId {
  return typeof task.phase === 'function' ? task.phase(facts) : task.phase
}

export function resolveOffsetDays(task: CatalogTask, facts: WeddingFacts): number | null {
  return typeof task.offsetDays === 'function' ? task.offsetDays(facts) : task.offsetDays
}

// ── Helpers internos ──

type TaskInput = Omit<CatalogTask, 'dismissable' | 'condition'> &
  Partial<Pick<CatalogTask, 'dismissable' | 'condition'>>

const always = () => true

function t(input: TaskInput): CatalogTask {
  return { dismissable: false, condition: always, ...input }
}

/**
 * Tarefa "sempre" do doc — a condição é literalmente incondicional (não depende de
 * nenhuma resposta do questionário). É a base da checklist fixa do plano Gratuito.
 */
export function isUnconditionalTask(task: CatalogTask): boolean {
  return task.condition === always || task.freeIncluded === true
}

/** Categoria Recepção & Festa fica inteira oculta se Q11 = "não teremos recepção" (§4.5). */
function withReception(inner: (f: WeddingFacts) => boolean): (f: WeddingFacts) => boolean {
  return (f) => f.recepcao !== 'nao' && inner(f)
}

/** Q17: condição vale se o traje da noiva E/OU o do noivo estiver em uma das opções (§4.7). */
function trajeIs(f: WeddingFacts, ...options: ('sob_medida' | 'pronto' | 'alugado')[]): boolean {
  return isOrUnknown(f.traje_noiva, ...options) || isOrUnknown(f.traje_noivo, ...options)
}

// ── 4.1 Planejamento & Organização (14 tarefas) ──

const PLANEJAMENTO: CatalogTask[] = [
  t({ key: 'planejamento.definir-data', category: 'Planejamento & Organização',
    label: 'Definir a data do casamento',
    phase: 'fundacao', offsetDays: 365, condition: (f) => !f.tem_data }),
  t({ key: 'planejamento.mood-board', category: 'Planejamento & Organização',
    label: 'Definir estilo e visão do casamento (mood board)',
    phase: 'fundacao', offsetDays: 365,
    // Some se o casal já escolheu o estilo no onboarding (weddings.style) — pergunta
    // de novo o que já foi respondido. freeIncluded mantém a tarefa no Gratuito, que
    // nunca coleta esse fato (facts.style sempre null lá).
    condition: (f) => !f.style, freeIncluded: true }),
  t({ key: 'planejamento.orcamento-total', category: 'Planejamento & Organização',
    label: 'Definir orçamento total e teto por categoria',
    phase: 'fundacao', offsetDays: 365 }),
  t({ key: 'planejamento.lista-preliminar', category: 'Planejamento & Organização',
    label: 'Montar lista preliminar de convidados',
    phase: 'fundacao', offsetDays: 365 }),
  t({ key: 'planejamento.alinhar-familias', category: 'Planejamento & Organização',
    label: 'Alinhar expectativas e papéis com as famílias',
    phase: 'fundacao', offsetDays: 365,
    condition: (f) => isOrUnknown(f.organizacao, 'com_familia') }),
  t({ key: 'planejamento.contratar-assessoria', category: 'Planejamento & Organização',
    label: 'Pesquisar e contratar assessoria/cerimonial',
    phase: 'fundacao', offsetDays: 365,
    condition: (f) => isOrUnknown(f.assessoria, 'completa', 'dia') }),
  t({ key: 'planejamento.reservar-local', category: 'Planejamento & Organização',
    label: 'Visitar e reservar o local da cerimônia e da festa',
    phase: 'fundacao', offsetDays: 420 }),
  t({ key: 'planejamento.central-fornecedores', category: 'Planejamento & Organização',
    label: 'Criar planilha/central de fornecedores e contratos',
    phase: 'grandes-contratacoes', offsetDays: 330,
    condition: (f) => isOrUnknown(f.assessoria, 'nao', 'dia') }),
  t({ key: 'planejamento.cronograma-macro', category: 'Planejamento & Organização',
    label: 'Planejar o cronograma macro do planejamento',
    phase: 'grandes-contratacoes', offsetDays: 330,
    condition: (f) => isOrUnknown(f.assessoria, 'nao', 'dia') }),
  t({ key: 'planejamento.reunioes-assessoria', category: 'Planejamento & Organização',
    label: 'Reuniões periódicas de acompanhamento com a assessoria',
    phase: 'fundacao', offsetDays: null,
    condition: (f) => isOrUnknown(f.assessoria, 'completa') }),
  t({ key: 'planejamento.site-casamento', category: 'Planejamento & Organização',
    label: 'Criar site do casamento',
    phase: 'grandes-contratacoes', offsetDays: 300 }),
  t({ key: 'planejamento.plano-b-chuva', category: 'Planejamento & Organização',
    label: 'Pesquisar clima/estação do local e definir plano B de chuva',
    phase: 'grandes-contratacoes', offsetDays: 300, condition: isArLivre }),
  t({ key: 'planejamento.licenca-praia', category: 'Planejamento & Organização',
    label: 'Verificar autorização/licença para evento em área pública',
    phase: 'fornecedores-e-trajes', offsetDays: 240,
    condition: (f) => isOrUnknown(f.local, 'praia') }),
  t({ key: 'planejamento.logistica-viagem', category: 'Planejamento & Organização',
    label: 'Planejar logística geral da viagem (datas, roteiro do grupo)',
    phase: 'grandes-contratacoes', offsetDays: 330, condition: isDestination }),
  // Q24 (§3): chá/despedida ligam um mini-bloco "definir data, lista, local" 2–4 meses antes.
  // Não há linhas próprias no §4, então o mini-bloco vive aqui; fase 4 conforme exemplo do §5
  // ("eventos paralelos"). Jantar de ensaio tem tarefas próprias em 4.11.
  t({ key: 'eventos.cha-panela', category: 'Planejamento & Organização',
    label: 'Organizar o chá de panela (definir data, lista e local)',
    phase: 'detalhes-e-papelaria', offsetDays: 90,
    condition: (f) => f.eventos.includes('cha_panela') }),
  t({ key: 'eventos.cha-bar', category: 'Planejamento & Organização',
    label: 'Organizar o chá bar / chá de casa nova (definir data, lista e local)',
    phase: 'detalhes-e-papelaria', offsetDays: 90,
    condition: (f) => f.eventos.includes('cha_bar') }),
  t({ key: 'eventos.despedida', category: 'Planejamento & Organização',
    label: 'Organizar a despedida de solteiro(a) (definir data, lista e local)',
    phase: 'detalhes-e-papelaria', offsetDays: 90,
    condition: (f) => f.eventos.includes('despedida') }),
]

// ── 4.2 Orçamento & Pagamentos (12 tarefas) ──

const ORCAMENTO: CatalogTask[] = [
  t({ key: 'orcamento.conta-separada', category: 'Orçamento & Pagamentos',
    label: 'Abrir conta/caixinha separada para o casamento',
    phase: 'fundacao', offsetDays: 365 }),
  t({ key: 'orcamento.quem-contribui', category: 'Orçamento & Pagamentos',
    label: 'Definir quem contribui com o quê (casal, famílias)',
    phase: 'fundacao', offsetDays: 365,
    condition: (f) => isOrUnknown(f.organizacao, 'com_familia') }),
  t({ key: 'orcamento.plano-pagamentos', category: 'Orçamento & Pagamentos',
    label: 'Montar plano de pagamentos (entrada/parcelas por fornecedor)',
    phase: 'grandes-contratacoes', offsetDays: 330 }),
  t({ key: 'orcamento.modo-economico', category: 'Orçamento & Pagamentos',
    label: 'Revisar bloco "modo econômico": priorizar 3 itens essenciais e cortar o resto',
    phase: 'grandes-contratacoes', offsetDays: 330,
    condition: (f) => f.orcamento === 'ate_30' }),
  t({ key: 'orcamento.datas-desconto', category: 'Orçamento & Pagamentos',
    label: 'Pesquisar datas/dias com desconto (sexta, domingo, baixa temporada)',
    phase: 'grandes-contratacoes', offsetDays: 330,
    condition: (f) => f.orcamento === 'ate_30' }),
  // Bloco premium: 4 tarefas separadas por decisão do produto (§8 item 3).
  t({ key: 'orcamento.concierge', category: 'Orçamento & Pagamentos',
    label: 'Contratar concierge',
    phase: 'fornecedores-e-trajes', offsetDays: 180,
    condition: (f) => f.orcamento === '150_mais' }),
  t({ key: 'orcamento.valet', category: 'Orçamento & Pagamentos',
    label: 'Contratar valet',
    phase: 'fornecedores-e-trajes', offsetDays: 180,
    condition: (f) => f.orcamento === '150_mais' }),
  t({ key: 'orcamento.seguranca', category: 'Orçamento & Pagamentos',
    label: 'Contratar segurança',
    phase: 'fornecedores-e-trajes', offsetDays: 180,
    condition: (f) => f.orcamento === '150_mais' }),
  t({ key: 'orcamento.lounge-vip', category: 'Orçamento & Pagamentos',
    label: 'Montar lounge VIP',
    phase: 'fornecedores-e-trajes', offsetDays: 180,
    condition: (f) => f.orcamento === '150_mais' }),
  t({ key: 'orcamento.revisao-meio', category: 'Orçamento & Pagamentos',
    label: 'Revisão de meio do caminho: gasto real × orçado',
    phase: 'fornecedores-e-trajes', offsetDays: 180 }),
  t({ key: 'orcamento.fundo-imprevistos', category: 'Orçamento & Pagamentos',
    label: 'Reservar fundo de imprevistos (~10% do orçamento)',
    phase: 'fundacao', offsetDays: 365 }),
  t({ key: 'orcamento.pagamentos-finais', category: 'Orçamento & Pagamentos',
    label: 'Quitar/agendar pagamentos finais e gorjetas em envelopes',
    phase: 'semana-do-casamento', offsetDays: 7 }),
]

// ── 4.3 Convidados & RSVP (12 tarefas) ──

const CONVIDADOS: CatalogTask[] = [
  t({ key: 'convidados.lista-final', category: 'Convidados & RSVP',
    label: 'Fechar a lista final de convidados',
    phase: 'grandes-contratacoes', offsetDays: 270 }),
  t({ key: 'convidados.coletar-contatos', category: 'Convidados & RSVP',
    label: 'Coletar endereços/contatos dos convidados',
    phase: 'fornecedores-e-trajes', offsetDays: 240 }),
  t({ key: 'convidados.convidar-padrinhos', category: 'Convidados & RSVP',
    label: 'Convidar padrinhos e madrinhas (fazer o "pedido")',
    phase: 'grandes-contratacoes', offsetDays: 270,
    condition: (f) => f.cortejo.includes('padrinhos') }),
  t({ key: 'convidados.daminhas-pajens', category: 'Convidados & RSVP',
    label: 'Definir daminhas e pajens e conversar com os pais',
    phase: 'fornecedores-e-trajes', offsetDays: 240,
    condition: (f) => f.cortejo.includes('daminhas_pajens') }),
  // Doc: "destination ou 30%+ convidados de fora" — a 2ª parte não é capturada pelo questionário.
  t({ key: 'convidados.room-block', category: 'Convidados & RSVP',
    label: 'Negociar room block / tarifas de grupo em hotéis',
    phase: 'grandes-contratacoes', offsetDays: 270, condition: isDestination }),
  t({ key: 'convidados.info-viagem-site', category: 'Convidados & RSVP',
    label: 'Publicar informações de viagem/hospedagem no site',
    phase: 'fornecedores-e-trajes', offsetDays: 240, condition: isDestination }),
  t({ key: 'convidados.adults-only', category: 'Convidados & RSVP',
    label: 'Comunicar com delicadeza que a festa é só para adultos (site + boca a boca)',
    phase: 'fornecedores-e-trajes', offsetDays: 180,
    condition: (f) => isOrUnknown(f.criancas, 'nao') }),
  t({ key: 'convidados.rsvp-online', category: 'Convidados & RSVP',
    label: 'Criar página/formulário de RSVP com lembretes',
    phase: 'burocracia-e-confirmacoes', offsetDays: 90,
    condition: (f) => isOrUnknown(f.rsvp, 'online') }),
  t({ key: 'convidados.rsvp-manual', category: 'Convidados & RSVP',
    label: 'Designar responsável pela rodada de confirmações por telefone',
    phase: 'reta-final', offsetDays: 28,
    condition: (f) => isOrUnknown(f.rsvp, 'manual') }),
  t({ key: 'convidados.cobrar-rsvp', category: 'Convidados & RSVP',
    label: 'Acompanhar confirmações e cobrar pendentes',
    phase: 'reta-final', offsetDays: 25 }),
  t({ key: 'convidados.numero-final', category: 'Convidados & RSVP',
    label: 'Fechar número final e informar buffet/espaço',
    phase: 'reta-final', offsetDays: 14 }),
  // Mini wedding (≤50) esconde o mapa de mesas complexo (§3/Q2).
  t({ key: 'convidados.mapa-mesas', category: 'Convidados & RSVP',
    label: 'Montar mapa de mesas / seating chart',
    phase: 'reta-final', offsetDays: 14, condition: (f) => !f.mini_wedding }),
]

// ── 4.4 Cerimônia (15 tarefas) ──

const CERIMONIA: CatalogTask[] = [
  t({ key: 'cerimonia.reservar-igreja', category: 'Cerimônia',
    label: 'Reservar igreja/local da cerimônia religiosa',
    phase: 'fundacao', offsetDays: 420,
    condition: (f) => isOrUnknown(f.cerimonia, 'catolica', 'outra_religiao') }),
  t({ key: 'cerimonia.curso-noivos', category: 'Cerimônia',
    label: 'Fazer o Curso de Noivos (preparação matrimonial)',
    phase: 'fornecedores-e-trajes', offsetDays: 180,
    condition: (f) => isOrUnknown(f.cerimonia, 'catolica') }),
  t({ key: 'cerimonia.docs-igreja', category: 'Cerimônia',
    label: 'Reunir documentação da igreja (batismo p/ fins matrimoniais, crisma)',
    phase: 'fornecedores-e-trajes', offsetDays: 180,
    condition: (f) => isOrUnknown(f.cerimonia, 'catolica') }),
  t({ key: 'cerimonia.processo-matrimonial', category: 'Cerimônia',
    label: 'Entrevista/entrega do processo matrimonial com o pároco',
    phase: 'detalhes-e-papelaria', offsetDays: 120,
    condition: (f) => isOrUnknown(f.cerimonia, 'catolica') }),
  t({ key: 'cerimonia.exigencias-religiosas', category: 'Cerimônia',
    label: 'Verificar exigências da comunidade religiosa (aconselhamento, documentos)',
    phase: 'fornecedores-e-trajes', offsetDays: 180,
    condition: (f) => isOrUnknown(f.cerimonia, 'outra_religiao') }),
  t({ key: 'cerimonia.efeito-civil', category: 'Cerimônia',
    label: 'Decidir se o religioso terá efeito civil (dispensa cerimônia no cartório)',
    phase: 'fornecedores-e-trajes', offsetDays: 240,
    condition: (f) => isOrUnknown(f.cerimonia, 'catolica', 'outra_religiao') && f.civil !== 'ja_casados' }),
  t({ key: 'cerimonia.celebrante', category: 'Cerimônia',
    label: 'Contratar celebrante e construir o roteiro da cerimônia',
    phase: 'fornecedores-e-trajes', offsetDays: 210,
    condition: (f) => isOrUnknown(f.cerimonia, 'simbolica') }),
  t({ key: 'cerimonia.agendar-cartorio', category: 'Cerimônia',
    label: 'Agendar data/hora no cartório',
    phase: 'detalhes-e-papelaria', offsetDays: 120,
    condition: (f) => isOrUnknown(f.civil, 'cartorio') }),
  t({ key: 'cerimonia.diligencia', category: 'Cerimônia',
    label: 'Contratar diligência do cartório / juiz de paz para o local',
    phase: 'fornecedores-e-trajes', offsetDays: 180,
    condition: (f) => isOrUnknown(f.civil, 'no_local') }),
  t({ key: 'cerimonia.musicas', category: 'Cerimônia',
    label: 'Definir músicas da cerimônia (entrada, alianças, saída)',
    phase: 'burocracia-e-confirmacoes', offsetDays: 90,
    condition: (f) => f.cerimonia !== 'nao' || isOrUnknown(f.civil, 'no_local') }),
  t({ key: 'cerimonia.musicos', category: 'Cerimônia',
    label: 'Contratar músicos da cerimônia',
    phase: 'detalhes-e-papelaria', offsetDays: 150,
    condition: (f) => f.fornecedores.includes('som_estrutura') }),
  t({ key: 'cerimonia.ordem-cortejo', category: 'Cerimônia',
    label: 'Definir ordem do cortejo e quem entra com quem',
    phase: 'burocracia-e-confirmacoes', offsetDays: 60,
    condition: (f) => f.cortejo.length > 0 }),
  t({ key: 'cerimonia.ensaiar-entrada', category: 'Cerimônia',
    label: 'Ensaiar a entrada (cortejo, daminhas, pajens)',
    phase: 'semana-do-casamento', offsetDays: 7,
    condition: (f) => f.cortejo.length > 0 }),
  t({ key: 'cerimonia.votos', category: 'Cerimônia',
    label: 'Escrever votos personalizados',
    phase: 'reta-final', offsetDays: 30,
    condition: (f) => f.momentos.includes('votos') }),
  t({ key: 'cerimonia.saida-noivos', category: 'Cerimônia',
    label: 'Definir "saída dos noivos" (pétalas, bolhas — arroz é proibido em muitos espaços)',
    phase: 'reta-final', offsetDays: 30, dismissable: true }),
]

// ── 4.5 Recepção & Festa (16 tarefas — categoria inteira oculta se Q11 = não) ──

const FESTA: CatalogTask[] = [
  t({ key: 'festa.estilo', category: 'Recepção & Festa',
    label: 'Definir estilo da festa (formal, rústico, pé na areia...)',
    phase: 'grandes-contratacoes', offsetDays: 330,
    // Some se o estilo já foi escolhido no onboarding — já era condicional a ter
    // recepção (withReception), então não precisa de freeIncluded (nunca esteve no
    // Gratuito, ver isUnconditionalTask).
    condition: withReception((f) => !f.style) }),
  t({ key: 'festa.cardapio-buffet', category: 'Recepção & Festa',
    label: 'Fechar cardápio com o buffet (+ degustação)',
    phase: 'fornecedores-e-trajes', offsetDays: 180,
    condition: withReception((f) => f.fornecedores.includes('buffet')) }),
  t({ key: 'festa.formato-servico', category: 'Recepção & Festa',
    label: 'Definir formato do serviço (empratado, buffet, finger food)',
    phase: 'fornecedores-e-trajes', offsetDays: 180,
    condition: withReception((f) => f.fornecedores.includes('buffet')) }),
  t({ key: 'festa.cardapio-infantil', category: 'Recepção & Festa',
    label: 'Cardápio infantil',
    phase: 'detalhes-e-papelaria', offsetDays: 120,
    condition: withReception((f) => isOrUnknown(f.criancas, 'muitas', 'algumas')) }),
  t({ key: 'festa.espaco-kids', category: 'Recepção & Festa',
    label: 'Contratar recreação / espaço kids',
    phase: 'detalhes-e-papelaria', offsetDays: 120,
    condition: withReception((f) => isOrUnknown(f.criancas, 'muitas', 'algumas')) }),
  t({ key: 'festa.bartender', category: 'Recepção & Festa',
    label: 'Contratar bartender e fechar carta de drinks',
    phase: 'detalhes-e-papelaria', offsetDays: 150,
    condition: withReception((f) => isOrUnknown(f.bebidas, 'open_bar')) }),
  t({ key: 'festa.calculo-bebidas', category: 'Recepção & Festa',
    label: 'Calcular quantidade de bebidas por convidado',
    phase: 'burocracia-e-confirmacoes', offsetDays: 90,
    condition: withReception((f) => f.bebidas !== 'sem_alcool') }),
  t({ key: 'festa.bebidas-sem-alcool', category: 'Recepção & Festa',
    label: 'Definir bebidas não alcoólicas / bar de sucos e café',
    phase: 'burocracia-e-confirmacoes', offsetDays: 90,
    condition: withReception((f) => isOrUnknown(f.bebidas, 'sem_alcool')) }),
  t({ key: 'festa.repertorio', category: 'Recepção & Festa',
    label: 'Fechar repertório com DJ/banda (incluindo lista de "não toca")',
    phase: 'burocracia-e-confirmacoes', offsetDays: 60,
    condition: withReception((f) => f.musica !== 'playlist') }),
  t({ key: 'festa.playlist', category: 'Recepção & Festa',
    label: 'Montar playlist própria e definir responsável pelo som',
    phase: 'burocracia-e-confirmacoes', offsetDays: 60,
    condition: withReception((f) => isOrUnknown(f.musica, 'playlist')) }),
  t({ key: 'festa.iluminacao-pista', category: 'Recepção & Festa',
    label: 'Contratar iluminação de pista',
    phase: 'detalhes-e-papelaria', offsetDays: 150,
    condition: withReception((f) => isOrUnknown(f.recepcao, 'festa_pista')) }),
  t({ key: 'festa.hora-do-bolo', category: 'Recepção & Festa',
    label: 'Definir música/atração da hora do bolo e primeira dança',
    phase: 'burocracia-e-confirmacoes', offsetDays: 60,
    condition: withReception((f) => isOrUnknown(f.recepcao, 'festa_pista')) }),
  t({ key: 'festa.gerador', category: 'Recepção & Festa',
    label: 'Alugar gerador de energia',
    phase: 'detalhes-e-papelaria', offsetDays: 120,
    condition: withReception((f) => isArLivre(f) && guestsOver(f, 50)) }),
  t({ key: 'festa.estacionamento', category: 'Recepção & Festa',
    label: 'Planejar estacionamento/valet ou transporte de convidados',
    phase: 'burocracia-e-confirmacoes', offsetDays: 90,
    condition: withReception((f) => guestsOver(f, 150) || f.orcamento === '150_mais' || isArLivre(f)) }),
  t({ key: 'festa.lembrancinhas', category: 'Recepção & Festa',
    label: 'Definir lembrancinhas/bem-casados da saída',
    phase: 'burocracia-e-confirmacoes', offsetDays: 90,
    dismissable: true, condition: withReception(always) }),
  t({ key: 'festa.cronograma-festa', category: 'Recepção & Festa',
    label: 'Montar cronograma da festa (entrada, brindes, bolo, buquê, fim)',
    phase: 'reta-final', offsetDays: 30,
    condition: withReception((f) => isOrUnknown(f.assessoria, 'nao', 'dia')) }),
]

// ── 4.6 Fornecedores — pipeline de 6 etapas por fornecedor selecionado (Q12/Q16) ──

interface VendorSpec {
  slug: string
  label: string
  /** Início da janela de contratação (dias antes). */
  windowStart: number
  /** Fechamento da janela (assinar contrato até). */
  windowClose: number
  /** Fase das etapas de contratação (1–4), pelos exemplos do §5. */
  hirePhase: TimelinePhaseId
  condition: (f: WeddingFacts) => boolean
}

const VENDORS: VendorSpec[] = [
  { slug: 'buffet', label: 'buffet', windowStart: 365, windowClose: 270,
    hirePhase: 'grandes-contratacoes', condition: (f) => f.fornecedores.includes('buffet') },
  { slug: 'fotografia', label: 'fotografia', windowStart: 365, windowClose: 270,
    hirePhase: 'grandes-contratacoes', condition: (f) => f.fornecedores.includes('fotografia') },
  { slug: 'filmagem', label: 'filmagem', windowStart: 365, windowClose: 270,
    hirePhase: 'grandes-contratacoes', condition: (f) => f.fornecedores.includes('filmagem') },
  // DJ/banda vem de Q12 (não de Q16).
  { slug: 'banda-dj', label: 'DJ/banda', windowStart: 300, windowClose: 240,
    hirePhase: 'grandes-contratacoes',
    condition: (f) => f.recepcao !== 'nao' && isOrUnknown(f.musica, 'dj', 'banda', 'dj_banda') },
  { slug: 'flores-decoracao', label: 'flores e decoração', windowStart: 240, windowClose: 180,
    hirePhase: 'fornecedores-e-trajes', condition: (f) => f.fornecedores.includes('flores_decoracao') },
  { slug: 'bolo', label: 'bolo', windowStart: 210, windowClose: 180,
    hirePhase: 'fornecedores-e-trajes', condition: (f) => f.fornecedores.includes('bolo') },
  { slug: 'doces', label: 'doces e bem-casados', windowStart: 210, windowClose: 180,
    hirePhase: 'fornecedores-e-trajes', condition: (f) => f.fornecedores.includes('doces') },
  { slug: 'beleza', label: 'beleza (cabelo e maquiagem)', windowStart: 180, windowClose: 150,
    hirePhase: 'detalhes-e-papelaria', condition: (f) => f.fornecedores.includes('beleza') },
  { slug: 'som-estrutura', label: 'som e estrutura', windowStart: 180, windowClose: 150,
    hirePhase: 'detalhes-e-papelaria', condition: (f) => f.fornecedores.includes('som_estrutura') },
  { slug: 'iluminacao-cenica', label: 'iluminação cênica', windowStart: 180, windowClose: 150,
    hirePhase: 'detalhes-e-papelaria', condition: (f) => f.fornecedores.includes('iluminacao_cenica') },
  { slug: 'cabine-fotos', label: 'cabine de fotos', windowStart: 120, windowClose: 90,
    hirePhase: 'burocracia-e-confirmacoes', condition: (f) => f.fornecedores.includes('cabine_fotos') },
  { slug: 'carro-cerimonia', label: 'carro da cerimônia', windowStart: 120, windowClose: 90,
    hirePhase: 'burocracia-e-confirmacoes', condition: (f) => f.fornecedores.includes('carro_cerimonia') },
  { slug: 'transporte-convidados', label: 'transporte de convidados', windowStart: 120, windowClose: 90,
    hirePhase: 'burocracia-e-confirmacoes',
    condition: (f) => f.fornecedores.includes('transporte_convidados') || isDestination(f) },
]

function vendorPipeline(v: VendorSpec): CatalogTask[] {
  const cap = v.label.charAt(0).toUpperCase() + v.label.slice(1)
  return [
    t({ key: `fornecedores.${v.slug}.orcamentos`, category: 'Fornecedores',
      label: `${cap}: pesquisar e pedir orçamentos (3+ opções)`,
      phase: v.hirePhase, offsetDays: v.windowStart, condition: v.condition }),
    t({ key: `fornecedores.${v.slug}.comparar`, category: 'Fornecedores',
      label: `${cap}: comparar propostas e visitar/degustar`,
      phase: v.hirePhase, offsetDays: v.windowStart, condition: v.condition }),
    t({ key: `fornecedores.${v.slug}.contrato`, category: 'Fornecedores',
      label: `${cap}: assinar contrato (ler multa e cláusula de cancelamento)`,
      phase: v.hirePhase, offsetDays: v.windowClose, condition: v.condition }),
    t({ key: `fornecedores.${v.slug}.pagamentos`, category: 'Fornecedores',
      label: `${cap}: registrar pagamentos (entrada + parcelas)`,
      phase: v.hirePhase, offsetDays: null, condition: v.condition }),
    t({ key: `fornecedores.${v.slug}.reconfirmar`, category: 'Fornecedores',
      label: `${cap}: reconfirmar presença, horários e endereço`,
      phase: 'reta-final', offsetDays: 14, condition: v.condition }),
    // Etapa 6 do pipeline — é a linha "Avaliar fornecedores" do §4.13 ("fecha o pipeline de cada um").
    t({ key: `fornecedores.${v.slug}.avaliar`, category: 'Fornecedores',
      label: `${cap}: avaliar o fornecedor`,
      phase: 'recem-casados', offsetDays: -30, condition: v.condition }),
  ]
}

const FORNECEDORES: CatalogTask[] = [
  ...VENDORS.flatMap(vendorPipeline),
  // Extras específicos do §4.6
  t({ key: 'fornecedores.fotografia.ensaio-pre-wedding', category: 'Fornecedores',
    label: 'Ensaio pré-wedding com o fotógrafo',
    phase: 'detalhes-e-papelaria', offsetDays: 150, dismissable: true,
    condition: (f) => f.fornecedores.includes('fotografia') }),
  t({ key: 'fornecedores.taxa-deslocamento', category: 'Fornecedores',
    label: 'Negociar taxa de deslocamento/hospedagem dos fornecedores de fora do destino',
    phase: 'fornecedores-e-trajes', offsetDays: 240, condition: isDestination }),
]

// ── 4.7 Trajes & Beleza (15 tarefas) ──

const TRAJES: CatalogTask[] = [
  t({ key: 'trajes.pesquisar-estilo', category: 'Trajes & Beleza',
    label: 'Pesquisar estilo do vestido da noiva e do terno do noivo',
    phase: 'grandes-contratacoes', offsetDays: 315 }),
  t({ key: 'trajes.sob-medida', category: 'Trajes & Beleza',
    label: 'Encomendar vestido/terno sob medida',
    phase: 'grandes-contratacoes', offsetDays: 300,
    condition: (f) => trajeIs(f, 'sob_medida') }),
  t({ key: 'trajes.comprar-pronto', category: 'Trajes & Beleza',
    label: 'Comprar vestido/terno pronto + ajustes',
    phase: 'fornecedores-e-trajes', offsetDays: 210,
    condition: (f) => trajeIs(f, 'pronto') }),
  t({ key: 'trajes.reservar-aluguel', category: 'Trajes & Beleza',
    label: 'Reservar vestido/terno de aluguel',
    phase: 'fornecedores-e-trajes', offsetDays: 180,
    condition: (f) => trajeIs(f, 'alugado') }),
  t({ key: 'trajes.primeira-prova', category: 'Trajes & Beleza',
    label: '1ª prova do vestido/terno',
    phase: 'burocracia-e-confirmacoes', offsetDays: 90,
    condition: (f) => trajeIs(f, 'sob_medida', 'pronto') }),
  t({ key: 'trajes.prova-final', category: 'Trajes & Beleza',
    label: 'Prova final do vestido/terno',
    phase: 'reta-final', offsetDays: 17 }),
  t({ key: 'trajes.segundo-traje', category: 'Trajes & Beleza',
    label: 'Escolher e provar o segundo traje da festa',
    phase: 'detalhes-e-papelaria', offsetDays: 120,
    condition: (f) => isOrUnknown(f.segundo_traje, 'sim') }),
  t({ key: 'trajes.sapatos-acessorios', category: 'Trajes & Beleza',
    label: 'Comprar sapatos e acessórios (véu, joias, gravata/lapela)',
    phase: 'detalhes-e-papelaria', offsetDays: 120 }),
  t({ key: 'trajes.amaciar-sapatos', category: 'Trajes & Beleza',
    label: '"Amaciar" os sapatos usando em casa',
    phase: 'reta-final', offsetDays: 30 }),
  t({ key: 'trajes.paleta-padrinhos', category: 'Trajes & Beleza',
    label: 'Definir paleta/traje de padrinhos e madrinhas e comunicar',
    phase: 'fornecedores-e-trajes', offsetDays: 180,
    condition: (f) => f.cortejo.includes('padrinhos') }),
  t({ key: 'trajes.daminhas-pajens', category: 'Trajes & Beleza',
    label: 'Providenciar trajes de daminhas e pajens',
    phase: 'detalhes-e-papelaria', offsetDays: 120,
    condition: (f) => f.cortejo.includes('daminhas_pajens') }),
  t({ key: 'trajes.prova-beleza', category: 'Trajes & Beleza',
    label: 'Prova de cabelo e maquiagem',
    phase: 'burocracia-e-confirmacoes', offsetDays: 60,
    condition: (f) => f.fornecedores.includes('beleza') }),
  t({ key: 'trajes.rotina-cuidados', category: 'Trajes & Beleza',
    label: 'Agendar rotina de cuidados (pele, cabelo, barba, unhas)',
    phase: 'fornecedores-e-trajes', offsetDays: 180, dismissable: true }),
  t({ key: 'trajes.retirar-aluguel', category: 'Trajes & Beleza',
    label: 'Retirar vestido/terno alugado',
    phase: 'semana-do-casamento', offsetDays: 7,
    condition: (f) => trajeIs(f, 'alugado') }),
  // Alianças ficam aqui por conveniência de compra; aparecem também no kit do dia D (§4.7).
  t({ key: 'trajes.aliancas', category: 'Trajes & Beleza',
    label: 'Comprar/gravar as alianças',
    phase: 'burocracia-e-confirmacoes', offsetDays: 90 }),
]

// ── 4.8 Papelaria & Identidade Visual (10 tarefas) ──

const PAPELARIA: CatalogTask[] = [
  t({ key: 'papelaria.identidade-visual', category: 'Papelaria & Identidade Visual',
    label: 'Definir identidade visual (monograma, paleta, tipografia)',
    phase: 'grandes-contratacoes', offsetDays: 270 }),
  // Save the date desloca da fase 3 para a fase 2 se destination (§5, regra 3).
  t({ key: 'papelaria.save-the-date', category: 'Papelaria & Identidade Visual',
    label: 'Criar e enviar save the date',
    phase: (f) => (isDestination(f) ? 'grandes-contratacoes' : 'fornecedores-e-trajes'),
    offsetDays: (f) => (isDestination(f) ? 330 : 240),
    condition: (f) => isOrUnknown(f.save_the_date, 'sim') }),
  t({ key: 'papelaria.arte-convite', category: 'Papelaria & Identidade Visual',
    label: 'Aprovar arte do convite',
    phase: 'detalhes-e-papelaria', offsetDays: 135 }),
  t({ key: 'papelaria.imprimir-convites', category: 'Papelaria & Identidade Visual',
    label: 'Imprimir convites',
    phase: 'detalhes-e-papelaria', offsetDays: 105,
    condition: (f) => isOrUnknown(f.convites, 'impressos', 'os_dois') }),
  t({ key: 'papelaria.enviar-convites', category: 'Papelaria & Identidade Visual',
    label: 'Envelopar e entregar/postar convites',
    phase: 'reta-final', offsetDays: 49,
    condition: (f) => isOrUnknown(f.convites, 'impressos', 'os_dois') }),
  t({ key: 'papelaria.convites-digitais', category: 'Papelaria & Identidade Visual',
    label: 'Disparar convites digitais',
    phase: 'reta-final', offsetDays: 49,
    condition: (f) => isOrUnknown(f.convites, 'digitais', 'os_dois') }),
  t({ key: 'papelaria.papelaria-do-dia', category: 'Papelaria & Identidade Visual',
    label: 'Encomendar papelaria do dia (menu, plaquinhas, número de mesa)',
    phase: 'burocracia-e-confirmacoes', offsetDays: 60, dismissable: true }),
  t({ key: 'papelaria.itens-saida', category: 'Papelaria & Identidade Visual',
    label: 'Encomendar itens de saída (lágrimas de alegria, pétalas)',
    phase: 'reta-final', offsetDays: 30, dismissable: true }),
  t({ key: 'papelaria.lista-presentes', category: 'Papelaria & Identidade Visual',
    label: 'Criar lista de presentes (registry) e divulgar no site',
    phase: 'fornecedores-e-trajes', offsetDays: 240 }),
  t({ key: 'papelaria.welcome-bag', category: 'Papelaria & Identidade Visual',
    label: 'Encomendar welcome bag para convidados de fora',
    phase: 'reta-final', offsetDays: 30, condition: isDestination }),
]

// ── 4.9 Lua de Mel (11 tarefas — categoria oculta se Q22 = não; "adiar" move tudo para o pós) ──

const adiada = (offset: number) => (f: WeddingFacts) => (f.lua_de_mel === 'adiar' ? null : offset)
const adiadaPhase = (phase: TimelinePhaseId) => (f: WeddingFacts): TimelinePhaseId =>
  f.lua_de_mel === 'adiar' ? 'recem-casados' : phase

const LUA_DE_MEL: CatalogTask[] = [
  t({ key: 'luademel.destino', category: 'Lua de Mel',
    label: 'Escolher destino e época (checar alta temporada/clima)',
    phase: adiadaPhase('grandes-contratacoes'), offsetDays: adiada(270),
    condition: (f) => f.lua_de_mel !== 'nao' }),
  t({ key: 'luademel.orcamento', category: 'Lua de Mel',
    label: 'Definir orçamento da lua de mel',
    phase: adiadaPhase('fornecedores-e-trajes'), offsetDays: adiada(240),
    condition: (f) => f.lua_de_mel !== 'nao' }),
  t({ key: 'luademel.reservas', category: 'Lua de Mel',
    label: 'Reservar voos e hospedagem',
    phase: adiadaPhase('fornecedores-e-trajes'), offsetDays: adiada(180),
    condition: (f) => f.lua_de_mel !== 'nao' }),
  t({ key: 'luademel.passaportes', category: 'Lua de Mel',
    label: 'Emitir/renovar passaportes (validade 3+ meses além do retorno)',
    phase: 'fornecedores-e-trajes', offsetDays: 180,
    condition: (f) => isOrUnknown(f.lua_de_mel, 'internacional') }),
  t({ key: 'luademel.visto', category: 'Lua de Mel',
    label: 'Verificar e solicitar visto do destino',
    phase: 'fornecedores-e-trajes', offsetDays: 180,
    condition: (f) => isOrUnknown(f.lua_de_mel, 'internacional') }),
  t({ key: 'luademel.vacinas', category: 'Lua de Mel',
    label: 'Verificar vacinas exigidas (ex.: febre amarela) e certificado internacional',
    phase: 'detalhes-e-papelaria', offsetDays: 120,
    condition: (f) => isOrUnknown(f.lua_de_mel, 'internacional') }),
  t({ key: 'luademel.seguro-viagem', category: 'Lua de Mel',
    label: 'Contratar seguro viagem (obrigatório em Schengen, Cuba etc.)',
    phase: 'burocracia-e-confirmacoes', offsetDays: 60,
    condition: (f) => isOrUnknown(f.lua_de_mel, 'internacional') }),
  t({ key: 'luademel.cambio', category: 'Lua de Mel',
    label: 'Planejar câmbio / cartão internacional / conta multimoeda',
    phase: 'reta-final', offsetDays: 30,
    condition: (f) => isOrUnknown(f.lua_de_mel, 'internacional') }),
  t({ key: 'luademel.chip', category: 'Lua de Mel',
    label: 'Providenciar chip internacional ou eSIM',
    phase: 'reta-final', offsetDays: 14,
    condition: (f) => isOrUnknown(f.lua_de_mel, 'internacional') }),
  t({ key: 'luademel.roteiro', category: 'Lua de Mel',
    label: 'Montar roteiro e reservar passeios/restaurantes',
    phase: adiadaPhase('burocracia-e-confirmacoes'), offsetDays: adiada(60),
    condition: (f) => f.lua_de_mel !== 'nao' }),
  t({ key: 'luademel.malas', category: 'Lua de Mel',
    label: 'Fazer as malas da lua de mel',
    phase: 'semana-do-casamento', offsetDays: 7,
    condition: (f) => isOrUnknown(f.lua_de_mel, 'internacional', 'nacional') }),
]

// ── 4.10 Documentação & Civil (10 tarefas — quase toda oculta se Q6 = já casados) ──

const DOCUMENTACAO: CatalogTask[] = [
  t({ key: 'documentacao.regime-bens', category: 'Documentação & Civil',
    label: 'Pesquisar regimes de bens e decidir',
    phase: 'detalhes-e-papelaria', offsetDays: 150,
    condition: (f) => f.regime_bens === 'nao_sei' && f.civil !== 'ja_casados' }),
  // "Não sabemos" liga só a tarefa de pesquisa acima — pacto exige escolha explícita de outro regime.
  t({ key: 'documentacao.pacto-antenupcial', category: 'Documentação & Civil',
    label: 'Fazer pacto antenupcial no Tabelionato de Notas (antes da habilitação)',
    phase: 'detalhes-e-papelaria', offsetDays: 120,
    condition: (f) => f.regime_bens === 'outro' && f.civil !== 'ja_casados' }),
  t({ key: 'documentacao.certidao-nascimento', category: 'Documentação & Civil',
    label: 'Emitir certidão de nascimento atualizada (validade 90 dias)',
    phase: 'burocracia-e-confirmacoes', offsetDays: 90,
    condition: (f) => f.civil !== 'ja_casados' }),
  t({ key: 'documentacao.testemunhas', category: 'Documentação & Civil',
    label: 'Escolher 2 testemunhas (maiores e alfabetizadas) e reunir documentos delas',
    phase: 'burocracia-e-confirmacoes', offsetDays: 90,
    condition: (f) => f.civil !== 'ja_casados' }),
  t({ key: 'documentacao.habilitacao', category: 'Documentação & Civil',
    label: 'Dar entrada na habilitação do casamento no cartório',
    phase: 'burocracia-e-confirmacoes', offsetDays: 60,
    condition: (f) => f.civil !== 'ja_casados' }),
  t({ key: 'documentacao.proclamas', category: 'Documentação & Civil',
    label: 'Acompanhar publicação dos proclamas / retirar certidão de habilitação',
    phase: 'reta-final', offsetDays: 30,
    condition: (f) => f.civil !== 'ja_casados' }),
  // "Optou por efeito civil" é decidido na tarefa cerimonia.efeito-civil — sem essa resposta
  // no questionário, mostra por padrão para casais religiosos ainda não casados no civil.
  t({ key: 'documentacao.certidao-igreja', category: 'Documentação & Civil',
    label: 'Levar a certidão de habilitação à igreja (casamento com efeito civil)',
    phase: 'reta-final', offsetDays: 30,
    condition: (f) => isOrUnknown(f.cerimonia, 'catolica', 'outra_religiao') && f.civil !== 'ja_casados' }),
  t({ key: 'documentacao.confirmar-cartorio', category: 'Documentação & Civil',
    label: 'Confirmar data/horário da cerimônia no cartório',
    phase: 'reta-final', offsetDays: 30,
    condition: (f) => isOrUnknown(f.civil, 'cartorio') }),
  t({ key: 'documentacao.confirmar-diligencia', category: 'Documentação & Civil',
    label: 'Confirmar diligência do juiz de paz no local',
    phase: 'reta-final', offsetDays: 14,
    condition: (f) => isOrUnknown(f.civil, 'no_local') }),
  t({ key: 'documentacao.casar-exterior', category: 'Documentação & Civil',
    label: 'Verificar exigências legais para casar no exterior (ou casar no civil no Brasil antes)',
    phase: 'fornecedores-e-trajes', offsetDays: 240,
    condition: (f) => isOrUnknown(f.local, 'outro_pais') }),
]

// ── 4.11 Semana do Casamento (13 tarefas) ──

const SEMANA: CatalogTask[] = [
  t({ key: 'semana.reconfirmar-fornecedores', category: 'Semana do Casamento',
    label: 'Reconfirmar todos os fornecedores (horário, endereço, contato)',
    phase: 'semana-do-casamento', offsetDays: 7,
    condition: (f) => isOrUnknown(f.assessoria, 'nao', 'dia') }),
  t({ key: 'semana.reuniao-assessoria', category: 'Semana do Casamento',
    label: 'Reunião final de alinhamento com assessoria/cerimonial',
    phase: 'semana-do-casamento', offsetDays: 7,
    condition: (f) => isOrUnknown(f.assessoria, 'completa', 'dia') }),
  t({ key: 'semana.cronograma-fotografo', category: 'Semana do Casamento',
    label: 'Entregar cronograma do dia + lista de fotos ao fotógrafo',
    phase: 'semana-do-casamento', offsetDays: 7,
    condition: (f) => f.fornecedores.includes('fotografia') }),
  t({ key: 'semana.envelopes', category: 'Semana do Casamento',
    label: 'Separar envelopes de pagamento final e gorjetas',
    phase: 'semana-do-casamento', offsetDays: 7 }),
  t({ key: 'semana.kit-emergencia', category: 'Semana do Casamento',
    label: 'Montar kit emergência (costura, analgésico, absorvente, carregador...)',
    phase: 'semana-do-casamento', offsetDays: 7 }),
  // Doc: "Q17 = alugado ou ajustes finais" — na prática vale para qualquer origem de traje.
  t({ key: 'semana.retirar-trajes', category: 'Semana do Casamento',
    label: 'Retirar trajes (aluguel) / buscar traje na loja',
    phase: 'semana-do-casamento', offsetDays: 7 }),
  t({ key: 'semana.rotina-vespera', category: 'Semana do Casamento',
    label: 'Fazer unhas, cabelo, depilação, barba (rotina de véspera)',
    phase: 'semana-do-casamento', offsetDays: 2 }),
  t({ key: 'semana.ensaio-jantar', category: 'Semana do Casamento',
    label: 'Ensaio geral no local + jantar de ensaio',
    phase: 'semana-do-casamento', offsetDays: 2,
    condition: (f) => f.eventos.includes('jantar_ensaio') || f.cortejo.length > 0 }),
  t({ key: 'semana.suite-nupcias', category: 'Semana do Casamento',
    label: 'Check-in no hotel / preparar suíte da noite de núpcias',
    phase: 'semana-do-casamento', offsetDays: 1, dismissable: true }),
  t({ key: 'semana.viajar-destino', category: 'Semana do Casamento',
    label: 'Viajar para o destino (3–5 dias antes)',
    phase: 'semana-do-casamento', offsetDays: 4, condition: isDestination }),
  t({ key: 'semana.receber-convidados', category: 'Semana do Casamento',
    label: 'Receber convidados de fora / entregar welcome bags',
    phase: 'semana-do-casamento', offsetDays: 2, condition: isDestination }),
  t({ key: 'semana.itens-do-dia', category: 'Semana do Casamento',
    label: 'Conferir e separar itens do dia (alianças, votos, documentos, trocado)',
    phase: 'semana-do-casamento', offsetDays: 1 }),
  t({ key: 'semana.delegar-celular', category: 'Semana do Casamento',
    label: 'Delegar celular e contatos a uma pessoa de confiança',
    phase: 'semana-do-casamento', offsetDays: 1,
    condition: (f) => isOrUnknown(f.assessoria, 'nao') }),
]

// ── 4.12 Dia do Casamento (14 tarefas) ──

const DIA: CatalogTask[] = [
  t({ key: 'dia.cafe-manha', category: 'Dia do Casamento',
    label: 'Café da manhã reforçado + hidratação',
    phase: 'o-grande-dia', offsetDays: 0 }),
  t({ key: 'dia.making-of', category: 'Dia do Casamento',
    label: 'Making of (fotos da preparação)',
    phase: 'o-grande-dia', offsetDays: 0,
    condition: (f) => f.momentos.includes('making_of') }),
  t({ key: 'dia.first-look', category: 'Dia do Casamento',
    label: 'Sessão first look + fotos do casal antes da cerimônia',
    phase: 'o-grande-dia', offsetDays: 0,
    condition: (f) => f.momentos.includes('first_look') }),
  t({ key: 'dia.cronograma-beleza', category: 'Dia do Casamento',
    label: 'Seguir cronograma de beleza (cabelo/make com horário)',
    phase: 'o-grande-dia', offsetDays: 0,
    condition: (f) => f.fornecedores.includes('beleza') }),
  t({ key: 'dia.conferir-aliancas', category: 'Dia do Casamento',
    label: 'Conferir se alianças e votos estão com a pessoa certa',
    phase: 'o-grande-dia', offsetDays: 0 }),
  t({ key: 'dia.presentinho', category: 'Dia do Casamento',
    label: 'Entrega de presentinho/carta entre o casal',
    phase: 'o-grande-dia', offsetDays: 0, dismissable: true }),
  t({ key: 'dia.receber-fornecedores', category: 'Dia do Casamento',
    label: 'Receber fornecedores no local (ou delegar)',
    phase: 'o-grande-dia', offsetDays: 0,
    condition: (f) => isOrUnknown(f.assessoria, 'nao') }),
  t({ key: 'dia.coordenar-cortejo', category: 'Dia do Casamento',
    label: 'Coordenar entrada do cortejo',
    phase: 'o-grande-dia', offsetDays: 0,
    condition: (f) => f.cortejo.length > 0 }),
  t({ key: 'dia.reler-votos', category: 'Dia do Casamento',
    label: 'Reler os votos uma última vez',
    phase: 'o-grande-dia', offsetDays: 0,
    condition: (f) => f.momentos.includes('votos') }),
  t({ key: 'dia.fotos-pos-cerimonia', category: 'Dia do Casamento',
    label: 'Sessão de fotos pós-cerimônia (casal + famílias + padrinhos)',
    phase: 'o-grande-dia', offsetDays: 0,
    condition: (f) => f.fornecedores.includes('fotografia') }),
  t({ key: 'dia.momento-a-sos', category: 'Dia do Casamento',
    label: 'Momento a sós do casal antes de entrar na festa',
    phase: 'o-grande-dia', offsetDays: 0, dismissable: true }),
  t({ key: 'dia.rituais-festa', category: 'Dia do Casamento',
    label: 'Cumprir rituais da festa (brinde, bolo, buquê, primeira dança)',
    phase: 'o-grande-dia', offsetDays: 0,
    condition: (f) => isOrUnknown(f.recepcao, 'festa_pista') }),
  t({ key: 'dia.transporte-presentes', category: 'Dia do Casamento',
    label: 'Garantir transporte de presentes/itens pessoais no fim da noite',
    phase: 'o-grande-dia', offsetDays: 0,
    condition: (f) => isOrUnknown(f.assessoria, 'nao') }),
  // Doc: "se tarefa 4.4 'saída' não dispensada" — o vínculo é feito pelo casal dispensando
  // esta tarefa junto (não há referência entre tarefas no motor); por isso é dispensável.
  t({ key: 'dia.saida-noivos', category: 'Dia do Casamento',
    label: 'Saída dos noivos (pétalas/bolhas/velas)',
    phase: 'o-grande-dia', offsetDays: 0, dismissable: true }),
]

// ── 4.13 Pós-casamento (11 tarefas — "Avaliar fornecedores" vive no pipeline por fornecedor) ──

const POS: CatalogTask[] = [
  t({ key: 'pos.devolver-trajes', category: 'Pós-casamento',
    label: 'Devolver trajes alugados',
    phase: 'recem-casados', offsetDays: -3,
    condition: (f) => trajeIs(f, 'alugado') }),
  t({ key: 'pos.agradecimentos-convidados', category: 'Pós-casamento',
    label: 'Enviar lembranças/agradecimentos aos convidados',
    phase: 'recem-casados', offsetDays: -90, dismissable: true }),
  t({ key: 'pos.agradecimentos-padrinhos', category: 'Pós-casamento',
    label: 'Enviar agradecimentos aos padrinhos e fornecedores-chave',
    phase: 'recem-casados', offsetDays: -30,
    condition: (f) => f.cortejo.includes('padrinhos') }),
  t({ key: 'pos.certidao-casamento', category: 'Pós-casamento',
    label: 'Retirar a certidão de casamento no cartório',
    phase: 'recem-casados', offsetDays: -10,
    condition: (f) => f.civil !== 'ja_casados' }),
  // Ordem da troca de documentos: certidão → RG → CPF → CNH → título/passaporte (§1).
  t({ key: 'pos.atualizar-rg', category: 'Pós-casamento',
    label: 'Atualizar RG (primeiro da fila)',
    phase: 'recem-casados', offsetDays: -30,
    condition: (f) => isOrUnknown(f.alterar_sobrenome, 'sim') }),
  t({ key: 'pos.atualizar-cpf', category: 'Pós-casamento',
    label: 'Atualizar CPF (online, Receita Federal)',
    phase: 'recem-casados', offsetDays: -30,
    condition: (f) => isOrUnknown(f.alterar_sobrenome, 'sim') }),
  t({ key: 'pos.atualizar-cnh', category: 'Pós-casamento',
    label: 'Atualizar CNH no Detran (exige RG novo)',
    phase: 'recem-casados', offsetDays: -60,
    condition: (f) => isOrUnknown(f.alterar_sobrenome, 'sim') }),
  t({ key: 'pos.atualizar-outros', category: 'Pós-casamento',
    label: 'Atualizar título de eleitor, passaporte, banco, plano de saúde',
    phase: 'recem-casados', offsetDays: -90,
    condition: (f) => isOrUnknown(f.alterar_sobrenome, 'sim') }),
  t({ key: 'pos.preservar-traje-album', category: 'Pós-casamento',
    label: 'Preservar o traje / revelar álbum e backup das fotos',
    phase: 'recem-casados', offsetDays: -90,
    condition: (f) => trajeIs(f, 'pronto', 'sob_medida') || f.fornecedores.includes('fotografia') }),
  t({ key: 'pos.minimoon', category: 'Pós-casamento',
    label: 'Planejar a minimoon/lua de mel adiada',
    phase: 'recem-casados', offsetDays: null,
    condition: (f) => f.lua_de_mel === 'adiar' }),
]

// ── Catálogo completo ──

export const CHECKLIST_CATALOG: CatalogTask[] = [
  ...PLANEJAMENTO,
  ...ORCAMENTO,
  ...CONVIDADOS,
  ...CERIMONIA,
  ...FESTA,
  ...FORNECEDORES,
  ...TRAJES,
  ...PAPELARIA,
  ...LUA_DE_MEL,
  ...DOCUMENTACAO,
  ...SEMANA,
  ...DIA,
  ...POS,
]

/** Chaves das tarefas marcadas "(opcional, dispensável)" no doc — usadas pela UI do Checklist. */
export const DISMISSABLE_KEYS = new Set(
  CHECKLIST_CATALOG.filter((task) => task.dismissable).map((task) => task.key),
)
