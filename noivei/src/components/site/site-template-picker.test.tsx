import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TemplatePicker } from './site-builder'

beforeEach(() => vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true }))))
afterEach(() => vi.unstubAllGlobals())
describe('seletor de estilos', () => {
  it('oculta os novos estilos fora do Exclusivo', () => {
    render(<TemplatePicker value="classic" albumEnabled={true} exclusiveTemplatesEnabled={false} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Clássico/ })).toBeVisible()
    for (const name of ['Editorial', 'Jardim Romântico', 'Convite Selado']) expect(screen.queryByRole('button', { name: new RegExp(name) })).not.toBeInTheDocument()
  })
  it('exibe e permite selecionar Convite Selado no Exclusivo', () => {
    const change = vi.fn()
    render(<TemplatePicker value="classic" albumEnabled={true} exclusiveTemplatesEnabled={true} onChange={change} />)
    expect(screen.getByRole('button', { name: /Jardim Romântico/ })).toBeVisible()
    expect(screen.getByRole('button', { name: /^Editorial/ })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: /Convite Selado/ }))
    expect(change).toHaveBeenCalledWith('invitation')
  })
})
