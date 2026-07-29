import ModuleAccessGate from '@/components/billing/module-access-gate'
import PaywallGate from '@/components/billing/paywall-gate'

// checklist/page.tsx e checklist/personalizar/page.tsx são Client Components (usam
// estado local e hooks) — os gates (Server Components) envolvem as duas rotas por
// aqui, no layout do segmento, em vez de dentro de cada page. ModuleAccessGate =
// permissão de membro convidado; PaywallGate = plano da assinatura (configurável em
// /admin/planos/modulos) — os dois são checagens ortogonais, precisam passar os dois.
export default function ChecklistLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleAccessGate module="checklist">
      <PaywallGate feature="checklist">
        {children}
      </PaywallGate>
    </ModuleAccessGate>
  )
}
