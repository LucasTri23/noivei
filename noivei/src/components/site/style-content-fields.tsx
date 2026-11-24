'use client'

/* eslint-disable @next/next/no-img-element -- Imagem do Storage do casal, sem domínio fixo para o next/image. */
import { useRef } from 'react'

import { hintStyle, inputStyle, labelStyle, secondaryButtonStyle, textareaStyle } from '@/components/site/editor/styles'
import { SITE_TEMPLATE_CONFIG, type StyleField } from '@/lib/site/template-config'
import type { SiteContent } from '@/lib/site/site-content'
import type { SiteTemplate } from '@/types/database'

interface MonogramImageProps {
  uploading: boolean
  onPick:    (file: File) => void
  onRemove:  () => void
}

export default function StyleContentFields({ template, content, onChange, monogramEnabled, monogramImage }: {
  monogramEnabled: boolean; template: SiteTemplate; content: SiteContent; onChange: (key: StyleField, value: string) => void
  /** Sem esta prop (ex.: assistente de criação) o campo de imagem não aparece. */
  monogramImage?: MonogramImageProps
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const config = SITE_TEMPLATE_CONFIG[template]
  const isEnvelope = template === 'invitation' || template === 'enveloped'

  return (
    <div className="flex flex-col gap-4">
      <div style={{ borderRadius: '12px', background: 'var(--muted)', border: '1px solid var(--border)', padding: '12px 14px' }}>
        <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--fg)', margin: 0 }}>Fotos no estilo {config.label}</p>
        <p style={{ ...hintStyle, marginTop: '2px' }}>{config.photoGuide}</p>
        <p style={{ ...hintStyle, marginTop: '4px' }}>Nomes, data e local vêm do cadastro do casamento.</p>
      </div>

      {monogramEnabled && (
        <div>
          <label htmlFor="envelope_monogram" style={labelStyle}>{isEnvelope ? 'Monograma no selo' : 'Monograma do casal'}</label>
          <input
            id="envelope_monogram"
            type="text"
            maxLength={12}
            placeholder="Ex.: A & J"
            value={content.envelope_monogram ?? ''}
            onChange={(event) => onChange('envelope_monogram', event.target.value)}
            style={inputStyle}
          />
          {monogramImage && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '12px', flexWrap: 'wrap' }}>
              <div
                aria-hidden
                style={{
                  width: '72px', height: '72px', borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', overflow: 'hidden',
                  background: isEnvelope ? 'radial-gradient(ellipse at 35% 25%,#fff3c7,#e8ca7e 35%,#c29b48 68%,#edd595 88%,#a07c32)' : 'var(--muted)',
                  border: '1px solid var(--border)', color: 'var(--wedding-color-dark)', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '18px',
                }}
              >
                {content.monogram_image_url
                  ? <img src={content.monogram_image_url} alt="" style={{ width: '84%', height: '84%', objectFit: 'contain' }} />
                  : (content.envelope_monogram?.trim() || 'A & J')}
              </div>
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={monogramImage.uploading} style={{ ...secondaryButtonStyle, opacity: monogramImage.uploading ? 0.6 : 1 }}>
                    {monogramImage.uploading ? 'Enviando…' : content.monogram_image_url ? 'Trocar imagem' : 'Usar uma imagem'}
                  </button>
                  {content.monogram_image_url && (
                    <button type="button" onClick={monogramImage.onRemove} style={{ ...secondaryButtonStyle, background: 'transparent' }}>Remover imagem</button>
                  )}
                </div>
                <p style={hintStyle}>
                  PNG com fundo transparente fica melhor. A imagem substitui o texto {isEnvelope ? 'no selo' : 'no site'}; o texto continua como descrição para leitores de tela.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  aria-label="Imagem do monograma"
                  style={{ display: 'none' }}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (file) monogramImage.onPick(file)
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {config.fields.map((field) => (
        <div key={field.key}>
          <label htmlFor={field.key} style={labelStyle}>{field.label}</label>
          <textarea
            id={field.key}
            rows={2}
            maxLength={field.maxLength}
            placeholder={field.placeholder}
            value={content[field.key] ?? ''}
            onChange={(event) => onChange(field.key, event.target.value)}
            style={textareaStyle}
          />
        </div>
      ))}
    </div>
  )
}
