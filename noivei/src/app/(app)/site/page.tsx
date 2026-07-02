'use client'

import { useState } from 'react'

type SectionId = 'capa' | 'historia' | 'cerimonia' | 'rsvp' | 'presentes' | 'galeria'

interface Section {
  id: SectionId
  label: string
  icon: React.ReactNode
}

function ImageIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
}
function HeartIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
}
function MapPinIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
}
function MailCheckIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/><path d="m16 19 2 2 4-4"/></svg>
}
function GiftIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
}
function CameraIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
}
function GlobeIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
}
function ExternalLinkIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
}

const SECTIONS: Section[] = [
  { id: 'capa',     label: 'Capa',               icon: <ImageIcon /> },
  { id: 'historia', label: 'Nossa história',      icon: <HeartIcon /> },
  { id: 'cerimonia',label: 'Cerimônia & festa',   icon: <MapPinIcon /> },
  { id: 'rsvp',     label: 'Confirmar presença',  icon: <MailCheckIcon /> },
  { id: 'presentes',label: 'Lista de presentes',  icon: <GiftIcon /> },
  { id: 'galeria',  label: 'Galeria',             icon: <CameraIcon /> },
]

export default function SitePage() {
  const [active, setActive] = useState<SectionId>('capa')

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            className="font-display"
            style={{ fontWeight: 500, fontSize: 'clamp(30px,4.2vw,42px)', lineHeight: 1.05, color: '#3C2818' }}
          >
            Site do casal
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '14px', color: '#9A7A60' }}>
            <GlobeIcon />
            <span>wednest.com/seu-casamento</span>
          </div>
        </div>
        <button
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: '#C6943A', color: '#fff', border: 'none',
            borderRadius: '12px', padding: '11px 18px',
            fontWeight: 600, fontSize: '14px', cursor: 'pointer',
            boxShadow: '0 6px 16px rgba(198,148,58,0.32)',
          }}
        >
          <ExternalLinkIcon /> Publicar
        </button>
      </div>

      {/* Two columns */}
      <div className="grid gap-5" style={{ gridTemplateColumns: '260px 1fr' }}>
        {/* Sections list */}
        <div className="flex flex-col gap-2">
          {SECTIONS.map((s) => {
            const isActive = active === s.id
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '13px 16px', borderRadius: '14px',
                  border: isActive ? '1.5px solid rgba(198,148,58,0.35)' : '1px solid transparent',
                  background: isActive ? '#FBF5EE' : '#FFFFFF',
                  color: isActive ? '#9A7020' : '#3C2818',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '14px', cursor: 'pointer',
                  textAlign: 'left',
                  boxShadow: isActive ? '0 4px 12px rgba(198,148,58,0.12)' : '0 2px 8px rgba(60,40,24,0.05)',
                  transition: 'all 0.18s',
                }}
              >
                <span style={{ color: isActive ? '#C6943A' : '#9A7A60' }}>{s.icon}</span>
                {s.label}
              </button>
            )
          })}
        </div>

        {/* Browser preview */}
        <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 10px 28px rgba(60,40,24,0.10)' }}>
          {/* Browser bar */}
          <div
            style={{
              padding: '12px 16px',
              background: '#F8F3EE',
              borderBottom: '1px solid #EBDDD0',
              display: 'flex', alignItems: 'center', gap: '10px',
            }}
          >
            <div style={{ display: 'flex', gap: '6px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#EBDDD0' }} />
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#E0B870' }} />
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#C6943A' }} />
            </div>
            <div
              style={{
                flex: 1, padding: '5px 14px', borderRadius: '8px',
                background: '#FFFFFF', border: '1px solid #EBDDD0',
                fontSize: '12.5px', color: '#9A7A60',
              }}
            >
              wednest.com/seu-casamento
            </div>
          </div>

          {/* Preview content */}
          <div
            style={{
              height: '520px', position: 'relative', overflow: 'hidden',
              background: 'linear-gradient(170deg, #F4EADC, #EBD2CB)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {/* Dot pattern */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{ backgroundImage: 'radial-gradient(rgba(198,148,58,0.22) 1.2px, transparent 1.4px)', backgroundSize: '26px 26px' }}
            />

            <div style={{ position: 'relative', textAlign: 'center', padding: '0 24px' }}>
              <div
                className="font-display"
                style={{ fontSize: 'clamp(48px,8vw,80px)', fontWeight: 500, color: '#3C2818', lineHeight: 0.95 }}
              >
                Seu Nome & Seu Par
              </div>
              <div
                className="font-display"
                style={{ fontStyle: 'italic', fontSize: '22px', color: '#9A7020', marginTop: '12px' }}
              >
                Data do seu casamento
              </div>

              <button
                style={{
                  marginTop: '32px',
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  background: '#C6943A', color: '#fff', border: 'none',
                  borderRadius: '12px', padding: '13px 26px',
                  fontWeight: 600, fontSize: '15px', cursor: 'pointer',
                  boxShadow: '0 8px 22px rgba(198,148,58,0.38)',
                }}
              >
                Confirmar presença
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
