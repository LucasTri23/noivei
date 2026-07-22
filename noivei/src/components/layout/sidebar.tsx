'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import type { WeddingModuleKey } from '@/types/database'

// module ausente = item nunca restringível (dashboard, perfil) — não passa pelo
// filtro de visibleModules abaixo, sempre aparece.
const NAV = [
  { href: '/dashboard',   label: 'Início',        icon: HouseIcon },
  { href: '/checklist',   label: 'Checklist',     icon: ListIcon,     module: 'checklist' as WeddingModuleKey },
  { href: '/timeline',    label: 'Timeline',      icon: CalendarIcon, module: 'checklist' as WeddingModuleKey },
  { href: '/convidados',  label: 'Convidados',    icon: UsersIcon,    module: 'convidados' as WeddingModuleKey },
  { href: '/financeiro',  label: 'Financeiro',    icon: WalletIcon,   module: 'financeiro' as WeddingModuleKey },
  { href: '/padrinhos',   label: 'Padrinhos & Entradas', icon: PartyIcon, module: 'padrinhos' as WeddingModuleKey },
  { href: '/mesas',       label: 'Mesas',         icon: ArmchairIcon, pro: true, module: 'mesas' as WeddingModuleKey },
  { href: '/site',        label: 'Site do casal', icon: GlobeIcon,    pro: true, module: 'site' as WeddingModuleKey },
  { href: '/presentes',   label: 'Lista de presentes', icon: GiftIcon, pro: true, module: 'presentes' as WeddingModuleKey },
  { href: '/arquivos',    label: 'Arquivos',      icon: FolderIcon,   pro: true, module: 'arquivos' as WeddingModuleKey },
  { href: '/perfil',      label: 'Perfil',        icon: SettingsIcon },
]

interface SidebarProps {
  coupleNames:     string
  plan:            string
  initial:         string
  isFreePlan:      boolean
  visibleModules:  Record<WeddingModuleKey, boolean>
}

export default function Sidebar({ coupleNames, plan, initial, isFreePlan, visibleModules }: SidebarProps) {
  const pathname = usePathname()
  const items = NAV.filter((item) => !item.module || visibleModules[item.module])

  return (
    <aside
      className="hidden w-64 flex-shrink-0 flex-col md:flex"
      style={{
        alignSelf: 'flex-start',
        position: 'sticky',
        top: 0,
        height: '100vh',
        background: 'linear-gradient(180deg, var(--brand-dark-gradient-from), var(--brand-dark-gradient-to))',
        color: '#FAF0E6',
        padding: '26px 18px',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-2.5 pb-7">
        <WednestRings />
        <span className="font-display" style={{ fontSize: '28px', fontWeight: 500, color: 'var(--wedding-color-light)', letterSpacing: '0.02em' }}>
          Wednest
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5">
        {items.map(({ href, label, icon: Icon, pro }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition-colors',
                active
                  ? 'text-[var(--wedding-color-secondary-light)]'
                  : 'text-[rgba(250,240,230,0.65)] hover:bg-[color-mix(in_srgb,var(--wedding-color)_10%,transparent)] hover:text-[rgba(250,240,230,0.9)]',
              )}
              style={active ? { background: 'color-mix(in srgb, var(--wedding-color-secondary) 18%, transparent)' } : undefined}
            >
              <Icon size={19} />
              <span style={{ fontWeight: active ? 600 : 500 }}>{label}</span>
              {pro && isFreePlan && (
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: '10px', fontWeight: 700, padding: '1px 8px',
                    borderRadius: '99px', background: 'var(--wedding-color)', color: '#fff',
                    letterSpacing: '0.06em',
                  }}
                >
                  PRO
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div
        className="flex items-center gap-2.5 pt-4"
        style={{ borderTop: '1px solid rgba(250,240,230,0.1)', marginTop: '14px' }}
      >
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full font-display text-xl font-semibold"
          style={{ background: 'color-mix(in srgb, var(--wedding-color) 22%, transparent)', color: 'var(--wedding-color-light)' }}
        >
          {initial}
        </div>
        <div className="min-w-0 leading-snug">
          <div className="truncate text-sm font-semibold" style={{ color: '#FAF0E6' }}>
            {coupleNames}
          </div>
          <div className="text-xs" style={{ color: 'rgba(250,240,230,0.5)' }}>
            {plan}
          </div>
        </div>
      </div>
    </aside>
  )
}

/* ── Logo: duas alianças entrelaçadas ──────────────────────────── */
function WednestRings() {
  return (
    <svg width="36" height="26" viewBox="0 0 72 52" fill="none">
      <defs>
        <linearGradient id="rg1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--wedding-color-light)" />
          <stop offset="100%" stopColor="var(--wedding-color)" />
        </linearGradient>
        <linearGradient id="rg2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--wedding-color)" />
          <stop offset="100%" stopColor="var(--wedding-color-dark)" />
        </linearGradient>
      </defs>
      <circle cx="26" cy="26" r="16" stroke="url(#rg1)" strokeWidth="5" fill="none" />
      <circle cx="46" cy="26" r="16" stroke="url(#rg2)" strokeWidth="5" fill="none" />
    </svg>
  )
}

/* ── Icon components ───────────────────────────────────────────── */
function HouseIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
}
function ListIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
}
function CalendarIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>
}
function UsersIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
}
function WalletIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
}
function PartyIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="8" r="3"/><circle cx="17" cy="8" r="3"/><path d="M2 21v-1a5 5 0 0 1 5-5h0a5 5 0 0 1 3.5 1.42"/><path d="M13.5 16.42A5 5 0 0 1 17 15h0a5 5 0 0 1 5 5v1"/><path d="M9.5 15.5 12 18l2.5-2.5"/></svg>
}
function ArmchairIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3"/><path d="M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z"/><path d="M5 18v2M19 18v2"/></svg>
}
function GlobeIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
}
function GiftIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
}
function FolderIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/></svg>
}
function SettingsIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
}
