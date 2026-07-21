// Compara dois telefones ignorando formatação (espaços, parênteses, hífen, +) e
// tolerando a diferença de ter ou não o código do país (55) na frente — o casal
// pode ter cadastrado "(11) 99999-9999" e o convidado digitar "+55 11 99999-9999"
// (ou vice-versa), e isso ainda deve contar como o mesmo número.
function onlyDigits(phone: string): string {
  return phone.replace(/\D/g, '')
}

export function phonesMatch(a: string, b: string): boolean {
  const digitsA = onlyDigits(a)
  const digitsB = onlyDigits(b)

  if (digitsA === digitsB) return true

  const withoutCountryCode = (digits: string) => (digits.startsWith('55') ? digits.slice(2) : digits)
  return withoutCountryCode(digitsA) === withoutCountryCode(digitsB)
}
