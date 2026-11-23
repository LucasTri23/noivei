import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TemplatePicker } from './site-builder'

beforeEach(() => vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true }))))
afterEach(() => vi.unstubAllGlobals())

describe('seletor de estilos', () => {
  it.each([
    ['free', ['Clássico', 'Fotográfico']],
    ['premium_monthly', ['Clássico', 'Fotográfico', 'Portfólio', 'Editorial', 'Jardim Romântico']],
    ['premium_plus_once', ['Clássico', 'Fotográfico', 'Portfólio', 'Editorial', 'Jardim Romântico', 'Convite Selado', 'Envelopado']],
  ] as const)('exibe os estilos do plano %s', (planId, names) => {
    render(<TemplatePicker value="classic" planId={planId} onChange={vi.fn()} />)
    expect(screen.getAllByRole('button')).toHaveLength(names.length)
    for (const name of names) expect(screen.getByRole('button', { name: new RegExp('^' + name) })).toBeVisible()
  })

  it('permite selecionar o Envelopado no Exclusivo', () => {
    const change = vi.fn()
    render(<TemplatePicker value="classic" planId="premium_plus_once" onChange={change} />)
    fireEvent.click(screen.getByRole('button', { name: /^Envelopado/ }))
    expect(change).toHaveBeenCalledWith('enveloped')
  })
})
