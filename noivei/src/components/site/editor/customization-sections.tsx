'use client'

import RichTextEditor from '@/components/site/rich-text-editor'
import { siteFontPairStyle } from '@/components/site/site-fonts'
import EditorGroup from '@/components/site/editor/editor-group'
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, TrashIcon } from '@/components/site/editor/icons'
import {
  cardStyle, compactInputStyle, dangerColor, hintStyle, iconButtonStyle, labelStyle, noticeStyle, secondaryButtonStyle,
} from '@/components/site/editor/styles'
import type { DraftUpdater } from '@/components/site/editor/sections'
import {
  accentContrastIssue, FAQ_LIMITS, HIDE_ONLY_SECTIONS, isHexColor, isSectionHidden, LODGING_LIMITS, resolveSectionOrder,
  SEAL_FINISH_LABELS, SEAL_FINISHES, SITE_FONT_PAIRS, SITE_SECTION_LABELS, SITE_TONE_COLORS, SITE_TONE_LABELS, SITE_TONES,
  siteFeatureAccess,
  type SealFinish, type SiteFaqItem, type SiteFontPairId, type SiteLodgingItem, type SitePalette, type SiteSectionId, type SiteTone,
} from '@/lib/site/customization'
import type { SiteContent } from '@/lib/site/site-content'
import type { SiteDraft } from '@/lib/site/site-draft'
import type { PlanId } from '@/constants/plans'

function patchContent(onChange: DraftUpdater, patch: Partial<SiteContent>) {
  onChange((draft) => ({ ...draft, content: { ...draft.content, ...patch } }))
}

function LockedNote() {
  return <p style={{ ...noticeStyle, marginTop: '10px' }}>Disponível a partir do plano Ideal.</p>
}

// Cartão de opção (radio) — mesmo visual para fontes, fundo e selo.
function OptionCard({ name, checked, disabled, onSelect, children }: {
  name: string; checked: boolean; disabled?: boolean; onSelect: () => void; children: React.ReactNode
}) {
  return (
    <label
      style={{
        ...cardStyle, display: 'flex', alignItems: 'center', gap: '12px', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1,
        borderColor: checked ? 'var(--wedding-color)' : 'var(--border)', background: checked ? 'var(--wedding-color-subtle)' : 'var(--surface)', minWidth: 0,
      }}
    >
      <input type="radio" name={name} checked={checked} disabled={disabled} onChange={onSelect} style={{ accentColor: 'var(--wedding-color)', flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
    </label>
  )
}

// ───────────────────────── Aparência ─────────────────────────

export function AparenciaSection({ draft, planId, onChange }: { draft: SiteDraft; planId: PlanId; onChange: DraftUpdater }) {
  const access = siteFeatureAccess(planId)
  const palette = draft.content.palette ?? {}
  const isEnvelope = draft.template === 'invitation' || draft.template === 'enveloped'
  const contrastIssue = palette.accent && isHexColor(palette.accent) ? accentContrastIssue(palette.accent, palette.tone ?? 'cream') : null

  function setPalette(patch: Partial<SitePalette>) {
    onChange((current) => {
      const next: SitePalette = { ...(current.content.palette ?? {}), ...patch }
      for (const key of Object.keys(next) as (keyof SitePalette)[]) if (next[key] === undefined) delete next[key]
      return { ...current, content: { ...current.content, palette: Object.keys(next).length > 0 ? next : undefined } }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <EditorGroup title="Fontes" summary={SITE_FONT_PAIRS.find((pair) => pair.id === draft.content.font_pair)?.label ?? 'Padrão do estilo'}>
        <p style={{ ...hintStyle, marginTop: 0 }}>Uma fonte para os títulos e outra para os textos, escolhidas para combinar entre si.</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <OptionCard name="site-font-pair" checked={!draft.content.font_pair} onSelect={() => patchContent(onChange, { font_pair: undefined })}>
            <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--fg)' }}>Padrão do estilo</span>
            <span style={{ ...hintStyle, display: 'block', marginTop: '2px' }}>As fontes originais do estilo escolhido.</span>
          </OptionCard>
          {SITE_FONT_PAIRS.map((pair) => {
            const preview = siteFontPairStyle(pair.id)
            return (
              <OptionCard
                key={pair.id}
                name="site-font-pair"
                checked={draft.content.font_pair === pair.id}
                disabled={!access.fontPairs}
                onSelect={() => patchContent(onChange, { font_pair: pair.id as SiteFontPairId })}
              >
                <span className={preview.className} style={{ ...preview.style, display: 'block' } as React.CSSProperties}>
                  <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: '22px', lineHeight: 1.15, color: 'var(--fg)' }}>Ana &amp; João</span>
                  <span style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--muted-fg)', marginTop: '2px' }}>
                    {pair.label} · {pair.display} + {pair.body}
                  </span>
                </span>
              </OptionCard>
            )
          })}
        </div>
        {!access.fontPairs && <LockedNote />}
      </EditorGroup>

      <EditorGroup title="Cores" summary={palette.accent ? `Destaque ${palette.accent}` : 'Cor do casamento'}>
        <div>
          <label htmlFor="site-accent-color" style={labelStyle}>Cor de destaque do site</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <input
              id="site-accent-color"
              type="color"
              value={palette.accent ?? '#C6943A'}
              onChange={(event) => setPalette({ accent: event.target.value.toUpperCase() })}
              style={{ width: '52px', height: '40px', padding: '2px', border: '1.5px solid var(--border)', borderRadius: '10px', background: 'var(--surface)', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '13px', color: 'var(--muted-fg)' }}>{palette.accent ?? 'Usando a cor do casamento'}</span>
            {palette.accent && (
              <button type="button" onClick={() => setPalette({ accent: undefined })} style={{ ...secondaryButtonStyle, padding: '8px 12px' }}>Usar a cor do casamento</button>
            )}
          </div>
          <p style={hintStyle}>Vale só para o site. A cor do casamento no app continua a mesma.</p>
          {contrastIssue && <p role="alert" style={{ ...noticeStyle, marginTop: '8px', color: dangerColor, background: 'color-mix(in srgb, var(--color-danger, #b3261e) 10%, transparent)' }}>{contrastIssue}</p>}
        </div>

        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={labelStyle}>Fundo</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <OptionCard name="site-tone" checked={!palette.tone} onSelect={() => setPalette({ tone: undefined })}>
              <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--fg)' }}>Padrão</span>
            </OptionCard>
            {SITE_TONES.map((tone: SiteTone) => (
              <OptionCard key={tone} name="site-tone" checked={palette.tone === tone} disabled={!access.tone} onSelect={() => setPalette({ tone })}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span aria-hidden style={{ width: '18px', height: '18px', borderRadius: '50%', background: SITE_TONE_COLORS[tone].bg, border: '1px solid var(--border)', flexShrink: 0 }} />
                  <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--fg)' }}>{SITE_TONE_LABELS[tone]}</span>
                </span>
              </OptionCard>
            ))}
          </div>
          {!access.tone && <LockedNote />}
        </fieldset>

        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={labelStyle}>Acabamento do selo</legend>
          {!isEnvelope && <p style={{ ...hintStyle, marginTop: 0, marginBottom: '8px' }}>Aparece nos estilos Convite Selado e Envelopado.</p>}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SEAL_FINISHES.map((seal: SealFinish) => (
              <OptionCard
                key={seal}
                name="site-seal"
                checked={(palette.seal ?? 'gold') === seal}
                disabled={!access.seal}
                onSelect={() => setPalette({ seal: seal === 'gold' ? undefined : seal })}
              >
                <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--fg)' }}>{SEAL_FINISH_LABELS[seal]}</span>
              </OptionCard>
            ))}
          </div>
          {!access.seal && <LockedNote />}
        </fieldset>
      </EditorGroup>
    </div>
  )
}

// ───────────────────────── Seções ─────────────────────────

export function SecoesSection({ draft, onChange }: { draft: SiteDraft; onChange: DraftUpdater }) {
  const { content, template } = draft
  const order = resolveSectionOrder(template, content.sections?.order)
  const hideOnly = HIDE_ONLY_SECTIONS[template] ?? []

  function setSections(next: { order?: SiteSectionId[]; hidden?: SiteSectionId[] }) {
    onChange((current) => {
      const sections = { ...(current.content.sections ?? {}), ...next }
      if (!sections.order?.length) delete sections.order
      if (!sections.hidden?.length) delete sections.hidden
      return { ...current, content: { ...current.content, sections: sections.order || sections.hidden ? sections : undefined } }
    })
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= order.length) return
    const next = [...order]
    const [item] = next.splice(index, 1)
    if (item) next.splice(target, 0, item)
    setSections({ order: next })
  }

  function setVisible(id: SiteSectionId, visible: boolean) {
    if (id === 'rsvp') return patchContent(onChange, { hide_rsvp: !visible || undefined })
    if (id === 'presentes') return patchContent(onChange, { hide_gifts: !visible || undefined })
    const hidden = new Set(content.sections?.hidden ?? [])
    if (visible) hidden.delete(id)
    else hidden.add(id)
    setSections({ hidden: [...hidden] })
  }

  function row(id: SiteSectionId, index: number | null) {
    const visible = !isSectionHidden(content, id)
    return (
      <li key={id} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0, cursor: 'pointer' }}>
          <input type="checkbox" checked={visible} onChange={(event) => setVisible(id, event.target.checked)} style={{ width: '18px', height: '18px', accentColor: 'var(--wedding-color)', flexShrink: 0 }} />
          <span style={{ fontSize: '14px', fontWeight: 600, color: visible ? 'var(--fg)' : 'var(--muted-fg)', textDecoration: visible ? 'none' : 'line-through' }}>
            {SITE_SECTION_LABELS[id]}
          </span>
        </label>
        {index !== null && (
          <>
            <button type="button" aria-label={`Subir ${SITE_SECTION_LABELS[id]}`} disabled={index === 0} onClick={() => move(index, -1)} style={{ ...iconButtonStyle, opacity: index === 0 ? 0.35 : 1 }}><ArrowUpIcon /></button>
            <button type="button" aria-label={`Descer ${SITE_SECTION_LABELS[id]}`} disabled={index === order.length - 1} onClick={() => move(index, 1)} style={{ ...iconButtonStyle, opacity: index === order.length - 1 ? 0.35 : 1 }}><ArrowDownIcon /></button>
          </>
        )}
      </li>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p style={noticeStyle}>A capa fica sempre no topo e o rodapé no fim. Uma seção só aparece no site quando tem conteúdo, mesmo marcada.</p>
      <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }} aria-label="Ordem das seções">
        {order.map((id, index) => row(id, index))}
      </ol>
      {hideOnly.length > 0 && (
        <div>
          <p style={labelStyle}>Na capa</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>{hideOnly.map((id) => row(id, null))}</ul>
        </div>
      )}
      {content.sections?.order && (
        <button type="button" onClick={() => setSections({ order: undefined })} style={{ ...secondaryButtonStyle, alignSelf: 'flex-start' }}>Voltar à ordem original do estilo</button>
      )}
    </div>
  )
}

// ───────────────────────── Dúvidas e hospedagem ─────────────────────────

function ListControls({ index, total, label, onMove, onRemove }: { index: number; total: number; label: string; onMove: (direction: -1 | 1) => void; onRemove: () => void }) {
  return (
    <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
      <button type="button" aria-label={`Subir ${label}`} disabled={index === 0} onClick={() => onMove(-1)} style={{ ...iconButtonStyle, opacity: index === 0 ? 0.35 : 1 }}><ArrowUpIcon /></button>
      <button type="button" aria-label={`Descer ${label}`} disabled={index === total - 1} onClick={() => onMove(1)} style={{ ...iconButtonStyle, opacity: index === total - 1 ? 0.35 : 1 }}><ArrowDownIcon /></button>
      <button type="button" aria-label={`Remover ${label}`} onClick={onRemove} style={{ ...iconButtonStyle, color: dangerColor }}><TrashIcon /></button>
    </div>
  )
}

function moved<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction
  if (target < 0 || target >= items.length) return items
  const next = [...items]
  const [item] = next.splice(index, 1)
  if (item !== undefined) next.splice(target, 0, item)
  return next
}

export function InformacoesSection({ draft, planId, onChange }: { draft: SiteDraft; planId: PlanId; onChange: DraftUpdater }) {
  const access = siteFeatureAccess(planId)
  const faq = draft.content.faq ?? []
  const lodging = draft.content.lodging ?? []
  const richText = draft.content.rich_text === true

  const setFaq = (next: SiteFaqItem[]) => patchContent(onChange, { faq: next.length > 0 ? next : undefined })
  const setLodging = (next: SiteLodgingItem[]) => patchContent(onChange, { lodging: next.length > 0 ? next : undefined })
  const updateFaq = (index: number, patch: Partial<SiteFaqItem>) => setFaq(faq.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  const updateLodging = (index: number, patch: Partial<SiteLodgingItem>) => setLodging(lodging.map((item, i) => (i === index ? { ...item, ...patch } : item)))

  return (
    <div className="flex flex-col gap-4">
      <EditorGroup title="Perguntas frequentes" summary={`${faq.length}/${FAQ_LIMITS.items}`}>
        <p style={{ ...hintStyle, marginTop: 0 }}>Ex.: &ldquo;Posso levar acompanhante?&rdquo;, &ldquo;Tem estacionamento?&rdquo;, &ldquo;Crianças são bem-vindas?&rdquo;.</p>
        {faq.map((item, index) => (
          <div key={index} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label htmlFor={`site-faq-q-${index}`} style={labelStyle}>Pergunta {index + 1}</label>
                <input id={`site-faq-q-${index}`} type="text" maxLength={FAQ_LIMITS.question} value={item.question} onChange={(event) => updateFaq(index, { question: event.target.value })} style={compactInputStyle} />
              </div>
              <ListControls index={index} total={faq.length} label={`pergunta ${index + 1}`} onMove={(direction) => setFaq(moved(faq, index, direction))} onRemove={() => setFaq(faq.filter((_, i) => i !== index))} />
            </div>
            <div>
              <label htmlFor={`site-faq-a-${index}`} style={labelStyle}>Resposta</label>
              <RichTextEditor id={`site-faq-a-${index}`} rows={3} maxLength={FAQ_LIMITS.answer} value={item.answer} onChange={(answer) => updateFaq(index, { answer })} markdown={richText} />
            </div>
          </div>
        ))}
        {faq.length < FAQ_LIMITS.items
          ? <button type="button" onClick={() => setFaq([...faq, { question: '', answer: '' }])} style={{ ...secondaryButtonStyle, alignSelf: 'flex-start' }}><PlusIcon /> Adicionar pergunta</button>
          : <p style={hintStyle}>Limite de {FAQ_LIMITS.items} perguntas atingido.</p>}
      </EditorGroup>

      <EditorGroup title="Hospedagem e como chegar" summary={access.lodging ? `${lodging.length}/${LODGING_LIMITS.items}` : 'Plano Ideal'}>
        <p style={{ ...hintStyle, marginTop: 0 }}>Hotéis ou pousadas próximos, com endereço, telefone e código de desconto, se houver.</p>
        {lodging.map((item, index) => (
          <div key={index} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label htmlFor={`site-lodging-name-${index}`} style={labelStyle}>Nome do local</label>
                <input id={`site-lodging-name-${index}`} type="text" maxLength={LODGING_LIMITS.name} value={item.name} disabled={!access.lodging} onChange={(event) => updateLodging(index, { name: event.target.value })} style={compactInputStyle} />
              </div>
              <ListControls index={index} total={lodging.length} label={`local ${index + 1}`} onMove={(direction) => setLodging(moved(lodging, index, direction))} onRemove={() => setLodging(lodging.filter((_, i) => i !== index))} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`site-lodging-address-${index}`} style={labelStyle}>Endereço</label>
                <input id={`site-lodging-address-${index}`} type="text" maxLength={LODGING_LIMITS.address} value={item.address ?? ''} disabled={!access.lodging} onChange={(event) => updateLodging(index, { address: event.target.value })} style={compactInputStyle} />
              </div>
              <div>
                <label htmlFor={`site-lodging-phone-${index}`} style={labelStyle}>Telefone</label>
                <input id={`site-lodging-phone-${index}`} type="tel" maxLength={LODGING_LIMITS.phone} value={item.phone ?? ''} disabled={!access.lodging} onChange={(event) => updateLodging(index, { phone: event.target.value })} style={compactInputStyle} />
              </div>
              <div>
                <label htmlFor={`site-lodging-map-${index}`} style={labelStyle}>Link do mapa (opcional)</label>
                <input id={`site-lodging-map-${index}`} type="url" inputMode="url" placeholder="https://maps.google.com/…" maxLength={LODGING_LIMITS.mapUrl} value={item.map_url ?? ''} disabled={!access.lodging} onChange={(event) => updateLodging(index, { map_url: event.target.value })} style={compactInputStyle} />
              </div>
              <div>
                <label htmlFor={`site-lodging-code-${index}`} style={labelStyle}>Código de desconto</label>
                <input id={`site-lodging-code-${index}`} type="text" maxLength={LODGING_LIMITS.discountCode} value={item.discount_code ?? ''} disabled={!access.lodging} onChange={(event) => updateLodging(index, { discount_code: event.target.value })} style={compactInputStyle} />
              </div>
            </div>
            <div>
              <label htmlFor={`site-lodging-notes-${index}`} style={labelStyle}>Observação</label>
              <RichTextEditor id={`site-lodging-notes-${index}`} rows={2} maxLength={LODGING_LIMITS.notes} value={item.notes ?? ''} onChange={(notes) => updateLodging(index, { notes })} markdown={richText} placeholder="Ex.: 10 minutos do local da festa. Reserve até 30/08." />
            </div>
            <p style={{ ...hintStyle, marginTop: 0 }}>Sem link, o site usa o endereço para abrir o mapa.</p>
          </div>
        ))}
        {!access.lodging
          ? <LockedNote />
          : lodging.length < LODGING_LIMITS.items
            ? <button type="button" onClick={() => setLodging([...lodging, { name: '' }])} style={{ ...secondaryButtonStyle, alignSelf: 'flex-start' }}><PlusIcon /> Adicionar local</button>
            : <p style={hintStyle}>Limite de {LODGING_LIMITS.items} locais atingido.</p>}
      </EditorGroup>

      <p style={{ ...hintStyle, marginTop: 0 }}>
        Ordem e visibilidade destas seções no site: aba <strong>Seções</strong>.
      </p>
    </div>
  )
}
