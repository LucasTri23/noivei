'use client'

import { hintStyle, inputStyle, labelStyle, textareaStyle } from '@/components/site/editor/styles'
import { SITE_TEMPLATE_CONFIG, type StyleField } from '@/lib/site/template-config'
import type { SiteContent } from '@/lib/site/site-content'
import type { SiteTemplate } from '@/types/database'

export default function StyleContentFields({ template, content, onChange, monogramEnabled }: {
  monogramEnabled: boolean; template: SiteTemplate; content: SiteContent; onChange: (key: StyleField, value: string) => void
}) {
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
