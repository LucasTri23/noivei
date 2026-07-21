import { ImportGuestRowSchema, type ImportGuestRow } from '@/lib/api/validation/guest.schema'

// Espelha o limite e o parsing de `POST /api/v1/weddings/[wid]/guests/import` — usado só
// para preview no client. O server continua sendo a autoridade de validação (nunca confiar
// no resultado deste parser como se fosse a validação final).
export const IMPORT_MAX_ROWS = 500

export interface ParsedImportRow {
  line:  number
  guest: ImportGuestRow
}

export interface ImportRowError {
  line:    number
  message: string
}

export interface ParseImportCsvResult {
  totalRows:   number
  tooManyRows: boolean
  validRows:   ParsedImportRow[]
  invalidRows: ImportRowError[]
}

export function parseImportCsv(csv: string): ParseImportCsvResult {
  const lines = csv
    .trim()
    .split(/\r?\n/)
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => line.trim().length > 0)

  const first = lines[0]
  const rows = first && /^nome\s*(,|$)/i.test(first.line.trim()) ? lines.slice(1) : lines

  const tooManyRows = rows.length > IMPORT_MAX_ROWS
  const validRows: ParsedImportRow[] = []
  const invalidRows: ImportRowError[] = []

  if (!tooManyRows) {
    for (const { line, number } of rows) {
      const [name = '', email = '', groupName = ''] = line.split(',').map((part) => part.trim())

      const parsed = ImportGuestRowSchema.safeParse({
        name,
        email:      email || null,
        group_name: groupName || null,
      })

      if (!parsed.success) {
        invalidRows.push({ line: number, message: parsed.error.issues[0]?.message ?? 'Linha inválida.' })
        continue
      }

      validRows.push({ line: number, guest: parsed.data })
    }
  }

  return { totalRows: rows.length, tooManyRows, validRows, invalidRows }
}
