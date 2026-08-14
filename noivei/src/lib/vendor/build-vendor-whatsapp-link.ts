// Mesma técnica de src/lib/rsvp/build-whatsapp-link.ts (wa.me só aceita dígitos no
// parâmetro de telefone) — não reimportado de lá de propósito: é um domínio
// diferente (fornecedor, não RSVP) e a função é pequena o bastante pra não valer
// acoplar os dois módulos por uma linha de regex.
function normalizePhoneForWhatsApp(phone: string): string {
  return phone.replace(/\D/g, '')
}

/**
 * Monta a URL do wa.me para o casal iniciar contato direto com o fornecedor a
 * partir do perfil público (/profissionais/[slug]). Só deve ser chamada quando
 * `vendor_profiles.show_whatsapp` for true e `whatsapp` estiver preenchido — a
 * checagem de exibição fica a cargo de quem renderiza o botão, não desta function.
 */
export function buildVendorWhatsAppUrl(params: { businessName: string; whatsapp: string }): string {
  const { businessName, whatsapp } = params
  const digits  = normalizePhoneForWhatsApp(whatsapp)
  const message = `Olá! Vi o perfil de ${businessName} no Wednest e gostaria de saber mais sobre os serviços.`

  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}
