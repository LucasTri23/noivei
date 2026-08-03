export const DEFAULT_RSVP_MESSAGE_TEMPLATE =
  'Oi {nome}! Estamos organizando nosso casamento e adoraríamos contar com você 💍 Confirma sua presença aqui: {link}'

/** Substitui os placeholders {nome} e {link} do template configurável em Perfil. */
export function fillRsvpMessageTemplate(template: string, name: string, link: string): string {
  return template.replaceAll('{nome}', name).replaceAll('{link}', link)
}

/** Remove tudo que não for dígito — WhatsApp aceita apenas números no parâmetro de telefone da wa.me. */
export function normalizePhoneForWhatsApp(phone: string): string {
  return phone.replace(/\D/g, '')
}

/**
 * Monta a URL do wa.me para enviar o convite de RSVP.
 * Sem telefone, abre o WhatsApp sem destinatário pré-selecionado (usuário escolhe o contato manualmente).
 */
export function buildRsvpWhatsAppUrl(params: {
  guestName:    string
  guestPhone:   string | null
  rsvpLink:     string
  messageTemplate: string | null
}): string {
  const { guestName, guestPhone, rsvpLink, messageTemplate } = params
  const message = fillRsvpMessageTemplate(messageTemplate ?? DEFAULT_RSVP_MESSAGE_TEMPLATE, guestName, rsvpLink)
  const digits  = guestPhone ? normalizePhoneForWhatsApp(guestPhone) : ''

  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

// Diferente de rsvp_message_template (editável em Perfil), o texto do convite de
// ingresso é fixo — fora de escopo tornar configurável por enquanto.
export const DEFAULT_CHECKIN_MESSAGE_TEMPLATE =
  'Oi {nome}! Aqui está seu ingresso para o nosso casamento — é só mostrar este QR code na entrada 💍 {link}'

/**
 * Monta a URL do wa.me para enviar o ingresso (QR code) de check-in.
 * Sem telefone, abre o WhatsApp sem destinatário pré-selecionado (usuário escolhe o contato manualmente).
 */
export function buildCheckinWhatsAppUrl(params: {
  guestName:  string
  guestPhone: string | null
  ticketLink: string
}): string {
  const { guestName, guestPhone, ticketLink } = params
  const message = fillRsvpMessageTemplate(DEFAULT_CHECKIN_MESSAGE_TEMPLATE, guestName, ticketLink)
  const digits  = guestPhone ? normalizePhoneForWhatsApp(guestPhone) : ''

  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

/**
 * Monta a URL do wa.me para o casal compartilhar o link/QR do mural de fotos.
 * Sem destinatário fixo (o mesmo link é anunciado pra vários grupos/contatos,
 * diferente do RSVP acima que é 1 convidado por link) — abre o WhatsApp sem
 * contato pré-selecionado, mesmo fallback de `buildRsvpWhatsAppUrl` sem telefone.
 */
export function buildAlbumWhatsAppUrl(params: { coupleNames: string; albumLink: string }): string {
  const { coupleNames, albumLink } = params
  const message = `${coupleNames} preparou um mural de fotos do casamento! 📸 Tire fotos no evento e envie por aqui: ${albumLink}`

  return `https://wa.me/?text=${encodeURIComponent(message)}`
}
