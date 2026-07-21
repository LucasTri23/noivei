'use client'

import { useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { toastError, toastSuccess } from '@/store/toast.store'

const emptySubscribe = () => () => {}

interface AppearanceSettingsProps {
  weddingId:            string | null
  weddingColor:         string
  weddingColorSecondary: string
  isPaid:               boolean
}

const DEFAULT_COLOR           = '#C6943A'
const DEFAULT_COLOR_SECONDARY = '#C89070'

// 6 dígitos hex, com # obrigatório — mesmo formato aceito por <input type="color">
const HEX_COLOR_REGEX = /^#([0-9A-Fa-f]{6})$/

// Um seletor de cor (picker nativo + campo hex digitável) — usado tanto para a cor
// principal quanto para a secundária, que compartilham a mesma UI e validação.
interface ColorPickerFieldProps {
  label:       string
  ariaLabel:   string
  hexAriaLabel: string
  color:       string
  hexInput:    string
  hexError:    boolean
  onPickerChange: (value: string) => void
  onHexInputChange: (value: string) => void
  onHexInputBlur: () => void
}

function ColorPickerField({
  label, ariaLabel, hexAriaLabel, color, hexInput, hexError,
  onPickerChange, onHexInputChange, onHexInputBlur,
}: ColorPickerFieldProps) {
  return (
    <div>
      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--fg)', marginBottom: '8px' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        <input
          type="color"
          value={color}
          onChange={(e) => onPickerChange(e.target.value)}
          aria-label={ariaLabel}
          style={{
            width: '56px', height: '40px', border: '1.5px solid #EBDDD0',
            borderRadius: '10px', padding: '3px', background: '#fff', cursor: 'pointer',
          }}
        />
        <input
          type="text"
          value={hexInput}
          onChange={(e) => onHexInputChange(e.target.value)}
          onBlur={onHexInputBlur}
          placeholder={color}
          maxLength={7}
          aria-label={hexAriaLabel}
          aria-invalid={hexError}
          style={{
            width: '110px', padding: '9px 12px',
            border: `1.5px solid ${hexError ? '#C0553F' : '#EBDDD0'}`,
            borderRadius: '10px', fontSize: '14px', fontWeight: 600, color: 'var(--fg)',
            fontFamily: 'monospace', textTransform: 'uppercase', outline: 'none',
          }}
        />
      </div>
      {hexError && (
        <p style={{ fontSize: '12.5px', color: '#C0553F', margin: '8px 0 0' }}>
          Use o formato #RRGGBB (6 dígitos hexadecimais).
        </p>
      )}
    </div>
  )
}

export default function AppearanceSettings({ weddingId, weddingColor, weddingColorSecondary, isPaid }: AppearanceSettingsProps) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const initialColor          = weddingColor || DEFAULT_COLOR
  const initialColorSecondary = weddingColorSecondary || DEFAULT_COLOR_SECONDARY
  const [color, setColor]                   = useState(initialColor)
  const [colorSecondary, setColorSecondary] = useState(initialColorSecondary)
  // Campos de texto digitáveis, sincronizados com `color`/`colorSecondary` (as cores de
  // fato aplicadas/salvas). Ficam em estado próprio para permitir digitação parcial/inválida
  // sem já sobrescrever a cor aplicada — só sincronizam de volta quando o hex é válido.
  const [hexInput, setHexInput]                   = useState(initialColor)
  const [hexInputSecondary, setHexInputSecondary] = useState(initialColorSecondary)
  const [hexError, setHexError]                   = useState(false)
  const [hexErrorSecondary, setHexErrorSecondary] = useState(false)
  const [saving, setSaving] = useState(false)

  // next-themes só conhece o tema no cliente — evita mismatch de hidratação
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false)

  function handlePickerChange(value: string) {
    setColor(value)
    setHexInput(value)
    setHexError(false)
  }

  function handleHexInputChange(value: string) {
    setHexInput(value)
    if (HEX_COLOR_REGEX.test(value)) {
      setColor(value)
      setHexError(false)
    } else {
      setHexError(true)
    }
  }

  // Ao sair do campo com um valor inválido, volta a mostrar a última cor válida —
  // evita deixar o campo travado num texto que nunca vai virar uma cor aplicada.
  function handleHexInputBlur() {
    if (!HEX_COLOR_REGEX.test(hexInput)) {
      setHexInput(color)
      setHexError(false)
    }
  }

  function handlePickerChangeSecondary(value: string) {
    setColorSecondary(value)
    setHexInputSecondary(value)
    setHexErrorSecondary(false)
  }

  function handleHexInputChangeSecondary(value: string) {
    setHexInputSecondary(value)
    if (HEX_COLOR_REGEX.test(value)) {
      setColorSecondary(value)
      setHexErrorSecondary(false)
    } else {
      setHexErrorSecondary(true)
    }
  }

  function handleHexInputBlurSecondary() {
    if (!HEX_COLOR_REGEX.test(hexInputSecondary)) {
      setHexInputSecondary(colorSecondary)
      setHexErrorSecondary(false)
    }
  }

  async function saveColor() {
    if (!weddingId) return
    setSaving(true)

    const supabase = createSupabaseBrowser()
    const { error: dbError } = await supabase
      .from('weddings')
      .update({ wedding_color: color, wedding_color_secondary: colorSecondary })
      .eq('id', weddingId)

    setSaving(false)
    if (dbError) {
      toastError('Não foi possível salvar as cores. Tente novamente.')
      return
    }
    toastSuccess('Cores do casamento atualizadas.')
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Tema claro/escuro */}
      <div className="rounded-2xl bg-[var(--surface)] p-6" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)' }}>
        <h2 className="font-display" style={{ fontSize: '20px', fontWeight: 500, color: 'var(--fg)', margin: '0 0 4px' }}>
          Tema
        </h2>
        <p style={{ fontSize: '13.5px', color: 'var(--muted-fg)', margin: '0 0 16px' }}>
          Escolha entre o modo claro e o modo escuro.
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          {[
            { value: 'light', label: 'Claro' },
            { value: 'dark',  label: 'Escuro' },
          ].map(({ value, label }) => {
            const active = mounted && theme === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                style={{
                  flex: 1, maxWidth: '160px', padding: '12px', borderRadius: '12px',
                  border: `1.5px solid ${active ? 'var(--wedding-color)' : '#EBDDD0'}`,
                  background: active ? 'var(--wedding-color-subtle)' : 'transparent',
                  color: active ? 'var(--wedding-color-dark)' : '#9A7A60',
                  fontWeight: active ? 700 : 500, fontSize: '14px',
                  cursor: 'pointer', transition: 'all 0.18s',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Cores do casamento */}
      <div className="rounded-2xl bg-[var(--surface)] p-6" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)', opacity: isPaid ? 1 : 0.85 }}>
        <h2 className="font-display" style={{ fontSize: '20px', fontWeight: 500, color: 'var(--fg)', margin: '0 0 4px' }}>
          Cores do casamento
        </h2>
        <p style={{ fontSize: '13.5px', color: 'var(--muted-fg)', margin: '0 0 16px', lineHeight: 1.5 }}>
          As cores escolhidas pelo casal colorem todo o app — botões, destaques e o site de vocês.
        </p>

        {isPaid ? (
          <div className="flex flex-col gap-5">
            <ColorPickerField
              label="Cor principal"
              ariaLabel="Cor principal do casamento"
              hexAriaLabel="Código hexadecimal da cor principal"
              color={color}
              hexInput={hexInput}
              hexError={hexError}
              onPickerChange={handlePickerChange}
              onHexInputChange={handleHexInputChange}
              onHexInputBlur={handleHexInputBlur}
            />
            <ColorPickerField
              label="Cor secundária"
              ariaLabel="Cor secundária do casamento"
              hexAriaLabel="Código hexadecimal da cor secundária"
              color={colorSecondary}
              hexInput={hexInputSecondary}
              hexError={hexErrorSecondary}
              onPickerChange={handlePickerChangeSecondary}
              onHexInputChange={handleHexInputChangeSecondary}
              onHexInputBlur={handleHexInputBlurSecondary}
            />
            <button
              type="button"
              onClick={saveColor}
              disabled={saving}
              style={{
                alignSelf: 'flex-start',
                background: 'var(--wedding-color)', color: '#fff', border: 'none',
                borderRadius: '12px', padding: '11px 20px', fontWeight: 600, fontSize: '14px',
                cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Salvando…' : 'Salvar cores'}
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              border: '1.5px dashed #EBDDD0', borderRadius: '12px', padding: '14px 16px',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C8B4A0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span style={{ fontSize: '13.5px', color: 'var(--muted-fg)', lineHeight: 1.5 }}>
              Disponível nos planos <strong>Premium</strong> e <strong>Premium Plus</strong>.
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
