'use client'

import Link from 'next/link'

export default function MobileTopBar() {
  return (
    <div
      className="sticky top-0 z-20 flex items-center justify-between px-4 py-3.5 md:hidden"
      style={{
        background: 'rgba(250,245,240,0.94)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid #EBDDD0',
      }}
    >
      <Link href="/dashboard" className="flex items-center gap-2.5">
        <svg width="30" height="22" viewBox="0 0 76 56" fill="none">
          <defs>
            <linearGradient id="mtg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--wedding-color-light)" />
              <stop offset="100%" stopColor="var(--wedding-color)" />
            </linearGradient>
          </defs>
          <circle cx="28" cy="28" r="17" stroke="url(#mtg)" strokeWidth="5" fill="none" />
          <circle cx="48" cy="28" r="17" stroke="url(#mtg)" strokeWidth="5" fill="none" />
        </svg>
        <span className="font-display font-medium" style={{ fontSize: '24px', color: 'var(--fg)', letterSpacing: '0.02em' }}>
          Wednest
        </span>
      </Link>
    </div>
  )
}
