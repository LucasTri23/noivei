import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { remarkSiteSubset, remarkSoftBreaks } from '@/lib/site/rich-text/remark-site-subset'
import { toSafeLinkHref } from '@/lib/site/rich-text/safe-url'
import { cn } from '@/lib/utils/cn'

import styles from './site-rich-text.module.css'

interface SiteRichTextProps {
  text:      string
  /** content.rich_text do site — false mantém exatamente a marcação original. */
  markdown:  boolean
  className?: string
  style?:     React.CSSProperties
}

const ALLOWED_ELEMENTS = ['p', 'br', 'strong', 'em', 'del', 'a']

const components: Components = {
  a: ({ href, children }) => {
    const safe = toSafeLinkHref(href)
    if (!safe) return <span>{children}</span>
    return (
      <a href={safe} target="_blank" rel="noopener noreferrer nofollow ugc">
        {children}
      </a>
    )
  },
}

/**
 * Renderizador único dos textos personalizáveis do site — usado no site
 * público e na pré-visualização do editor. Com `markdown` desligado devolve o
 * mesmo <p> de sempre (sites existentes não mudam). Ligado, aceita só negrito,
 * itálico, tachado, links http(s)/mailto e parágrafos/quebras; HTML do texto
 * nunca é interpretado.
 */
export default function SiteRichText({ text, markdown, className, style }: SiteRichTextProps) {
  if (!markdown) return <p className={className} style={style}>{text}</p>

  return (
    // white-space: normal — as quebras viram <br>; pre-line aqui renderizaria
    // as quebras de linha entre os parágrafos gerados como linhas vazias.
    <div className={cn(styles.root, className)} style={{ ...style, whiteSpace: 'normal' }}>
      <Markdown
        remarkPlugins={[remarkSiteSubset, [remarkGfm, { singleTilde: false }], remarkSoftBreaks]}
        allowedElements={ALLOWED_ELEMENTS}
        unwrapDisallowed
        skipHtml
        urlTransform={(url) => toSafeLinkHref(url) ?? ''}
        components={components}
      >
        {text}
      </Markdown>
    </div>
  )
}
