// "Hoje" em America/Sao_Paulo, no mesmo formato yyyy-mm-dd da coluna DATE
// weddings.wedding_date — comparar direto como string evita qualquer parsing
// de Date (e o off-by-one que isso causaria perto da meia-noite: o servidor
// roda em UTC na Vercel, então "hoje" em UTC pode já ser amanhã ou ainda ontem
// em horário de Brasília). Mesmo padrão de fuso usado no cron
// notify-wedding-milestones — só que aqui não precisamos de diferença de dias,
// só saber se É hoje.
export function isTodayWeddingDay(weddingDate: string | null): boolean {
  if (!weddingDate) return false

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
  return today === weddingDate
}
