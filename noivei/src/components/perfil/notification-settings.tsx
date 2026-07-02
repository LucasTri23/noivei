'use client'

import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase/browser'

interface NotificationSettingsProps {
  userId: string
  initial: {
    notify_timeline: boolean
    notify_rsvp:     boolean
  }
}

interface ToggleRowProps {
  title:       string
  description: string
  checked:     boolean
  disabled:    boolean
  onChange:    (value: boolean) => void
}

function ToggleRow({ title, description, checked, disabled, onChange }: ToggleRowProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 0' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '14.5px', fontWeight: 600, color: '#3C2818' }}>{title}</div>
        <div style={{ fontSize: '13px', color: '#9A7A60', marginTop: '2px', lineHeight: 1.5 }}>{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        style={{
          width: '46px', height: '26px', borderRadius: '99px', border: 'none', flexShrink: 0,
          background: checked ? 'var(--wedding-color)' : '#D8CCC0',
          position: 'relative', cursor: disabled ? 'wait' : 'pointer',
          transition: 'background 0.2s ease', opacity: disabled ? 0.7 : 1,
        }}
      >
        <span
          style={{
            position: 'absolute', top: '3px', left: checked ? '23px' : '3px',
            width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
            boxShadow: '0 1px 3px rgba(60,40,24,0.25)', transition: 'left 0.2s ease',
          }}
        />
      </button>
    </div>
  )
}

export default function NotificationSettings({ userId, initial }: NotificationSettingsProps) {
  const [prefs, setPrefs]     = useState(initial)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  async function save(key: 'notify_timeline' | 'notify_rsvp', value: boolean) {
    const previous = prefs
    setPrefs((p) => ({ ...p, [key]: value }))
    setSaving(true)
    setError('')

    const supabase = createSupabaseBrowser()
    const { error: dbError } = await supabase
      .from('profiles')
      .update({ [key]: value })
      .eq('id', userId)

    setSaving(false)
    if (dbError) {
      setPrefs(previous)
      setError('Não foi possível salvar sua preferência. Tente novamente.')
    }
  }

  return (
    <div>
      <ToggleRow
        title="Timeline"
        description="Lembretes de tarefas e prazos que estão chegando."
        checked={prefs.notify_timeline}
        disabled={saving}
        onChange={(v) => save('notify_timeline', v)}
      />
      <div style={{ height: '1px', background: '#F8F3EE' }} />
      <ToggleRow
        title="Respostas dos convidados"
        description="Avisos quando alguém confirmar ou recusar o convite (RSVP)."
        checked={prefs.notify_rsvp}
        disabled={saving}
        onChange={(v) => save('notify_rsvp', v)}
      />
      {error && (
        <p style={{ fontSize: '13px', color: '#C0553F', background: '#FBEEE6', padding: '10px 14px', borderRadius: '10px', marginTop: '10px' }}>
          {error}
        </p>
      )}
      <p style={{ fontSize: '12.5px', color: '#C8B4A0', marginTop: '14px', lineHeight: 1.5 }}>
        Os envios de e-mail e push chegam em breve — suas preferências já ficam salvas.
      </p>
    </div>
  )
}
