import PaywallGate from '@/components/billing/paywall-gate'
import TablesBoard from '@/components/tables/tables-board'

export default function MesasPage() {
  return (
    <PaywallGate feature="mesas">
      <TablesBoard />
    </PaywallGate>
  )
}
