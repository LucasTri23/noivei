'use client'

import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

interface CheckinScannerProps {
  weddingId:             string
  initialConfirmedTotal: number
  initialArrivedCount:   number
}

interface ValidateOkData {
  guest_name:          string
  party_size:          number
}

interface ApiErrorBody {
  error?: { code?: string; message?: string }
}

type ScanState =
  | { kind: 'idle' }
  | { kind: 'success'; guestName: string; partySize: number }
  | { kind: 'error'; message: string }

// Elemento onde a html5-qrcode monta o preview de vídeo — precisa de um id fixo,
// a lib procura o elemento pelo DOM diretamente.
const READER_ELEMENT_ID = 'checkin-qr-reader'

// Depois de um scan válido, ignora o MESMO token por essa janela — a câmera
// continua enxergando o mesmo QR code por vários frames enquanto o convidado
// ainda não afastou o celular, e sem isso cada frame gera uma nova chamada à API.
const RESCAN_COOLDOWN_MS = 4000

export default function CheckinScanner({ weddingId, initialConfirmedTotal, initialArrivedCount }: CheckinScannerProps) {
  const [scanState, setScanState]     = useState<ScanState>({ kind: 'idle' })
  const [arrivedCount, setArrivedCount] = useState(initialArrivedCount)
  const [cameraError, setCameraError]   = useState<string | null>(null)

  const processingRef    = useRef(false)
  const lastTokenRef      = useRef<string | null>(null)
  const lastTokenTimeRef  = useRef(0)

  // Câmera liga uma vez ao montar e fica ligada durante toda a sessão de scan —
  // ferramenta de balcão de entrada, usada dezenas/centenas de vezes seguidas, não
  // uma ação de disparo único.
  useEffect(() => {
    let cancelled = false
    const scanner = new Html5Qrcode(READER_ELEMENT_ID)

    async function handleScan(token: string) {
      const now = Date.now()
      if (processingRef.current) return
      if (token === lastTokenRef.current && now - lastTokenTimeRef.current < RESCAN_COOLDOWN_MS) return

      processingRef.current = true
      lastTokenRef.current = token
      lastTokenTimeRef.current = now

      try {
        const res = await fetch(`/api/v1/weddings/${weddingId}/checkin/validate`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ token }),
        })

        const body = (await res.json().catch(() => null)) as ({ data?: ValidateOkData } & ApiErrorBody) | null

        if (!res.ok) {
          setScanState({ kind: 'error', message: body?.error?.message ?? 'Não foi possível validar este ingresso.' })
          return
        }

        const data = body?.data
        if (!data) {
          setScanState({ kind: 'error', message: 'Resposta inesperada do servidor.' })
          return
        }

        setScanState({ kind: 'success', guestName: data.guest_name, partySize: data.party_size })
        setArrivedCount((prev) => prev + 1)
      } catch {
        setScanState({ kind: 'error', message: 'Falha de conexão. Tente novamente.' })
      } finally {
        processingRef.current = false
      }
    }

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 250 },
        (decodedText) => {
          if (!cancelled) void handleScan(decodedText)
        },
        () => {
          // Chamado a cada frame sem QR code decodificado — ruído normal, sem ação.
        },
      )
      .catch(() => {
        if (!cancelled) {
          setCameraError('Não foi possível acessar a câmera. Confira as permissões do navegador e tente novamente.')
        }
      })

    return () => {
      cancelled = true
      scanner
        .stop()
        .catch(() => {})
        .finally(() => scanner.clear())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- câmera deve iniciar uma única vez, ao montar
  }, [])

  const resultTheme = (() => {
    if (scanState.kind === 'success') return { bg: '#E9EFE6', color: '#5E8B6A' }
    if (scanState.kind === 'error')   return { bg: '#F6E4DE', color: '#C0553F' }
    return null
  })()

  return (
    <div>
      {/* Contador "X de Y confirmados já chegaram" */}
      <div
        className="mb-5 rounded-2xl bg-[var(--surface)] p-5"
        style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)' }}
      >
        <div style={{ fontSize: '12.5px', color: 'var(--muted-fg)', fontWeight: 600 }}>Chegaram</div>
        <div className="font-display" style={{ fontSize: '32px', fontWeight: 600, color: 'var(--fg)', lineHeight: 1.15 }}>
          {arrivedCount}{' '}
          <span style={{ fontSize: '17px', color: 'var(--muted-fg)', fontWeight: 500 }}>
            de {initialConfirmedTotal} confirmados
          </span>
        </div>
      </div>

      {/* Preview da câmera */}
      <div className="overflow-hidden rounded-2xl" style={{ boxShadow: '0 8px 22px rgba(60,40,24,0.06)', background: '#000' }}>
        <div id={READER_ELEMENT_ID} style={{ width: '100%' }} />
      </div>

      {cameraError && (
        <div
          className="mt-4 rounded-2xl p-4"
          style={{ background: '#F6E4DE', color: '#C0553F', fontSize: '14px', fontWeight: 600, lineHeight: 1.5 }}
        >
          {cameraError}
        </div>
      )}

      {/* Resultado do último scan — fica visível até o próximo scan, câmera segue ligada */}
      {resultTheme && (
        <div
          className="mt-4 rounded-2xl p-6 text-center"
          style={{ background: resultTheme.bg, color: resultTheme.color }}
        >
          {scanState.kind === 'success' && (
            <>
              <div style={{ fontSize: '34px' }}>✓</div>
              <div className="font-display" style={{ fontSize: '24px', fontWeight: 600, marginTop: '6px' }}>
                {scanState.guestName} chegou!
              </div>
              {scanState.partySize > 1 && (
                <p style={{ fontSize: '13.5px', marginTop: '4px', margin: '4px 0 0' }}>
                  Convite para até {scanState.partySize} pessoas
                </p>
              )}
            </>
          )}
          {scanState.kind === 'error' && (
            <>
              <div style={{ fontSize: '34px' }}>✕</div>
              <div className="font-display" style={{ fontSize: '21px', fontWeight: 600, marginTop: '6px' }}>
                {scanState.message}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
