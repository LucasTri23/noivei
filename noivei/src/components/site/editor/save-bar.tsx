'use client'

import Spinner from '@/components/ui/spinner'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { ghostButtonStyle, primaryButtonStyle } from '@/components/site/editor/styles'

interface SaveBarProps {
  visible:   boolean
  saving:    boolean
  /** Ex.: "Capa e Galeria" — onde estão as alterações. */
  summary?:  string
  onSave:    () => void
  onDiscard: () => void
}

/**
 * Barra fixa de "alterações não salvas", igual para todas as abas do editor. Fica
 * acima da navegação inferior no celular e encostada no rodapé no computador.
 */
export default function SaveBar({ visible, saving, summary, onSave, onDiscard }: SaveBarProps) {
  const showSpinner = useDelayedLoading(saving)
  if (!visible && !saving) return null

  return (
    <div
      className="sticky z-30 mt-5 bottom-[calc(84px+env(safe-area-inset-bottom))] md:bottom-4"
      role="region"
      aria-label="Alterações não salvas"
    >
      <div
        style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px 14px',
          padding: '12px 14px 12px 18px', borderRadius: '16px',
          background: 'var(--surface)', border: '1.5px solid color-mix(in srgb, var(--wedding-color) 45%, var(--border))',
          boxShadow: '0 12px 32px rgba(40,24,10,0.18)',
        }}
      >
        <span aria-hidden style={{ width: '9px', height: '9px', borderRadius: '50%', background: 'var(--wedding-color)', flexShrink: 0 }} />
        <p role="status" style={{ flex: '1 1 180px', margin: 0, fontSize: '14px', color: 'var(--fg)', lineHeight: 1.4 }}>
          <strong>{saving ? 'Salvando alterações…' : 'Você tem alterações não salvas'}</strong>
          {summary && !saving && <span style={{ display: 'block', fontSize: '12.5px', color: 'var(--muted-fg)' }}>Em: {summary}</span>}
        </p>
        <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
          <button type="button" onClick={onDiscard} disabled={saving} style={{ ...ghostButtonStyle, minHeight: '42px', padding: '0 14px', fontWeight: 600, fontSize: '14px' }}>
            Descartar
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            aria-keyshortcuts="Control+S Meta+S"
            title="Salvar (Ctrl+S)"
            style={{ ...primaryButtonStyle, minHeight: '42px', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.75 : 1 }}
          >
            {showSpinner && <Spinner color="#fff" />} Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
