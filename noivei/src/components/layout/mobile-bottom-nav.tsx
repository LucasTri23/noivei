'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Modal from '@/components/ui/modal'
import type { WeddingModuleKey } from '@/types/database'

const NAV = [
  { href: '/dashboard',  label: 'Início',    icon: HouseIcon },
  { href: '/checklist',  label: 'Tarefas',   icon: ListIcon },
  { href: '/convidados', label: 'Convidados', icon: UsersIcon },
  { href: '/financeiro', label: 'Financeiro', icon: WalletIcon },
] as const

// Módulos que não cabem na barra fixa (só 5 espaços dá pra mostrar sem espremer)
// ficam atrás do botão "Mais" — sem isso, quem usa o celular nunca alcançava
// Timeline/Padrinhos/Mesas/Site/Presentes/Arquivos/Perfil de jeito nenhum.
const MORE_NAV = [
  { href: '/timeline',   label: 'Timeline',            icon: CalendarIcon, module: 'checklist' as WeddingModuleKey },
  { href: '/padrinhos',  label: 'Padrinhos & Entradas', icon: PartyIcon,    module: 'padrinhos' as WeddingModuleKey },
  { href: '/mesas',      label: 'Mesas',                icon: ArmchairIcon, module: 'mesas' as WeddingModuleKey },
  { href: '/site',       label: 'Site do casal',        icon: GlobeIcon,    module: 'site' as WeddingModuleKey },
  { href: '/presentes',  label: 'Lista de presentes',   icon: GiftIcon,     module: 'presentes' as WeddingModuleKey },
  { href: '/arquivos',   label: 'Arquivos',             icon: FolderIcon,   module: 'arquivos' as WeddingModuleKey },
  { href: '/perfil',     label: 'Perfil',               icon: SettingsIcon },
]

interface MobileBottomNavProps {
  visibleModules:   Record<WeddingModuleKey, boolean>
  planModuleAccess: Record<WeddingModuleKey, boolean>
}

export default function MobileBottomNav({ visibleModules, planModuleAccess }: MobileBottomNavProps) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  const moreItems = MORE_NAV.filter((item) => !item.module || visibleModules[item.module])
  const moreActive = moreItems.some(({ href }) => pathname === href || pathname.startsWith(href + '/'))

  return (
    <>
      <div
        className="fixed bottom-0 left-0 right-0 z-20 flex justify-around items-center px-2 md:hidden"
        style={{
          paddingTop: '10px',
          paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(10px)',
          borderTop: '1px solid #EBDDD0',
        }}
      >
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-0.5 px-2.5 py-1"
              style={{ color: active ? 'var(--wedding-color)' : '#C8B4A0' }}
            >
              <Icon size={23} strokeWidth={active ? 2.1 : 1.7} />
              <span style={{ fontSize: '10.5px', fontWeight: 600 }}>{label}</span>
            </Link>
          )
        })}

        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex flex-col items-center gap-0.5 px-2.5 py-1"
          style={{ color: moreActive ? 'var(--wedding-color)' : '#C8B4A0', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <MoreIcon size={23} strokeWidth={moreActive ? 2.1 : 1.7} />
          <span style={{ fontSize: '10.5px', fontWeight: 600 }}>Mais</span>
        </button>
      </div>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="Mais módulos" maxWidth="360px">
        <div className="flex flex-col gap-1">
          {moreItems.map(({ href, label, icon: Icon, module }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            const locked = Boolean(module) && !planModuleAccess[module as WeddingModuleKey]
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium"
                style={{
                  color: active ? 'var(--wedding-color-dark)' : '#3C2818',
                  background: active ? 'var(--wedding-color-subtle)' : 'transparent',
                  textDecoration: 'none',
                }}
              >
                <Icon size={19} strokeWidth={1.8} />
                <span style={{ fontWeight: active ? 600 : 500 }}>{label}</span>
                {locked && (
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
        </div>
      </Modal>
    </>
  )
}

function HouseIcon({ size, strokeWidth }: { size: number; strokeWidth: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
}
function ListIcon({ size, strokeWidth }: { size: number; strokeWidth: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
}
function UsersIcon({ size, strokeWidth }: { size: number; strokeWidth: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
}
function WalletIcon({ size, strokeWidth }: { size: number; strokeWidth: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
}
function MoreIcon({ size, strokeWidth }: { size: number; strokeWidth: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
}
function CalendarIcon({ size, strokeWidth }: { size: number; strokeWidth: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>
}
function PartyIcon({ size, strokeWidth }: { size: number; strokeWidth: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="8" r="3"/><circle cx="17" cy="8" r="3"/><path d="M2 21v-1a5 5 0 0 1 5-5h0a5 5 0 0 1 3.5 1.42"/><path d="M13.5 16.42A5 5 0 0 1 17 15h0a5 5 0 0 1 5 5v1"/><path d="M9.5 15.5 12 18l2.5-2.5"/></svg>
}
function ArmchairIcon({ size, strokeWidth }: { size: number; strokeWidth: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"><path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3"/><path d="M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z"/><path d="M5 18v2M19 18v2"/></svg>
}
function GlobeIcon({ size, strokeWidth }: { size: number; strokeWidth: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
}
function GiftIcon({ size, strokeWidth }: { size: number; strokeWidth: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
}
function FolderIcon({ size, strokeWidth }: { size: number; strokeWidth: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"><path d="M4 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/></svg>
}
function SettingsIcon({ size, strokeWidth }: { size: number; strokeWidth: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
}
