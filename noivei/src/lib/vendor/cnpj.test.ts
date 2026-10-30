import { describe, expect, it } from 'vitest'
import { isCnpj, normalizeCnpj } from './cnpj'
import { CreateVendorProfileSchema, UpdateVendorProfileSchema } from '@/lib/api/validation/vendor.schema'

describe('CNPJ obrigatório na solicitação', () => {
  it('exige CNPJ ao criar e impede apagar o documento em edição', () => {
    expect(CreateVendorProfileSchema.safeParse({ business_name: 'Empresa' }).success).toBe(false)
    expect(UpdateVendorProfileSchema.safeParse({ cnpj: '' }).success).toBe(false)
    expect(UpdateVendorProfileSchema.safeParse({ description: 'Nova descrição' }).success).toBe(true)
  })
  it('normaliza máscara e aceita os formatos numérico e alfanumérico', () => {
    expect(normalizeCnpj('11.222.333/0001-81')).toBe('11222333000181')
    expect(isCnpj('11.222.333/0001-81')).toBe(true)
    expect(isCnpj('AB.CDE.FGH/0001-12')).toBe(true)
    expect(isCnpj('')).toBe(false)
    expect(isCnpj('123')).toBe(false)
    expect(isCnpj('123456789012AB')).toBe(false)
    expect(isCnpj('11!222333000181')).toBe(false)
  })
})
