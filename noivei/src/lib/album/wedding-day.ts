// yyyy-mm-dd, yyyy-mm-dd → diferença inteira de dias (toISO - fromISO) usando
// Date.UTC pros dois lados — as strings já são datas puras (America/Sao_Paulo,
// resolvidas pelo caller), então isso nunca sofre off-by-one por fuso/DST.
// Mesma técnica usada em daysBetween de
// src/app/api/cron/notify-wedding-milestones/route.ts — reaproveitada aqui em
// vez de importada porque aquele arquivo é uma Route Handler (não uma lib), e
// não deve ser importado por fora do próprio módulo da rota.
function daysBetween(fromISO: string, toISO: string): number {
  const [fy = 0, fm = 1, fd = 1] = fromISO.split('-').map(Number)
  const [ty = 0, tm = 1, td = 1] = toISO.split('-').map(Number)
  const fromUTC = Date.UTC(fy, fm - 1, fd)
  const toUTC = Date.UTC(ty, tm - 1, td)
  return Math.round((toUTC - fromUTC) / 86_400_000)
}

// Janela de upload do álbum: aberta no dia do casamento e no dia seguinte
// (inclusive nos dois extremos) — dá tempo do casal e dos convidados
// terminarem de subir fotos tiradas até tarde da noite/virada, sem abrir a
// janela indefinidamente. "Hoje" em America/Sao_Paulo, no mesmo formato
// yyyy-mm-dd da coluna DATE weddings.wedding_date — comparar direto como
// string evita qualquer parsing de Date (e o off-by-one que isso causaria
// perto da meia-noite: o servidor roda em UTC na Vercel, então "hoje" em UTC
// pode já ser amanhã ou ainda ontem em horário de Brasília). Mesmo padrão de
// fuso usado no cron notify-wedding-milestones.
export function isAlbumUploadWindowOpen(weddingDate: string | null): boolean {
  if (!weddingDate) return false

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
  const diff = daysBetween(weddingDate, today)
  return diff >= 0 && diff <= 1
}
