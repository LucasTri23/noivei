export const FLAGS = {
  // MVP — habilitados por padrão
  'global-search':         'Busca global',
  'dark-mode':             'Modo escuro',
  'guided-tour':           'Tour guiado pós-onboarding',
  'milestones-system':     'Sistema de marcos',
  'wedding-score':         'Wedding Score',

  // Premium
  'financial-module':      'Módulo financeiro (Premium)',
  'file-archive':          'Central de arquivos (Premium)',
  'rsvp-reminders':        'Lembretes de RSVP (Premium)',

  // Exclusivo
  'tables-module':         'Módulo de mesas (Exclusivo)',

  // A/B Tests
  'trial-no-credit-card':  'Trial sem cartão (A/B)',

  // Fase 2
  'ai-assistant':          'Assistente IA',
  'ai-rag':                'IA com RAG',
  'ai-tools':              'IA com Tools/MCP',
  'voice-input':           'Entrada por voz',

  // Fase 3
  'supplier-marketplace':  'Marketplace de fornecedores',
  'partner-program':       'Programa de parceiros (cerimonialistas)',

  // Infra
  'maintenance-mode':      'Modo manutenção',
  'new-onboarding':        'Novo onboarding (experimento)',
} as const

export type FeatureFlag = keyof typeof FLAGS
