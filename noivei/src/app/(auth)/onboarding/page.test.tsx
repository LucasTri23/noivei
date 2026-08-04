import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import OnboardingPage from './page'

// Mock mínimo do query builder do Supabase (thenable com select/eq/order
// encadeáveis) — o suficiente para as 4 consultas em paralelo da tela de planos
// (ver useEffect de billingPlans em page.tsx) resolverem com listas vazias, sem
// bater no Supabase de verdade.
interface MockQueryBuilder {
  select: () => MockQueryBuilder
  eq:     () => MockQueryBuilder
  order:  () => MockQueryBuilder
  then:   (
    onFulfilled: (value: { data: unknown[] }) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise<unknown>
}

vi.mock('@/lib/supabase/browser', () => {
  function createQueryBuilder(): MockQueryBuilder {
    const builder: MockQueryBuilder = {
      select: () => builder,
      eq:     () => builder,
      order:  () => builder,
      then:   (onFulfilled, onRejected) => Promise.resolve({ data: [] }).then(onFulfilled, onRejected),
    }
    return builder
  }

  return {
    createSupabaseBrowser: () => ({
      // Sem usuário logado no teste: o efeito de "já tem casamento?" não encontra
      // ninguém e não tenta redirecionar pro dashboard, deixando o wizard visível.
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(() => createQueryBuilder()),
    }),
  }
})

// A tela carrega a lista de cidades do IBGE via fetch global no mount — sem mock,
// o teste tentaria uma chamada de rede de verdade.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve([]) }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// Avança da etapa de nomes (passo 0) até a etapa de convidados (passo 5),
// clicando "Continuar" nas etapas intermediárias (data/cidade, orçamento, estilo,
// local) — nenhuma delas bloqueia o avanço.
async function goToGuestsStep(user: ReturnType<typeof userEvent.setup>) {
  for (let i = 0; i < 5; i++) {
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
  }
}

describe('OnboardingPage', () => {
  describe('rótulos acessíveis', () => {
    it('deve associar o label ao campo de nome da noiva e ao campo de nome do noivo', () => {
      render(<OnboardingPage />)

      expect(screen.getByLabelText('Nome da noiva')).toBeInTheDocument()
      expect(screen.getByLabelText('Nome do noivo')).toBeInTheDocument()
    })

    it('deve associar o label ao campo de cidade', async () => {
      const user = userEvent.setup()
      render(<OnboardingPage />)

      await user.click(screen.getByRole('button', { name: 'Continuar' }))

      expect(screen.getByLabelText('Em qual cidade?')).toBeInTheDocument()
    })

    it('deve associar o label ao campo de quantidade de convidados', async () => {
      const user = userEvent.setup()
      render(<OnboardingPage />)

      await goToGuestsStep(user)

      expect(screen.getByLabelText('Quantidade de convidados')).toBeInTheDocument()
    })
  })

  describe('validação da quantidade de convidados', () => {
    it('deve bloquear o avanço e exibir erro quando o valor for 0', async () => {
      const user = userEvent.setup()
      render(<OnboardingPage />)
      await goToGuestsStep(user)

      fireEvent.change(screen.getByLabelText('Quantidade de convidados'), { target: { value: '0' } })
      await user.click(screen.getByRole('button', { name: 'Continuar' }))

      expect(await screen.findByText('Informe uma quantidade entre 1 e 2.000 convidados.')).toBeInTheDocument()
      // Não avançou: o campo de convidados continua na tela.
      expect(screen.getByLabelText('Quantidade de convidados')).toBeInTheDocument()
    })

    it('deve bloquear o avanço e exibir erro quando o valor for negativo', async () => {
      const user = userEvent.setup()
      render(<OnboardingPage />)
      await goToGuestsStep(user)

      fireEvent.change(screen.getByLabelText('Quantidade de convidados'), { target: { value: '-5' } })
      await user.click(screen.getByRole('button', { name: 'Continuar' }))

      expect(await screen.findByText('Informe uma quantidade entre 1 e 2.000 convidados.')).toBeInTheDocument()
      expect(screen.getByLabelText('Quantidade de convidados')).toBeInTheDocument()
    })

    it('deve bloquear o avanço e exibir erro quando o valor exceder 2000', async () => {
      const user = userEvent.setup()
      render(<OnboardingPage />)
      await goToGuestsStep(user)

      fireEvent.change(screen.getByLabelText('Quantidade de convidados'), { target: { value: '2001' } })
      await user.click(screen.getByRole('button', { name: 'Continuar' }))

      expect(await screen.findByText('Informe uma quantidade entre 1 e 2.000 convidados.')).toBeInTheDocument()
      expect(screen.getByLabelText('Quantidade de convidados')).toBeInTheDocument()
    })

    it('deve permitir o avanço sem erro quando o valor for válido', async () => {
      const user = userEvent.setup()
      render(<OnboardingPage />)
      await goToGuestsStep(user)

      fireEvent.change(screen.getByLabelText('Quantidade de convidados'), { target: { value: '150' } })
      await user.click(screen.getByRole('button', { name: 'Continuar' }))

      expect(screen.queryByText('Informe uma quantidade entre 1 e 2.000 convidados.')).not.toBeInTheDocument()
      expect(await screen.findByText('Escolha seu plano')).toBeInTheDocument()
    })

    it('deve associar a mensagem de erro via aria-describedby e marcar role="alert"', async () => {
      const user = userEvent.setup()
      render(<OnboardingPage />)
      await goToGuestsStep(user)

      const input = screen.getByLabelText('Quantidade de convidados')
      fireEvent.change(input, { target: { value: '0' } })
      await user.click(screen.getByRole('button', { name: 'Continuar' }))

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Informe uma quantidade entre 1 e 2.000 convidados.')
      expect(input).toHaveAttribute('aria-describedby', alert.id)
      expect(input).toHaveAttribute('aria-invalid', 'true')
    })
  })
})
