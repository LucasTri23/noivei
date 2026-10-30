import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
vi.mock('@/hooks/use-vendor-conversations', () => ({ useVendorConversations: vi.fn() }))
import { useVendorConversations } from '@/hooks/use-vendor-conversations'
import VendorConversationsList from './vendor-conversations-list'
const rows = [
 { id: '1', vendor_business_name: 'Fotografia Luz', vendor_slug: 'luz', unread_count: 2, last_message_body: 'Vamos conversar', last_message_sender_user_id: 'other', last_message_at: null },
 { id: '2', vendor_business_name: 'Buffet Sabor', vendor_slug: 'sabor', unread_count: 0, last_message_body: 'Orçamento enviado', last_message_sender_user_id: 'me', last_message_at: null },
]
function setup() {
  vi.mocked(useVendorConversations).mockReturnValue({ data: rows, isLoading: false, isError: false } as never)
  render(<VendorConversationsList as="couple" basePath="/fornecedores/conversas" currentUserId="me" emptyTitle="Nenhuma conversa" emptyBody="Inicie uma conversa" />)
}
describe('caixa de entrada', () => {
  it('mostra os contatos, última mensagem e link para a conversa', () => {
    setup()
    expect(screen.getByText('Fotografia Luz')).toBeVisible()
    expect(screen.getByText('Você: Orçamento enviado')).toBeVisible()
    expect(screen.getByRole('link', { name: /Fotografia Luz/ })).toHaveAttribute('href', '/fornecedores/conversas/1')
  })
  it('permite buscar por contato e filtrar mensagens não lidas', () => {
    setup()
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar conversa' }), { target: { value: 'buffet' } })
    expect(screen.queryByText('Fotografia Luz')).not.toBeInTheDocument()
    expect(screen.getByText('Buffet Sabor')).toBeVisible()
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar conversa' }), { target: { value: '' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Somente não lidas' }))
    expect(screen.getByText('Fotografia Luz')).toBeVisible()
    expect(screen.queryByText('Buffet Sabor')).not.toBeInTheDocument()
  })
})
