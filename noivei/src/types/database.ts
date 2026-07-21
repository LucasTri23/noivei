// Tipos manuais até rodar: supabase gen types typescript --local > src/types/supabase.ts
// Após ter o Supabase CLI configurado, substituir este arquivo pelo gerado.

// Placeholder para o tipo Database gerado pelo Supabase CLI
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type WeddingStyle =
  | 'rustico'
  | 'classico'
  | 'moderno'
  | 'boho'
  | 'minimalista'
  | 'romantico'
  | 'outro'

export type RSVPResponse = 'attending' | 'not_attending' | 'maybe' | 'pending'

export type GuestStatus = 'confirmado' | 'pendente' | 'recusado'

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'

export type VendorStatus =
  | 'pesquisando'
  | 'em_contato'
  | 'orcamento_recebido'
  | 'contratado'
  | 'pago'
  | 'cancelado'

export type PaymentDirection = 'expense' | 'income'

export type UserRole = 'user' | 'admin' | 'support'

export interface Wedding {
  id:             string
  user_id:        string
  couple_names:   string
  bride_name:     string | null
  groom_name:     string | null
  wedding_date:   string
  venue:          string | null
  city:           string | null
  guest_limit:    number
  budget:         number | null
  style:          WeddingStyle | null
  wedding_color:  string
  rsvp_message_template: string | null
  wedding_score:  number
  score_calculated_at: string | null
  is_active:      boolean
  deleted_at:     string | null
  created_at:     string
  updated_at:     string
}

export interface Guest {
  id:          string
  wedding_id:  string
  name:        string
  group_name:  string | null
  status:      GuestStatus
  rsvp_token:  string
  email:       string | null
  phone:       string | null
  created_at:  string
}

export interface ChecklistItem {
  id:           string
  wedding_id:   string
  label:        string
  category:     string | null
  phase:        string | null
  catalog_key:  string | null
  due_date:     string | null
  completed:    boolean
  is_dismissed: boolean
  is_archived:  boolean
  sort_order:   number
  created_at:   string
}

export interface WeddingPreferences {
  id:         string
  wedding_id: string
  answers:    Record<string, Json | undefined>
  created_at: string
  updated_at: string
}

export interface FinancialEntry {
  id:           string
  wedding_id:   string
  category:     string
  vendor:       string | null
  description:  string | null
  total_amount: number
  paid_amount:  number
  due_date:     string | null
  created_at:   string
}

export interface TableConfig {
  id:          string
  wedding_id:  string
  label:       string
  capacity:    number
  created_at:  string
}

export interface TableAssignment {
  id:          string
  table_id:    string
  guest_id:    string
  created_at:  string
}

export interface SiteConfig {
  id:              string
  wedding_id:      string
  slug:            string
  published:       boolean
  cover_photo_url: string | null
  content:         Record<string, Json | undefined>
  created_at:      string
}

export interface TimelineTask {
  id:          string
  wedding_id:  string
  title:       string
  description: string | null
  category:    string | null
  due_date:    string | null
  completed:   boolean
  vendor_id:   string | null
  sort_order:  number
  created_at:  string
}

export interface WeddingPayment {
  id:           string
  wedding_id:   string
  description:  string
  amount:       number
  category:     string | null
  direction:    PaymentDirection
  paid:         boolean
  paid_at:      string | null
  due_date:     string | null
  vendor_id:    string | null
  installment_number: number | null
  total_installments: number | null
  notes:        string | null
  created_at:   string
}

export interface WeddingVendor {
  id:           string
  wedding_id:   string
  name:         string
  category:     string
  contact_name: string | null
  email:        string | null
  phone:        string | null
  website:      string | null
  amount:       number | null
  status:       VendorStatus
  notes:        string | null
  created_at:   string
}

export interface WeddingTable {
  id:          string
  wedding_id:  string
  name:        string
  capacity:    number
  shape:       'round' | 'rectangular' | 'oval'
  notes:       string | null
  sort_order:  number
  created_at:  string
}

export interface GiftRegistryItem {
  id:           string
  wedding_id:   string
  name:         string
  description:  string | null
  price_cents:  number | null
  store_url:    string | null
  image_url:    string | null
  is_purchased: boolean
  purchased_by: string | null
  sort_order:   number
  created_at:   string
}

export interface WeddingSite {
  id:             string
  wedding_id:     string
  slug:           string
  published:      boolean
  cover_photo_url: string | null
  our_story:      string | null
  event_date:     string | null
  event_time:     string | null
  venue_name:     string | null
  venue_address:  string | null
  venue_maps_url: string | null
  rsvp_enabled:   boolean
  show_footer:    boolean
  custom_message: string | null
  created_at:     string
  updated_at:     string
}

export interface Subscription {
  id:              string
  user_id:         string
  plan_id:         string
  status:          SubscriptionStatus
  is_trial:        boolean
  trial_started_at: string | null
  trial_ends_at:   string | null
  current_period_start: string | null
  current_period_end:   string | null
  cancel_at_period_end: boolean
  gateway:         'stripe' | 'pagarme' | null
  gateway_sub_id:  string | null
  expires_at:      string | null
  created_at:      string
  updated_at:      string
}

export interface Profile {
  id:              string
  full_name:       string | null
  avatar_url:      string | null
  role:            UserRole
  notify_timeline: boolean
  notify_rsvp:     boolean
  created_at:      string
  updated_at:      string
}
