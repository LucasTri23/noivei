'use client'

import { useState } from 'react'
import Modal from '@/components/ui/modal'
import Spinner from '@/components/ui/spinner'
import { toastError } from '@/store/toast.store'

interface GiftPaymentButtonProps {
  giftId:   string
  giftName: string
}

// Botão do convidado (anônimo, sem conta) na lista de presentes pública — cria um
// checkout no Mercado Pago que paga direto na conta do casal (ver
// /api/v1/gifts/[id]/checkout) e redireciona pro pagamento.
export default function GiftPaymentButton({ giftId, giftName }: GiftPaymentButtonProps) {
  const [open, setOpen]       = useState(false)
  const [guestName, setGuestName] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setLoading(true)

    try {
      const res = await fetch(`/api/v1/gifts/${giftId}/checkout`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ guest_name: guestName.trim() || null }),
      })
      const body = (await res.json().catch(() => null)) as { data?: { redirect_url: string }; error?: { message: string } } | null

      if (!res.ok || !body?.data?.redirect_url) {
        setLoading(false)
        toastError(body?.error?.message ?? 'Não foi possível iniciar o pagamento. Tente novamente.')
        return
      }

      window.location.assign(body.data.redirect_url)
    } catch {
      // fetch rejeitado (rede caiu, etc.) — sem isso, loading nunca voltava a false e o
      // botão ficava preso em "Aguarde…" pra sempre, sem nenhuma mensagem de erro.
      setLoading(false)
      toastError('Não foi possível iniciar o pagamento. Verifique sua conexão e tente novamente.')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          fontSize: '11.5px', fontWeight: 700, color: 'var(--wedding-color)',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline',
        }}
      >
        Presentear pelo app
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Presentear">
        <form onSubmit={handleConfirm} className="flex flex-col gap-4">
          <p style={{ fontSize: '14px', color: 'var(--muted-fg)', margin: 0 }}>
            Você vai presentear &ldquo;{giftName}&rdquo;. Depois de confirmar, você será levado ao pagamento
            seguro do Mercado Pago.
          </p>
          <div>
            <label htmlFor="guest-name" style={{ fontSize: '13px', fontWeight: 600, color: '#3C2818', display: 'block', marginBottom: '6px' }}>
              Seu nome (aparece para o casal)
            </label>
            <input
              id="guest-name"
              type="text"
              maxLength={120}
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Seu nome"
              style={{
                border: '1.5px solid #EBDDD0', borderRadius: '12px', padding: '11px 14px',
                fontSize: '14px', color: '#3C2818', outline: 'none', width: '100%',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ background: 'transparent', color: '#9A7A60', border: 'none', fontWeight: 600, fontSize: '14px', cursor: 'pointer', padding: '10px 14px' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'var(--wedding-color)', color: '#fff', border: 'none',
                borderRadius: '12px', padding: '10px 18px', fontWeight: 600, fontSize: '14px',
                cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1,
              }}
            >
              {loading && <Spinner color="#fff" />}
              {loading ? 'Aguarde…' : 'Ir para o pagamento'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
