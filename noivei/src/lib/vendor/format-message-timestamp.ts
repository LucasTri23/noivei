// Hoje: só hora ("14:32"). Outro dia: data curta + hora ("13 ago, 14:32") — mesmo
// raciocínio de datas relativas já usado em outras telas do app (ex.: mural de
// fotos), sem introduzir uma lib de datas nova só pra isto.
export function formatMessageTimestamp(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (isToday) return time

  const day = date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
  return `${day}, ${time}`
}
