export type * from './database'

// Resposta padrão de API
export interface APIResponse<T = unknown> {
  data?: T
  error?: APIError
  meta?: APIMeta
}

export interface APIError {
  code:      string
  message:   string
  requestId: string
  details?:  unknown
}

export interface APIMeta {
  page?:     number
  pageSize?: number
  total?:    number
  hasMore?:  boolean
}

// Utilitários de tipo
export type Nullable<T> = T | null
export type Optional<T> = T | undefined
export type WithId<T> = T & { id: string }
export type WithTimestamps<T> = T & { created_at: string; updated_at: string }
