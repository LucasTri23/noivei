// Operações dos botões do editor sobre o texto + seleção do <textarea>. Puras
// (sem DOM) para poder testar: recebem valor e seleção, devolvem os novos.

export interface TextSelectionState {
  value: string
  start: number
  end:   number
}

export type InlineMarker = '**' | '*' | '~~'

const PLACEHOLDER: Record<InlineMarker, string> = { '**': 'texto em negrito', '*': 'texto em itálico', '~~': 'texto tachado' }

/**
 * Envolve a seleção com o marcador (ou remove, se já estiver envolvida).
 * Espaços nas pontas da seleção ficam fora do marcador — "** texto**" não é
 * negrito em Markdown. Sem seleção, insere um texto de exemplo selecionado.
 */
export function toggleInlineFormat(state: TextSelectionState, marker: InlineMarker): TextSelectionState {
  const { value } = state
  let start = Math.min(state.start, state.end)
  let end   = Math.max(state.start, state.end)

  while (start < end && /\s/.test(value[start] ?? '')) start++
  while (end > start && /\s/.test(value[end - 1] ?? '')) end--

  const before = value.slice(0, start)
  const after  = value.slice(end)
  const len    = marker.length

  // Já formatado com exatamente este marcador → remove. Para '*', não confundir
  // com '**' (negrito): o caractere antes/depois do marcador não pode ser '*'.
  const wrapped = before.endsWith(marker) && after.startsWith(marker)
    && (marker !== '*' || (!before.endsWith('**') || before.endsWith('***')) && (!after.startsWith('**') || after.startsWith('***')))
  if (wrapped && start !== end) {
    return {
      value: before.slice(0, -len) + value.slice(start, end) + after.slice(len),
      start: start - len,
      end:   end - len,
    }
  }

  const selected = value.slice(start, end) || PLACEHOLDER[marker]
  return {
    value: `${before}${marker}${selected}${marker}${after}`,
    start: start + len,
    end:   start + len + selected.length,
  }
}

/** Transforma a seleção em [texto](https://) e seleciona o endereço para digitar. */
export function insertLink(state: TextSelectionState): TextSelectionState {
  const start = Math.min(state.start, state.end)
  const end   = Math.max(state.start, state.end)
  const label = state.value.slice(start, end).trim() || 'texto do link'
  const urlPlaceholder = 'https://'
  const snippet = `[${label}](${urlPlaceholder})`
  const urlStart = start + label.length + 3

  return {
    value: state.value.slice(0, start) + snippet + state.value.slice(end),
    start: urlStart,
    end:   urlStart + urlPlaceholder.length,
  }
}
