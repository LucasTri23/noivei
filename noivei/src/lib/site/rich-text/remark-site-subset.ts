// Plugins remark do Markdown básico dos sites de casamento.
//
// remarkSiteSubset desliga, no próprio parser (micromark), tudo que não é
// negrito/itálico/tachado/link/parágrafo: títulos, listas, citações, código,
// imagens, tabelas, HTML etc. Assim um texto como "- item" ou "# 1" continua
// aparecendo literalmente, em vez de virar estrutura que o template não prevê.
//
// remarkSoftBreaks converte cada quebra de linha simples em <br>, reproduzindo
// o white-space: pre-line que os templates sempre usaram.

interface MdNode {
  type:      string
  value?:    string
  children?: MdNode[]
}

const DISABLED_CONSTRUCTS = [
  'autolink',
  'blockQuote',
  'codeFenced',
  'codeIndented',
  'codeText',
  'definition',
  'gfmFootnoteCall',
  'gfmFootnoteDefinition',
  'gfmPotentialFootnoteCall',
  'headingAtx',
  'htmlFlow',
  'htmlText',
  'labelStartImage',
  'list',
  'setextUnderline',
  'table',
  'tasklistCheck',
  'thematicBreak',
]

// `this` é o Processor do unified; tipado de forma mínima para não acoplar a
// versão dos tipos do unified usados pelo react-markdown.
export function remarkSiteSubset(this: unknown): void {
  const data = (this as { data(): Record<string, unknown> }).data()
  const extensions = (data.micromarkExtensions ??= []) as unknown[]
  extensions.push({ disable: { null: DISABLED_CONSTRUCTS } })
}

function splitSoftBreaks(nodes: MdNode[]): MdNode[] {
  const result: MdNode[] = []
  for (const node of nodes) {
    if (node.type === 'text' && node.value?.includes('\n')) {
      node.value.split(/\r?\n/).forEach((part, index) => {
        if (index > 0) result.push({ type: 'break' })
        if (part) result.push({ type: 'text', value: part })
      })
      continue
    }
    if (node.children) node.children = splitSoftBreaks(node.children)
    result.push(node)
  }
  return result
}

export function remarkSoftBreaks() {
  return (tree: MdNode) => {
    if (tree.children) tree.children = splitSoftBreaks(tree.children)
  }
}
