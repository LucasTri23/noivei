import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import WeddingDataForm from './wedding-data-form'

// Mock mínimo do query builder do Supabase — o suficiente pro
// `.from('weddings').update(...).eq(...)` de saveWedding resolver sem bater no
// Supabase de verdade. Mesmo padrão de mock usado em
// src/app/(auth)/onboarding/page.test.tsx.
vi.mock('@/lib/supabase/browser', () => ({
  createSupabaseBrowser: () => ({
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    })),
  }),
}))

// recalculateChecklistDueDates faz suas próprias queries a partir do client
// Supabase mockado acima — não é o alvo deste teste (o comportamento do
// componente é o alvo), então é isolado com um mock direto.
vi.mock('@/lib/checklist/generate', () => ({
  recalculateChecklistDueDates: vi.fn().mockResolvedValue({ total: 0, updated: 0 }),
}))

// Data bem no futuro de propósito — os testes de limite por contagem não devem
// ser afetados pela trava de "data já passou" (testada em separado abaixo).
const baseInitial = {
  bride_name:   'Maria',
  groom_name:   'João',
  wedding_date: '2099-08-04',
  venue:        'Espaço Jardim das Flores',
  city:         'Campinas - SP',
  budget:       500_000,
  style:        'rustico' as const,
  rsvp_message_template: null,
}

function renderForm(weddingDateChangedCount: number, weddingDate = baseInitial.wedding_date) {
  return render(
    <WeddingDataForm
      weddingId="w1"
      initial={{ ...baseInitial, wedding_date: weddingDate, wedding_date_changed_count: weddingDateChangedCount }}
    />,
  )
}

describe('WeddingDataForm', () => {
  describe('limite de alterações da data do casamento', () => {
    it('deve desabilitar o campo de data e exibir o aviso de limite quando wedding_date_changed_count >= 3', () => {
      renderForm(3)

      const dateField = screen.getByLabelText('Data do casamento')
      expect(dateField).toBeDisabled()
      expect(
        screen.getByText('Você já usou as 3 alterações permitidas para a data do casamento.'),
      ).toBeInTheDocument()
    })

    it('deve exibir o contador de alterações usadas quando o limite ainda não foi atingido', () => {
      renderForm(1)

      expect(screen.getByText('Alterações usadas: 1 de 3')).toBeInTheDocument()
      expect(screen.getByLabelText('Data do casamento')).not.toBeDisabled()
    })

    it('deve mostrar o modal de confirmação ao salvar quando wedding_date_changed_count === 2 e a data foi alterada', async () => {
      const user = userEvent.setup()
      renderForm(2)

      // Abre o calendário e escolhe um dia diferente do inicial (2026-08-04) —
      // o calendário abre no mês da data selecionada, então "20" está sempre
      // visível na grade.
      await user.click(screen.getByLabelText('Data do casamento'))
      await user.click(screen.getByRole('button', { name: '20' }))

      await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

      expect(await screen.findByRole('heading', { name: 'Última alteração de data' })).toBeInTheDocument()
      expect(
        screen.getByText(
          'Esta será sua última alteração possível para a data do casamento. Depois de confirmar, você não poderá mais alterá-la. Deseja continuar?',
        ),
      ).toBeInTheDocument()
    })

    it('não deve mostrar o modal de confirmação quando outro campo muda mas a data permanece igual', async () => {
      const user = userEvent.setup()
      renderForm(2)

      const venueField = screen.getByLabelText('Local (se já decidiu)')
      await user.clear(venueField)
      await user.type(venueField, 'Novo local do casamento')

      await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

      expect(screen.queryByRole('heading', { name: 'Última alteração de data' })).not.toBeInTheDocument()
    })
  })

  describe('trava de data do casamento já passada', () => {
    it('deve desabilitar o campo de data e exibir aviso específico quando a data já passou, mesmo com contagem zerada', () => {
      renderForm(0, '2020-01-01')

      const dateField = screen.getByLabelText('Data do casamento')
      expect(dateField).toBeDisabled()
      expect(
        screen.getByText('A data do casamento já passou e não pode mais ser alterada.'),
      ).toBeInTheDocument()
    })
  })
})
