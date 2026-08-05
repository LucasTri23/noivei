import { readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { APP_ROUTE_PREFIXES } from '@/constants/routes'

// SEC-012: o middleware (src/middleware.ts) trata qualquer pathname que não bata
// com PUBLIC_ROUTES nem com APP_ROUTE_PREFIXES como sendo /[slug] (site público do
// casal) e libera SEM login — isso é fail-OPEN por construção, porque /[slug] é uma
// rota dinâmica de verdade e não dá pra listar todo slug possível.
//
// Não dá pra inverter essa lógica pra "fail-closed por padrão" sem quebrar o site
// público de todo casamento. A proteção real contra o risco descrito na auditoria
// (uma rota autenticada nova, criada em src/app/(app)/, esquecida de
// APP_ROUTE_PREFIXES, ficando pública por acidente) é ESTE teste: se ele quebrar,
// é sinal de que alguém adicionou uma pasta nova em src/app/(app)/ sem adicionar o
// prefixo correspondente em APP_ROUTE_PREFIXES — precisa ser corrigido em
// src/constants/routes.ts ANTES do deploy, senão a rota nova vira pública sem login.
describe('middleware — APP_ROUTE_PREFIXES cobre todas as rotas autenticadas reais', () => {
  it('deve ter um prefixo em APP_ROUTE_PREFIXES para cada pasta de primeiro nível em src/app/(app)/', () => {
    const appGroupDir = join(process.cwd(), 'src', 'app', '(app)')

    const realAppFolders = readdirSync(appGroupDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()

    const knownPrefixNames = APP_ROUTE_PREFIXES.map((prefix) => prefix.replace(/^\//, '')).sort()

    const missingFromPrefixes = realAppFolders.filter((folder) => !knownPrefixNames.includes(folder))

    expect(missingFromPrefixes).toEqual([])
  })
})
