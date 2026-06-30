# noivei — Convenções de Desenvolvimento

## Stack
- **Next.js 16** (App Router, Server/Client Components)
- **TypeScript** strict em todo o projeto
- **Tailwind CSS v4** (configurado via `globals.css`, sem `tailwind.config.ts`)
- **Supabase** (Auth, PostgreSQL, Storage, Realtime)
- **Zod** para validação de schemas
- **React Hook Form** + `@hookform/resolvers/zod` para formulários
- **Zustand** para estado global de UI
- **TanStack Query** para dados no cliente
- **Vitest** + **Testing Library** para testes

---

## Estrutura de Pastas

```
src/
├── app/                     # Next.js App Router
│   ├── (auth)/              # Grupo: rotas públicas de autenticação
│   ├── (app)/               # Grupo: rotas autenticadas
│   ├── (admin)/             # Grupo: rotas de administração
│   ├── [slug]/              # Site público do casal
│   ├── rsvp/[token]/        # RSVP público
│   └── api/v1/              # API Routes
├── components/
│   ├── ui/                  # Componentes base (shadcn + customizados)
│   ├── layout/              # Header, Sidebar, Footer
│   ├── auth/                # LoginForm, SignupForm, etc.
│   ├── dashboard/           # Widgets do dashboard
│   ├── checklist/           # Módulo checklist
│   ├── timeline/            # Módulo timeline
│   ├── guests/              # Módulo convidados
│   ├── financial/           # Módulo financeiro
│   ├── vendors/             # Módulo fornecedores
│   ├── tables/              # Módulo mesas
│   ├── site/                # Módulo site do casal
│   ├── billing/             # PaywallGate, PlanBadge, UpgradeModal
│   ├── onboarding/          # Wizard de onboarding
│   └── shared/              # Componentes reutilizáveis entre módulos
├── lib/
│   ├── supabase/            # server.ts, browser.ts, middleware.ts
│   ├── api/                 # guards, response helpers, validation schemas
│   ├── auth/                # require-auth, session utils
│   ├── billing/             # check-limit, apply-coupon, plan-utils
│   ├── theme/               # wedding-color.ts
│   ├── wedding-score/       # calculator.ts
│   ├── ai/                  # provider.ts, context-builder, tools (Fase 2)
│   ├── integrations/        # email/, payment/, posthog/
│   ├── security/            # sanitize.ts, ssrf-guard.ts
│   └── utils/               # cn.ts, date.ts, format.ts
├── hooks/                   # use-plan.ts, use-wedding.ts, use-auth.ts
├── store/                   # Zustand stores
├── types/                   # database.ts, index.ts
├── constants/               # plans.ts, flags.ts, routes.ts
├── styles/                  # Apenas se precisar de CSS adicional
└── tests/                   # setup.ts, factories/, helpers/
```

---

## Nomenclatura de Arquivos

| Tipo | Convenção | Exemplo |
|------|-----------|---------|
| Componente React | `kebab-case.tsx` | `checklist-item.tsx` |
| Page (App Router) | `page.tsx` | `page.tsx` |
| Layout | `layout.tsx` | `layout.tsx` |
| API Route | `route.ts` | `route.ts` |
| Hook | `use-kebab-case.ts` | `use-wedding.ts` |
| Lib / util | `kebab-case.ts` | `check-limit.ts` |
| Store Zustand | `kebab-case.store.ts` | `wedding.store.ts` |
| Schema Zod | `kebab-case.schema.ts` | `guest.schema.ts` |
| Teste | `nome.test.ts(x)` | `checklist-item.test.tsx` |
| Tipo | `kebab-case.ts` | `database.ts` |

---

## Nomenclatura de Componentes

```tsx
// PascalCase para o componente
export default function ChecklistItem({ ... }: ChecklistItemProps) {}

// Props sempre com sufixo Props
interface ChecklistItemProps {
  item:     ChecklistItem
  onToggle: (id: string, value: boolean) => void
}

// Exportações nomeadas para componentes secundários
export function ChecklistItemSkeleton() {}
export function ChecklistItemEmpty() {}

// Nunca default export em arquivos de lib/utils/hooks — apenas named exports
export function calcWeddingScore(...) {}   // ✓
export default function calcWeddingScore() {} // ✗
```

---

## Padrões para API Routes

```typescript
// app/api/v1/weddings/[wid]/checklist/route.ts

import { requireAuth }            from '@/lib/auth/require-auth'
import { requireWeddingOwnership } from '@/lib/api/guards/ownership'
import { CreateChecklistItemSchema } from '@/lib/api/validation/checklist.schema'
import { ok, err }                from '@/lib/api/response'
import { createSupabaseServer }   from '@/lib/supabase/server'

export async function POST(req: Request, { params }: { params: Promise<{ wid: string }> }) {
  // 1. Auth
  const { user } = await requireAuth(req)
  const supabase  = await createSupabaseServer()
  const { wid }   = await params

  // 2. Ownership
  await requireWeddingOwnership(supabase, wid, user.id)

  // 3. Validação
  const body   = await req.json()
  const parsed = CreateChecklistItemSchema.safeParse(body)
  if (!parsed.success) return err(400, 'VALIDATION_ERROR', 'Dados inválidos.', parsed.error.flatten())

  // 4. Lógica de negócio
  const { data, error } = await supabase
    .from('checklist_items')
    .insert({ ...parsed.data, wedding_id: wid })
    .select()
    .single()

  if (error) return err(500, 'DB_ERROR', 'Erro ao criar item.')

  // 5. Resposta
  return ok(data, undefined, 201)
}
```

**Regras:**
- Sempre: auth → ownership → validação → lógica → resposta
- Nunca expor stack trace — usar `err()` com `requestId`
- Nunca `any` no body — sempre Zod
- Rotas Premium/Exclusivo verificam plano antes da lógica

---

## Padrões para Hooks

```typescript
// hooks/use-checklist.ts
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import type { ChecklistItem }    from '@/types'

// Keys de query centralizadas no mesmo arquivo do hook
const keys = {
  all:  (wid: string) => ['checklist', wid]             as const,
  list: (wid: string) => ['checklist', wid, 'list']     as const,
}

export function useChecklist(weddingId: string) {
  const supabase = createSupabaseBrowser()

  return useQuery({
    queryKey: keys.list(weddingId),
    queryFn:  async () => {
      const { data, error } = await supabase
        .from('checklist_items')
        .select('*')
        .eq('wedding_id', weddingId)
        .order('sort_order')

      if (error) throw error
      return data as ChecklistItem[]
    },
  })
}

export function useToggleChecklistItem(weddingId: string) {
  const supabase     = createSupabaseBrowser()
  const queryClient  = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase
        .from('checklist_items')
        .update({ completed })
        .eq('id', id)

      if (error) throw error
    },
    // Optimistic update
    onMutate: async ({ id, completed }) => {
      await queryClient.cancelQueries({ queryKey: keys.list(weddingId) })
      const previous = queryClient.getQueryData(keys.list(weddingId))
      queryClient.setQueryData(keys.list(weddingId), (old: ChecklistItem[] = []) =>
        old.map((item) => item.id === id ? { ...item, completed } : item)
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      queryClient.setQueryData(keys.list(weddingId), ctx?.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.list(weddingId) }),
  })
}
```

**Regras:**
- Prefixo `use` obrigatório
- Query keys centralizadas no próprio arquivo como objeto `keys`
- Optimistic update em mutations de UI imediata
- `'use client'` explícito no topo

---

## Padrões para Services / Lib

```typescript
// lib/billing/check-limit.ts
// Funções puras, sem efeitos colaterais além do banco

import type { SupabaseClient } from '@supabase/supabase-js'
import type { PlanId }         from '@/constants/plans'

interface LimitCheck {
  allowed:  boolean
  current:  number
  limit:    number
}

export async function checkGuestLimit(
  supabase:  SupabaseClient,
  weddingId: string,
  planId:    PlanId,
): Promise<LimitCheck> {
  const [{ count: current }, { data: limitRow }] = await Promise.all([
    supabase.from('guests').select('*', { count: 'exact', head: true }).eq('wedding_id', weddingId),
    supabase.from('plan_limits').select('value').eq('plan_id', planId).eq('feature', 'max_guests').single(),
  ])

  const limit   = limitRow?.value ?? 100
  const allowed = (current ?? 0) < limit

  return { allowed, current: current ?? 0, limit }
}
```

**Regras:**
- Funções puras: recebem dependências como parâmetros (não importar diretamente)
- Sem side effects além da operação declarada
- Retornar tipos explícitos — nunca `any`
- Um arquivo por domínio de responsabilidade

---

## Padrões para Banco de Dados

**Migrations** em `supabase/migrations/`:
```
YYYYMMDDHHMMSS_descricao-em-kebab-case.sql
Exemplo: 20260630120000_create-checklist-items.sql
```

**Nomenclatura SQL:**
```sql
-- Tabelas: snake_case, plural
CREATE TABLE checklist_items (...);

-- Colunas: snake_case
user_id, wedding_id, created_at, updated_at

-- Índices: idx_tabela_coluna
CREATE INDEX idx_checklist_items_wedding_id ON checklist_items(wedding_id);

-- Funções: fn_descricao_do_que_faz
CREATE FUNCTION fn_on_user_created() ...

-- Triggers: trg_tabela_evento
CREATE TRIGGER trg_users_on_insert ...

-- Políticas RLS: descricao_legivel
CREATE POLICY "users can read own checklist" ON checklist_items ...
```

**Regras:**
- Toda tabela com `user_id` ou `wedding_id` DEVE ter RLS ativo
- Toda tabela tem `created_at TIMESTAMPTZ DEFAULT NOW()`
- Tabelas mutáveis têm `updated_at` com trigger de atualização automática
- Foreign keys sempre com `ON DELETE CASCADE` para dados filhos
- Soft delete: coluna `deleted_at TIMESTAMPTZ` + filtro `WHERE deleted_at IS NULL`
- Nunca deletar dado de usuário permanentemente antes dos 30 dias (LGPD)

---

## Convenções de Commits

Seguir **Conventional Commits**:

```
tipo(escopo): descrição curta em português

[corpo opcional]

[rodapé opcional]
```

| Tipo | Quando usar |
|------|------------|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `refactor` | Refatoração sem mudança de comportamento |
| `style` | Ajuste de estilo/formatação |
| `test` | Adição ou correção de testes |
| `docs` | Documentação |
| `chore` | Build, configs, dependências |
| `perf` | Melhoria de performance |
| `security` | Correção de segurança |

**Exemplos:**
```
feat(checklist): adicionar drag-and-drop para reordenar itens
fix(billing): corrigir cálculo de desconto percentual em cupons
test(rls): adicionar testes de isolamento para tabela guests
security(api): adicionar rate limiting nas rotas de autenticação
```

**Regras:**
- Descrição em português, imperativo, sem ponto final
- Escopo é o módulo afetado (checklist, billing, auth, guests, etc.)
- Breaking change: `feat!` ou `BREAKING CHANGE:` no rodapé
- Um commit por mudança lógica — não agrupar coisas não relacionadas

---

## Convenções para Testes

```typescript
// Estrutura obrigatória
describe('NomeDaFuncaoOuComponente', () => {
  describe('cenário ou método', () => {
    it('deve [comportamento esperado] quando [condição]', () => {
      // arrange
      // act
      // assert
    })
  })
})

// Exemplos de descrições:
it('deve retornar score 0 quando casamento recém-criado')
it('deve rejeitar token expirado com status 401')
it('deve exibir paywall para usuário Gratuito tentando acessar financeiro')
it('deve bloquear atualização de item de outro casamento via RLS')
```

**Arquivos de teste ficam ao lado do código:**
```
src/lib/billing/check-limit.ts
src/lib/billing/check-limit.test.ts      ← junto

src/components/checklist/checklist-item.tsx
src/components/checklist/checklist-item.test.tsx  ← junto
```

**Exceção:** Testes de RLS em `src/tests/rls/` e E2E em `src/tests/e2e/`.

---

## Padrões de Documentação

**Código:** sem comentários óbvios. Apenas quando o "porquê" não é evidente:

```typescript
// ✓ Comentário útil — explica uma restrição não óbvia
// RLS retorna array vazio (não erro) para não vazar existência do recurso
const { data } = await supabase.from('weddings').select(...)

// ✗ Comentário inútil — o código já diz isso
// Busca o casamento pelo ID
const wedding = await getWedding(id)
```

**JSDoc:** apenas em funções públicas de `lib/` com parâmetros não óbvios:

```typescript
/**
 * Calcula a data de expiração do plano único após o casamento.
 * Premium: +90 dias. Exclusivo: +180 dias.
 */
export function calcUniqueExpiry(weddingDate: Date, planId: PlanId): Date {}
```

**TODOs:** formato padronizado para rastreabilidade:
```typescript
// TODO Sprint 2: implementar tour guiado após onboarding
// TODO Fase 2: substituir por chamada real à IA
// FIXME: race condition possível se dois usuários editam ao mesmo tempo
```

---

## Utilitário `cn()`

Sempre usar `cn()` para classes Tailwind condicionais:

```typescript
// src/lib/utils/cn.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge }               from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Uso:
<div className={cn('base-class', condition && 'conditional-class', className)} />
```

---

## Variáveis de Ambiente

- `NEXT_PUBLIC_*` → seguro no browser (não colocar segredos)
- Sem prefixo → apenas server-side
- Nunca commitar `.env.local` — apenas `.env.example`
- Validar variáveis obrigatórias na inicialização:

```typescript
// src/lib/env.ts — validação em tempo de startup
const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']
required.forEach((key) => {
  if (!process.env[key]) throw new Error(`Variável de ambiente obrigatória ausente: ${key}`)
})
```
