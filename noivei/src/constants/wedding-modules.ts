import type { WeddingModuleKey } from '@/types/database'

// Rótulos amigáveis dos módulos restringíveis por membro — usados tanto na tela de
// gestão de membros (seletor de papel/edição de permissões) quanto na tela de
// bloqueio por permissão (ModuleAccessGate). Centralizado aqui para as duas telas
// não divergirem o texto exibido ao usuário.
export const WEDDING_MODULE_LABELS: Record<WeddingModuleKey, string> = {
  checklist:  'Checklist & Timeline',
  convidados: 'Convidados',
  financeiro: 'Financeiro',
  mesas:      'Mesas',
  site:       'Site do casal',
  arquivos:   'Central de arquivos',
  presentes:  'Lista de presentes',
  padrinhos:  'Padrinhos & Entradas',
}
