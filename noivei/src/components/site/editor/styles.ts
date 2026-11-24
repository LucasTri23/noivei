// Estilos compartilhados por todo o editor do site — só tokens do tema (globals.css)
// e da cor do casal, nunca cores fixas, para o editor acompanhar o tema escuro e
// todos os campos terem a mesma aparência entre as abas.

export const inputStyle: React.CSSProperties = {
  border: '1.5px solid var(--border)', borderRadius: '12px', padding: '12px 14px',
  fontSize: '15px', color: 'var(--fg)', background: 'var(--surface)', width: '100%',
  fontFamily: 'var(--font-body)',
  // Sem `outline: 'none'`: estilo inline venceria o :focus-visible global e quem navega
  // pelo teclado perderia o indicador de foco.
}

export const compactInputStyle: React.CSSProperties = {
  ...inputStyle, borderRadius: '10px', padding: '9px 11px', fontSize: '14px', minWidth: 0,
}

export const textareaStyle: React.CSSProperties = { ...inputStyle, resize: 'vertical' }

export const labelStyle: React.CSSProperties = {
  fontSize: '13px', fontWeight: 600, color: 'var(--fg)', marginBottom: '6px', display: 'block',
}

export const hintStyle: React.CSSProperties = {
  fontSize: '12.5px', color: 'var(--muted-fg)', margin: '6px 0 0', lineHeight: 1.5,
}

export const cardStyle: React.CSSProperties = {
  border: '1.5px solid var(--border)', borderRadius: '14px', padding: '14px', background: 'var(--surface)',
}

export const noticeStyle: React.CSSProperties = {
  fontSize: '12.5px', color: 'var(--wedding-color-dark)', background: 'var(--wedding-color-subtle)',
  borderRadius: '10px', padding: '10px 12px', margin: 0, lineHeight: 1.5,
}

export const primaryButtonStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
  background: 'var(--wedding-color)', color: 'var(--wedding-color-fg, #fff)', border: 'none',
  borderRadius: '12px', padding: '11px 20px', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
  textDecoration: 'none',
}

export const secondaryButtonStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
  background: 'var(--wedding-color-subtle)', color: 'var(--wedding-color-dark)', border: 'none',
  borderRadius: '12px', padding: '10px 16px', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
  textDecoration: 'none',
}

export const ghostButtonStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
  minWidth: '36px', minHeight: '36px', padding: '0 10px', border: '1px solid var(--border)', borderRadius: '9px',
  background: 'var(--surface)', color: 'var(--fg)', cursor: 'pointer', fontSize: '13px',
}

export const iconButtonStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: '36px', height: '36px', border: 'none', borderRadius: '9px', padding: 0,
  background: 'transparent', color: 'var(--wedding-color-dark)', cursor: 'pointer', flexShrink: 0,
}

export const dangerColor = 'var(--color-error)'

export function disabledStyle(disabled: boolean): React.CSSProperties {
  return disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}
}
