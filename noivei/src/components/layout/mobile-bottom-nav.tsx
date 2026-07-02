'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/dashboard',  label: 'Início',    icon: HouseIcon },
  { href: '/checklist',  label: 'Tarefas',   icon: ListIcon },
  { href: '/convidados', label: 'Convidados', icon: UsersIcon },
  { href: '/financeiro', label: 'Financeiro', icon: WalletIcon },
]

export default function MobileBottomNav() {
  const pathname = usePathname()

  return (
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
    </div>
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
