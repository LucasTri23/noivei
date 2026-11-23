'use client'
import { SITE_TEMPLATE_CONFIG, type StyleField } from '@/lib/site/template-config'
import type { SiteContent } from '@/lib/site/site-content'
import type { SiteTemplate } from '@/types/database'
export default function StyleContentFields({ template, content, onChange, monogramEnabled }: {
  monogramEnabled: boolean; template: SiteTemplate; content: SiteContent; onChange: (key: StyleField, value: string) => void
}) {
  const config = SITE_TEMPLATE_CONFIG[template]
  return <div className="rounded-xl border border-[var(--border)] p-4 space-y-4">
    <p className="font-semibold">Conteúdo do estilo {config.label}</p>
    <p className="text-sm text-[var(--muted-fg)]">{config.photoGuide}</p>
    <p className="text-sm text-[var(--muted-fg)]">Dados do casal, data e local vêm do casamento. Cerimônia, recepção, traje, presentes e confirmação de presença continuam nas seções abaixo.</p>
    {monogramEnabled && <div>
      <label htmlFor="envelope_monogram" className="block text-sm font-medium mb-2">
        {template === 'invitation' || template === 'enveloped' ? 'Monograma no selo' : 'Monograma do casal'}
      </label>
      <input id="envelope_monogram" type="text" maxLength={12} placeholder="Ex.: A & J"
        value={content.envelope_monogram ?? ''} onChange={(event) => onChange('envelope_monogram', event.target.value)}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm" />
    </div>}
    {config.fields.map((field) => <div key={field.key}>
      <label htmlFor={field.key} className="block text-sm font-medium mb-2">{field.label}</label>
      <textarea id={field.key} rows={2} maxLength={field.maxLength} placeholder={field.placeholder}
        value={content[field.key] ?? ''} onChange={(event) => onChange(field.key, event.target.value)}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm" />
    </div>)}
  </div>
}
