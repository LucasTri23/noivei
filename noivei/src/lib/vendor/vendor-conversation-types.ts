// Shape devolvido por fn_list_vendor_conversations() (migration
// 20260807000002_add-vendor-conversation-unread-counts-fn.sql) — usado tanto pela
// API route (GET /api/v1/vendor-conversations) quanto por Server Components que
// chamam a mesma RPC diretamente (ver src/app/(app)/fornecedores/conversas/[id]/
// page.tsx e o equivalente do fornecedor), e pelo hook client useVendorConversations.
// Centralizado aqui em vez de um desses lugares importar o tipo dos outros.
export interface VendorConversationListItem {
  id:                          string
  viewer_role:                 'couple' | 'vendor'
  wedding_id:                  string
  wedding_couple_names:        string
  vendor_id:                   string
  vendor_business_name:        string
  vendor_slug:                 string
  first_message_at:            string | null
  last_message_at:             string | null
  last_message_body:           string | null
  last_message_sender_user_id: string | null
  unread_count:                number
}
