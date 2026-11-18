import type {
  ChecklistItem,
  FinancialCategoryBudget,
  FinancialEntry,
  FinancialInstallment,
  FinancialQuote,
  GiftRegistryItem,
  Guest,
  Profile,
  SiteConfig,
  SiteStoryMoment,
  SiteStoryPhoto,
  Subscription,
  TableConfig,
  Wedding,
  WeddingGalleryPhotoPurpose,
  WeddingInvite,
  WeddingMember,
  WeddingPartyEntry,
  WeddingPreferences,
} from '@/types/database'

// Metadados de arquivo/foto exportados — nunca o conteúdo binário nem um link assinado
// pro Storage (LGPD art. 18 pede os dados, não um jeito de baixar os arquivos originais
// por aqui; quem quer o arquivo em si já tem a Central de Arquivos/Galeria pra isso).
export interface ExportedFileMeta {
  id:          string
  file_name:   string
  size_bytes:  number
  mime_type:   string | null
  uploaded_by: string
  created_at:  string
}

export interface ExportedGalleryPhotoMeta {
  id:          string
  size_bytes:  number
  mime_type:   string | null
  purpose:     WeddingGalleryPhotoPurpose
  uploaded_by: string
  created_at:  string
}

export interface ExportedTableAssignment {
  id:         string
  table_id:   string
  guest_id:   string
  created_at: string
}

export interface ExportPayload {
  exported_at: string
  wedding:     Wedding | null
  profile:     Profile | null
  subscription: Subscription | null
  guests:      Guest[]
  checklist_items: ChecklistItem[]
  financial: {
    entries:           FinancialEntry[]
    quotes:            FinancialQuote[]
    installments:      FinancialInstallment[]
    category_budgets:  FinancialCategoryBudget[]
  }
  gift_registry: GiftRegistryItem[]
  wedding_party: WeddingPartyEntry[]
  tables: {
    config:      TableConfig[]
    assignments: ExportedTableAssignment[]
  }
  site_config: SiteConfig | null
  files:          ExportedFileMeta[]
  gallery_photos: ExportedGalleryPhotoMeta[]
  site_story: {
    moments: SiteStoryMoment[]
    photos:  SiteStoryPhoto[]
  }
  preferences: WeddingPreferences | null
  members:     WeddingMember[]
  invites_sent: WeddingInvite[]
}
