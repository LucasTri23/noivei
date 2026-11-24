'use client'

import { useEffect, useState } from 'react'

import { CheckIcon, XIcon } from '@/components/site/editor/icons'
import { hintStyle, inputStyle, labelStyle } from '@/components/site/editor/styles'
import { SiteSlugSchema } from '@/lib/api/validation/site.schema'
import { finalizeSiteSlug, normalizeSiteSlugInput, type SlugAvailability } from '@/lib/site/slug'

type SlugStatus =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'available' }
  | { kind: 'invalid'; message: string }
  | { kind: 'taken'; message: string; suggestion?: string }

interface SlugFieldProps {
  weddingId: string
  value:     string
  /** Endereço já salvo do casal — não precisa de checagem. */
  savedSlug: string | null
  origin:    string
  onChange:  (slug: string) => void
  /** Avisa o pai se o endereço atual pode ser salvo (formato ok e livre). */
  onValidityChange?: (valid: boolean) => void
  id?:       string
}

const CHECK_DELAY_MS = 450

/**
 * Endereço do site: normaliza enquanto o casal digita (minúsculas, sem acento, hífens)
 * e confere a disponibilidade com um pequeno atraso, mostrando ✓/✗ ao lado do campo.
 */
export default function SlugField({ weddingId, value, savedSlug, origin, onChange, onValidityChange, id = 'site-slug' }: SlugFieldProps) {
  const slug = finalizeSiteSlug(value)
  // Só o resultado da consulta à API vive em estado (indexado pelo slug consultado);
  // "inalterado", "formato inválido" e "verificando" são derivados na renderização.
  const [remote, setRemote] = useState<{ slug: string; status: SlugStatus } | null>(null)

  const parsed = slug === savedSlug ? null : SiteSlugSchema.safeParse(slug)
  const needsCheck = parsed?.success === true

  let status: SlugStatus
  if (!parsed) status = { kind: 'idle' }
  else if (!parsed.success) status = { kind: 'invalid', message: parsed.error.issues[0]?.message ?? 'Endereço inválido.' }
  else status = remote?.slug === slug ? remote.status : { kind: 'checking' }

  const valid = status.kind === 'idle' || status.kind === 'available'
  useEffect(() => { onValidityChange?.(valid) }, [valid, onValidityChange])

  useEffect(() => {
    if (!needsCheck) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      fetch(`/api/v1/weddings/${weddingId}/site/slug?value=${encodeURIComponent(slug)}`, { signal: controller.signal })
        .then(async (res) => (res.ok ? ((await res.json()) as { data: SlugAvailability }).data : null))
        .then((result) => {
          // Sem resposta, não bloqueia: a API confere de novo ao salvar.
          if (!result) setRemote({ slug, status: { kind: 'idle' } })
          else if (result.available) setRemote({ slug, status: { kind: 'available' } })
          else setRemote({ slug, status: { kind: 'taken', message: result.message ?? 'Endereço indisponível.', suggestion: result.suggestion } })
        })
        .catch(() => { /* abortado por nova digitação */ })
    }, CHECK_DELAY_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [slug, needsCheck, weddingId])

  const invalid = status.kind === 'invalid' || status.kind === 'taken'
  const describedBy = `${id}-status`

  return (
    <div>
      <label htmlFor={id} style={labelStyle}>Endereço do site</label>
      <div style={{ display: 'flex', alignItems: 'stretch', border: `1.5px solid ${invalid ? 'var(--color-error)' : status.kind === 'available' ? 'var(--color-success)' : 'var(--border)'}`, borderRadius: '12px', background: 'var(--surface)', overflow: 'hidden' }}>
        <span style={{ display: 'flex', alignItems: 'center', padding: '0 0 0 14px', fontSize: '14px', color: 'var(--muted-fg)', whiteSpace: 'nowrap', maxWidth: '45%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {(origin || '').replace(/^https?:\/\//, '')}/
        </span>
        <input
          id={id}
          type="text"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={60}
          value={value}
          onChange={(e) => onChange(normalizeSiteSlugInput(e.target.value))}
          onBlur={() => { if (value !== slug) onChange(slug) }}
          placeholder="ana-e-joao"
          aria-invalid={invalid}
          aria-describedby={describedBy}
          style={{ ...inputStyle, border: 'none', borderRadius: 0, paddingLeft: '2px', minWidth: 0 }}
        />
        <span aria-hidden style={{ display: 'flex', alignItems: 'center', padding: '0 12px', color: invalid ? 'var(--color-error)' : 'var(--color-success)' }}>
          {status.kind === 'available' && <CheckIcon size={16} />}
          {invalid && <XIcon size={16} />}
          {status.kind === 'checking' && <span style={{ fontSize: '12px', color: 'var(--muted-fg)' }}>…</span>}
        </span>
      </div>
      <p id={describedBy} role="status" style={{ ...hintStyle, color: invalid ? 'var(--color-error)' : status.kind === 'available' ? 'var(--color-success)' : 'var(--muted-fg)' }}>
        {status.kind === 'checking' && 'Verificando disponibilidade…'}
        {status.kind === 'available' && 'Endereço disponível!'}
        {status.kind === 'invalid' && status.message}
        {status.kind === 'taken' && (
          <>
            {status.message}
            {status.suggestion && (
              <>
                {' '}
                <button
                  type="button"
                  onClick={() => onChange(status.suggestion as string)}
                  style={{ border: 'none', background: 'none', padding: 0, color: 'var(--wedding-color-dark)', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', fontSize: 'inherit' }}
                >
                  Usar {status.suggestion}
                </button>
              </>
            )}
          </>
        )}
        {status.kind === 'idle' && 'Letras minúsculas, números e hífens. É o link que vocês vão enviar aos convidados.'}
      </p>
    </div>
  )
}
