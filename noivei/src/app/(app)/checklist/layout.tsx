import ModuleAccessGate from '@/components/billing/module-access-gate'

// checklist/page.tsx e checklist/personalizar/page.tsx são Client Components (usam
// estado local e hooks) — o gate de permissão (Server Component) envolve as duas
// rotas por aqui, no layout do segmento, em vez de dentro de cada page.
export default function ChecklistLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleAccessGate module="checklist">
      {children}
    </ModuleAccessGate>
  )
}
