import PaywallGate from '@/components/billing/paywall-gate'
import SiteBuilder from '@/components/site/site-builder'

export default function SitePage() {
  return (
    <PaywallGate feature="site">
      <SiteBuilder />
    </PaywallGate>
  )
}
