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
