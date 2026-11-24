'use client'

/* eslint-disable @next/next/no-img-element -- URL do Storage, sem domínio fixo para configurar no next/image */
import { useRef, useState } from 'react'

import Spinner from '@/components/ui/spinner'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import { MonitorIcon, PhoneIcon, TrashIcon, UploadIcon } from '@/components/site/editor/icons'
import { hintStyle, labelStyle, secondaryButtonStyle, ghostButtonStyle, dangerColor } from '@/components/site/editor/styles'
import { coverPhotoZoomScale } from '@/lib/site/cover-photo-zoom'

type Device = 'desktop' | 'mobile'

interface CoverPhotoEditorProps {
  url:        string | null
  position:   number
  zoom:       number
  uploading:  boolean
  onPosition: (value: number) => void
  onZoom:     (value: number) => void
  onPickFile: (file: File) => void
  onRemove:   () => void
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)))
}

function positionLabel(value: number): string {
  if (value === 0) return 'topo'
  if (value === 100) return 'base'
  if (value === 50) return 'centro'
  return `${value}%`
}

/**
 * Foto de capa com enquadramento direto na imagem: o casal arrasta a foto para cima
 * ou para baixo (ou usa as setas do teclado) e vê o resultado no formato da capa no
 * computador e no celular, em vez de ajustar um slider olhando uma faixa de 150px.
 */
export default function CoverPhotoEditor({ url, position, zoom, uploading, onPosition, onZoom, onPickFile, onRemove }: CoverPhotoEditorProps) {
  const [device, setDevice] = useState<Device>('desktop')
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dragStart = useRef<{ y: number; position: number; height: number } | null>(null)
  const showUploadSpinner = useDelayedLoading(uploading)

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStart.current = { y: e.clientY, position, height: e.currentTarget.getBoundingClientRect().height }
    setDragging(true)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const start = dragStart.current
    if (!start) return
    // Arrastar a foto para baixo revela mais do topo dela → posição menor.
    const delta = ((e.clientY - start.y) / start.height) * 100 * 1.4
    onPosition(clamp(start.position - delta))
  }

  function handlePointerUp() {
    dragStart.current = null
    setDragging(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 10 : 2
    if (e.key === 'ArrowUp') { e.preventDefault(); onPosition(clamp(position - step)) }
    if (e.key === 'ArrowDown') { e.preventDefault(); onPosition(clamp(position + step)) }
    if (e.key === 'Home') { e.preventDefault(); onPosition(0) }
    if (e.key === 'End') { e.preventDefault(); onPosition(100) }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) onPickFile(file)
  }

  const fileInput = <input ref={inputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />

  if (!url) {
    return (
      <div>
        <span style={labelStyle}>Foto de capa</span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%',
            minHeight: '150px', borderRadius: '14px', border: '1.5px dashed var(--border)', background: 'var(--muted)',
            color: 'var(--wedding-color-dark)', fontWeight: 600, fontSize: '14px', cursor: uploading ? 'wait' : 'pointer',
          }}
        >
          {showUploadSpinner ? <Spinner color="var(--wedding-color-dark)" /> : <UploadIcon size={22} />}
          {uploading ? 'Enviando…' : 'Enviar foto de capa'}
          <span style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--muted-fg)' }}>Uma foto na horizontal fica melhor, mas qualquer formato funciona.</span>
        </button>
        {fileInput}
      </div>
    )
  }

  const frameStyle: React.CSSProperties = device === 'desktop'
    ? { width: '100%', aspectRatio: '16 / 9' }
    : { width: 'min(200px, 60%)', aspectRatio: '9 / 16', margin: '0 auto' }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
        <span style={{ ...labelStyle, marginBottom: 0 }}>Foto de capa</span>
        <div role="radiogroup" aria-label="Prévia do enquadramento" style={{ display: 'flex', gap: '4px' }}>
          {(['desktop', 'mobile'] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={device === option}
              onClick={() => setDevice(option)}
              style={{
                ...ghostButtonStyle, fontSize: '12.5px',
                background: device === option ? 'var(--wedding-color-subtle)' : 'var(--surface)',
                color: device === option ? 'var(--wedding-color-dark)' : 'var(--muted-fg)',
                fontWeight: device === option ? 700 : 500,
              }}
            >
              {option === 'desktop' ? <MonitorIcon /> : <PhoneIcon />}
              {option === 'desktop' ? 'Computador' : 'Celular'}
            </button>
          ))}
        </div>
      </div>

      <div
        role="slider"
        tabIndex={0}
        aria-label="Posição vertical da foto de capa — arraste ou use as setas"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={position}
        aria-valuetext={positionLabel(position)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        style={{
          ...frameStyle, position: 'relative', overflow: 'hidden', borderRadius: '14px',
          border: '1.5px solid var(--border)', background: 'var(--muted)',
          cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none', userSelect: 'none',
        }}
      >
        <img
          src={url}
          alt="Foto de capa"
          draggable={false}
          style={{
            width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none',
            objectPosition: `center ${position}%`,
            transform: `scale(${coverPhotoZoomScale(zoom)})`,
            transformOrigin: `center ${position}%`,
          }}
        />
        <span
          aria-hidden
          style={{
            position: 'absolute', left: '50%', bottom: '10px', transform: 'translateX(-50%)',
            padding: '4px 10px', borderRadius: '99px', background: 'rgba(20,12,4,0.6)', color: '#fff',
            fontSize: '11.5px', fontWeight: 600, whiteSpace: 'nowrap', opacity: dragging ? 0 : 1, transition: 'opacity 0.2s',
          }}
        >
          ↕ Arraste para enquadrar
        </span>
      </div>
      <p style={hintStyle}>
        Prévia aproximada da capa no {device === 'desktop' ? 'computador' : 'celular'} · posição: {positionLabel(position)}. Confira o resultado final em &ldquo;Pré-visualizar&rdquo;.
      </p>

      <div style={{ marginTop: '12px' }}>
        <label htmlFor="site-cover-zoom" style={{ ...labelStyle, marginBottom: '4px' }}>Zoom</label>
        <input
          id="site-cover-zoom"
          type="range"
          min={0}
          max={100}
          value={zoom}
          onChange={(e) => onZoom(Number(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--wedding-color)' }}
        />
        <p style={{ ...hintStyle, marginTop: '2px' }}>{zoom === 0 ? 'Sem zoom extra' : `${zoom}% de zoom`}</p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} style={{ ...secondaryButtonStyle, cursor: uploading ? 'wait' : 'pointer' }}>
          {showUploadSpinner ? <Spinner color="var(--wedding-color-dark)" /> : <UploadIcon />}
          {uploading ? 'Enviando…' : 'Trocar foto'}
        </button>
        <button type="button" onClick={onRemove} disabled={uploading} style={{ ...ghostButtonStyle, color: dangerColor, fontWeight: 600, fontSize: '14px', padding: '0 14px' }}>
          <TrashIcon /> Remover
        </button>
      </div>
      {fileInput}
    </div>
  )
}
