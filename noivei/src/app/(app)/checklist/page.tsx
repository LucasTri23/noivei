'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { CHECKLIST_CATEGORIES } from '@/lib/checklist/catalog'
import { generateFreeChecklistItems } from '@/lib/checklist/generate-free'
import { isPaidPlan, type PlanId } from '@/constants/plans'
import DatePicker from '@/components/ui/date-picker'
import Modal from '@/components/ui/modal'
import type { ChecklistItem } from '@/types/database'

type Filter = 'todas' | 'pendentes' | 'concluidas'

const FILTER_LABELS: Record<Filter, string> = {
  todas:      'Todas',
  pendentes:  'Pendentes',
  concluidas: 'Concluídas',
}

const FALLBACK_CATEGORY = 'Outras tarefas'
const CATEGORY_OPTIONS  = [...CHECKLIST_CATEGORIES, FALLBACK_CATEGORY] as const

// Tarefas avulsas ficam depois das geradas pelo catálogo dentro da categoria
const MANUAL_SORT_ORDER = 9999

const ManualTaskSchema = z.object({
  label:    z.string().trim().min(1, 'Informe o título da tarefa.').max(200, 'O título pode ter no máximo 200 caracteres.'),
  category: z.enum(CATEGORY_OPTIONS),
  due_date: z.iso.date().nullable(),
})

const fieldLabelStyle: React.CSSProperties = {
  display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--fg)', marginBottom: '6px',
}

const fieldInputStyle: React.CSSProperties = {
  width: '100%', border: '1.5px solid #EBDDD0', borderRadius: '12px', padding: '12px 14px',
  fontSize: '15px', background: 'var(--surface)', color: 'var(--fg)', outline: 'none',
}

function PlusIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
function ClockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  )
}
function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  )
}
function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  )
}
function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.18s' }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function formatDue(dueDate: string | null): string | null {
  if (!dueDate) return null
  const [y, m, d] = dueDate.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ChecklistPage() {
  const router = useRouter()
  const [filter, setFilter]         = useState<Filter>('todas')
  const [loading, setLoading]       = useState(true)
  const [items, setItems]           = useState<ChecklistItem[]>([])
  const [weddingId, setWeddingId]   = useState<string | null>(null)
  const [planId, setPlanId]         = useState<PlanId>('free')
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')

  // Formulário de tarefa avulsa (catalog_key = null)
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [editingItem, setEditingItem]     = useState<ChecklistItem | null>(null)
  const [formLabel, setFormLabel]         = useState('')
  const [formCategory, setFormCategory]   = useState<string>(FALLBACK_CATEGORY)
  const [formDueDate, setFormDueDate]     = useState('')
  const [formError, setFormError]         = useState('')
  const [saving, setSaving]               = useState(false)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())

  function toggleCategory(title: string) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return next
    })
  }

  useEffect(() => {
    let cancelled = false
    const supabase = createSupabaseBrowser()

    async function load() {
      const { data: wedding } = await supabase
        .from('weddings')
        .select('id')
        .is('deleted_at', null)
        .order('created_at')
        .limit(1)
        .maybeSingle()

      if (!wedding) {
        if (!cancelled) setLoading(false)
        return
      }

      // Plano ativo decide a ação do estado vazio (mesmo padrão do (app)/layout.tsx):
      // Gratuito gera a checklist fixa aqui; pago vai para /checklist/personalizar.
      const { data: { user } } = await supabase.auth.getUser()
      const { data: subscription } = user
        ? await supabase
            .from('subscriptions')
            .select('plan_id')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        : { data: null }

      const { data } = await supabase
        .from('checklist_items')
        .select('*')
        .eq('wedding_id', wedding.id)
        .eq('is_archived', false)
        .eq('is_dismissed', false)
        .order('sort_order')

      if (!cancelled) {
        setWeddingId(wedding.id as string)
        setPlanId(((subscription?.plan_id as string | undefined) ?? 'free') as PlanId)
        setItems((data ?? []) as ChecklistItem[])
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  async function start() {
    if (!weddingId) return

    if (isPaidPlan(planId)) {
      router.push('/checklist/personalizar')
      return
    }

    setGenerating(true)
    setGenerateError('')
    const supabase = createSupabaseBrowser()

    try {
      await generateFreeChecklistItems(supabase, weddingId)
      const { data } = await supabase
        .from('checklist_items')
        .select('*')
        .eq('wedding_id', weddingId)
        .eq('is_archived', false)
        .eq('is_dismissed', false)
        .order('sort_order')
      setItems((data ?? []) as ChecklistItem[])
    } catch {
      setGenerateError('Não foi possível gerar o checklist. Tente novamente.')
    } finally {
      setGenerating(false)
    }
  }

  const total = items.length
  const done  = items.filter((i) => i.completed).length
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0

  // Agrupa por categoria na ordem do catálogo; categorias fora do catálogo (tarefas avulsas) vão para o fim
  const groups = useMemo(() => {
    const known = CHECKLIST_CATEGORIES.filter((cat) => items.some((i) => i.category === cat))
    const extra = [...new Set(items.map((i) => i.category ?? 'Outras tarefas'))]
      .filter((cat) => !(CHECKLIST_CATEGORIES as readonly string[]).includes(cat))
    return [...known, ...extra].map((cat) => ({
      title: cat,
      items: items.filter((i) => (i.category ?? 'Outras tarefas') === cat),
    }))
  }, [items])

  async function toggle(item: ChecklistItem) {
    const completed = !item.completed
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, completed } : i)))

    const supabase = createSupabaseBrowser()
    const { error } = await supabase.from('checklist_items').update({ completed }).eq('id', item.id)
    if (error) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, completed: !completed } : i)))
    }
  }

  async function dismiss(item: ChecklistItem) {
    const previous = items
    setItems((prev) => prev.filter((i) => i.id !== item.id))

    const supabase = createSupabaseBrowser()
    const { error } = await supabase.from('checklist_items').update({ is_dismissed: true }).eq('id', item.id)
    if (error) setItems(previous)
  }

  function openCreateTask() {
    setEditingItem(null)
    setFormLabel('')
    setFormCategory(FALLBACK_CATEGORY)
    setFormDueDate('')
    setFormError('')
    setTaskModalOpen(true)
  }

  function openEditTask(item: ChecklistItem) {
    setEditingItem(item)
    setFormLabel(item.label)
    setFormCategory(
      (CATEGORY_OPTIONS as readonly string[]).includes(item.category ?? '')
        ? (item.category as string)
        : FALLBACK_CATEGORY,
    )
    setFormDueDate(item.due_date ?? '')
    setFormError('')
    setTaskModalOpen(true)
  }

  async function saveTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!weddingId || saving) return

    const parsed = ManualTaskSchema.safeParse({
      label:    formLabel,
      category: formCategory,
      due_date: formDueDate === '' ? null : formDueDate,
    })
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Dados inválidos.')
      return
    }

    setSaving(true)
    setFormError('')
    const supabase = createSupabaseBrowser()

    if (editingItem) {
      const { data, error } = await supabase
        .from('checklist_items')
        .update({ label: parsed.data.label, category: parsed.data.category, due_date: parsed.data.due_date })
        .eq('id', editingItem.id)
        .select()
        .single()

      setSaving(false)
      if (error || !data) {
        setFormError('Não foi possível salvar a tarefa. Tente novamente.')
        return
      }
      setItems((prev) => prev.map((i) => (i.id === editingItem.id ? (data as ChecklistItem) : i)))
    } else {
      const { data, error } = await supabase
        .from('checklist_items')
        .insert({
          wedding_id:  weddingId,
          label:       parsed.data.label,
          category:    parsed.data.category,
          due_date:    parsed.data.due_date,
          catalog_key: null,
          phase:       null,
          sort_order:  MANUAL_SORT_ORDER,
        })
        .select()
        .single()

      setSaving(false)
      if (error || !data) {
        setFormError('Não foi possível criar a tarefa. Tente novamente.')
        return
      }
      setItems((prev) => [...prev, data as ChecklistItem])
    }

    setTaskModalOpen(false)
  }

  async function removeManualTask(item: ChecklistItem) {
    if (item.catalog_key !== null) return
    const previous = items
    setItems((prev) => prev.filter((i) => i.id !== item.id))

    const supabase = createSupabaseBrowser()
    const { error } = await supabase.from('checklist_items').delete().eq('id', item.id)
    if (error) setItems(previous)
  }

  function filterItem(item: ChecklistItem) {
    if (filter === 'pendentes') return !item.completed
    if (filter === 'concluidas') return item.completed
    return true
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            className="font-display"
            style={{ fontWeight: 500, fontSize: 'clamp(30px,4.2vw,42px)', lineHeight: 1.05, color: 'var(--fg)' }}
          >
            Checklist
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--muted-fg)', marginTop: '4px' }}>
            {done} de {total} tarefas concluídas
          </p>
        </div>
        <button
          onClick={openCreateTask}
          disabled={!weddingId}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'var(--wedding-color)', color: '#fff', border: 'none',
            borderRadius: '12px', padding: '11px 18px',
            fontWeight: 600, fontSize: '14px',
            cursor: weddingId ? 'pointer' : 'not-allowed', opacity: weddingId ? 1 : 0.6,
            boxShadow: '0 6px 16px color-mix(in srgb, var(--wedding-color) 32%, transparent)',
          }}
        >
          <PlusIcon /> Adicionar tarefa
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-6 rounded-2xl bg-[var(--surface)] p-5" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.07)' }}>
        <div className="mb-2 flex items-center justify-between">
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--fg)' }}>Progresso geral</span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--wedding-color)' }}>{pct}%</span>
        </div>
        <div style={{ height: '10px', borderRadius: '99px', background: '#EBDDD0', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%', borderRadius: '99px',
              background: 'linear-gradient(90deg, var(--wedding-color-light), var(--wedding-color-dark))',
              width: `${pct}%`, transition: 'width 0.4s ease',
            }}
          />
        </div>
      </div>

      {/* Filter pills */}
      <div className="mb-6 flex gap-2">
        {(['todas', 'pendentes', 'concluidas'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '7px 16px', borderRadius: '99px', fontSize: '13.5px',
              fontWeight: 600, cursor: 'pointer', border: 'none',
              background: filter === f ? 'var(--wedding-color)' : 'var(--wedding-color-subtle)',
              color: filter === f ? '#fff' : '#9A7A60',
              transition: 'all 0.18s',
            }}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Groups */}
      <div className="flex flex-col gap-5">
        {loading && (
          <div
            className="rounded-2xl bg-[var(--surface)] p-10 text-center"
            style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)', color: 'var(--muted-fg)', fontSize: '14px' }}
          >
            Carregando seu checklist…
          </div>
        )}
        {!loading && groups.length === 0 && !weddingId && (
          <div
            className="rounded-2xl bg-[var(--surface)] p-10 text-center"
            style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)', color: 'var(--muted-fg)', fontSize: '14px' }}
          >
            Nenhuma tarefa ainda. Complete o onboarding para criar o espaço do casal.
          </div>
        )}
        {!loading && groups.length === 0 && weddingId && (
          <div
            className="rounded-2xl bg-[var(--surface)] p-10 text-center"
            style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)' }}
          >
            <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--fg)', margin: '0 0 6px' }}>
              Seu checklist ainda não foi gerado
            </p>
            <p style={{ fontSize: '13.5px', color: 'var(--muted-fg)', margin: '0 0 20px' }}>
              {isPaidPlan(planId)
                ? 'Responda 6 etapas rápidas para gerarmos o checklist personalizado do casal.'
                : 'Gere agora a lista com as tarefas essenciais de todo casamento.'}
            </p>
            <button
              onClick={start}
              disabled={generating}
              style={{
                background: 'var(--wedding-color)', color: '#fff', border: 'none',
                borderRadius: '12px', padding: '13px 32px', fontWeight: 600, fontSize: '14.5px',
                cursor: generating ? 'not-allowed' : 'pointer', opacity: generating ? 0.7 : 1,
                boxShadow: '0 8px 20px color-mix(in srgb, var(--wedding-color) 28%, transparent)',
              }}
            >
              {generating ? 'Gerando…' : 'Começar'}
            </button>
            {generateError && (
              <p style={{ fontSize: '13px', color: '#C0553F', marginTop: '14px' }}>{generateError}</p>
            )}
          </div>
        )}
        {groups.map((group) => {
          const visible = group.items.filter(filterItem)
          if (visible.length === 0) return null
          const groupDone = group.items.filter((i) => i.completed).length
          const isCollapsed = collapsedCategories.has(group.title)
          return (
            <div key={group.title} className="rounded-2xl bg-[var(--surface)] overflow-hidden" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)' }}>
              <button
                type="button"
                onClick={() => toggleCategory(group.title)}
                aria-expanded={!isCollapsed}
                className="flex w-full items-center justify-between px-5 py-4"
                style={{
                  borderBottom: isCollapsed ? 'none' : '1px solid #F3EAE0',
                  background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span className="flex items-center gap-2">
                  <span style={{ color: 'var(--muted-fg)', display: 'flex' }}>
                    <ChevronIcon collapsed={isCollapsed} />
                  </span>
                  <span className="font-display" style={{ fontSize: '20px', fontWeight: 500, color: 'var(--fg)' }}>
                    {group.title}
                  </span>
                </span>
                <span style={{
                  fontSize: '12px', fontWeight: 600, padding: '3px 10px',
                  borderRadius: '99px', background: '#F1E6D4', color: 'var(--wedding-color-dark)',
                }}>
                  {groupDone}/{group.items.length}
                </span>
              </button>
              {!isCollapsed && (
              <div>
                {visible.map((item, idx) => {
                  const isDone = item.completed
                  const due = formatDue(item.due_date)
                  return (
                    <div
                      key={item.id}
                      className="group flex items-center gap-4 px-5 py-4 cursor-pointer"
                      style={{
                        borderBottom: idx < visible.length - 1 ? '1px solid #F8F3EE' : 'none',
                        transition: 'background 0.15s',
                      }}
                      onClick={() => toggle(item)}
                    >
                      {/* Checkbox */}
                      <div
                        style={{
                          width: '22px', height: '22px', borderRadius: '6px',
                          border: isDone ? 'none' : '2px solid #D8C6A6',
                          background: isDone ? 'var(--wedding-color)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, transition: 'all 0.18s',
                        }}
                      >
                        {isDone && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                      {/* Label */}
                      <span style={{
                        flex: 1, fontSize: '14.5px', fontWeight: 500,
                        color: isDone ? '#9A7A60' : '#3C2818',
                        textDecoration: isDone ? 'line-through' : 'none',
                        transition: 'all 0.18s',
                      }}>
                        {item.label}
                      </span>
                      {/* Não se aplica — só para tarefas do catálogo (o dismiss informa o motor de regras) */}
                      {!isDone && item.catalog_key !== null && (
                        <button
                          onClick={(e) => { e.stopPropagation(); dismiss(item) }}
                          title="Marcar como não se aplica"
                          className="opacity-0 transition-opacity group-hover:opacity-100"
                          style={{
                            border: 'none', background: 'transparent', cursor: 'pointer',
                            fontSize: '12px', color: 'var(--muted-fg)', padding: '2px 6px',
                            flexShrink: 0, textDecoration: 'underline',
                          }}
                        >
                          não se aplica
                        </button>
                      )}
                      {/* Editar / excluir — só tarefas avulsas (catalog_key null) */}
                      {item.catalog_key === null && (
                        <div className="opacity-0 transition-opacity group-hover:opacity-100" style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); openEditTask(item) }}
                            title="Editar tarefa"
                            aria-label="Editar tarefa"
                            style={{
                              border: 'none', background: 'transparent', cursor: 'pointer',
                              color: 'var(--muted-fg)', padding: '4px 6px', display: 'flex', alignItems: 'center',
                            }}
                          >
                            <PencilIcon />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); removeManualTask(item) }}
                            title="Excluir tarefa"
                            aria-label="Excluir tarefa"
                            style={{
                              border: 'none', background: 'transparent', cursor: 'pointer',
                              color: '#C0553F', padding: '4px 6px', display: 'flex', alignItems: 'center',
                            }}
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      )}
                      {/* Due */}
                      {due && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--muted-fg)', flexShrink: 0 }}>
                          <ClockIcon />
                          <span style={{ fontSize: '12.5px' }}>{due}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal de tarefa avulsa */}
      <Modal
        open={taskModalOpen}
        onClose={() => { if (!saving) setTaskModalOpen(false) }}
        title={editingItem ? 'Editar tarefa' : 'Adicionar tarefa'}
      >
        <form onSubmit={saveTask} noValidate>
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="task-label" style={fieldLabelStyle}>Título *</label>
            <input
              id="task-label"
              type="text"
              value={formLabel}
              onChange={(e) => setFormLabel(e.target.value)}
              placeholder="Ex: Provar o bolo com a confeitaria"
              maxLength={200}
              autoFocus
              style={fieldInputStyle}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="task-category" style={fieldLabelStyle}>Categoria</label>
            <select
              id="task-category"
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
              style={{ ...fieldInputStyle, cursor: 'pointer' }}
            >
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="task-due-date" style={fieldLabelStyle}>Data (opcional)</label>
            <DatePicker
              id="task-due-date"
              value={formDueDate}
              onChange={setFormDueDate}
              placeholder="Selecione a data"
            />
          </div>

          {formError && (
            <p style={{ fontSize: '13px', color: '#C0553F', margin: '0 0 14px' }}>{formError}</p>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setTaskModalOpen(false)}
              disabled={saving}
              style={{
                border: '1.5px solid #EBDDD0', background: 'transparent', color: 'var(--fg)',
                borderRadius: '12px', padding: '11px 18px', fontWeight: 600, fontSize: '14px',
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                background: 'var(--wedding-color)', color: '#fff', border: 'none',
                borderRadius: '12px', padding: '11px 22px', fontWeight: 600, fontSize: '14px',
                cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Salvando…' : editingItem ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
