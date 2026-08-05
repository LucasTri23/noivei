// Gera o PDF de resumo do casamento, anexado ao e-mail do marco `day_after` do
// cron notify-wedding-milestones (1 dia depois da data do casamento).
//
// O projeto já tem jsPDF instalado (jspdf + jspdf-autotable), mas só para uso
// client-side — guests-manager.tsx desenha um PDF simples de lista de convidados
// direto no browser, imperativamente (coordenadas x/y manuais). Aqui o PDF precisa
// ser montado no runtime Node de uma Route Handler (cron), com um layout de
// cards/seções mais elaborado — @react-pdf/renderer roda igualmente bem no
// servidor (via `renderToBuffer`), é pura JS (sem binário nativo, seguro em
// serverless/Vercel Cron) e permite compor o documento como componentes JSX, no
// mesmo estilo declarativo do resto do código React do projeto — muito mais
// natural e legível aqui do que desenhar coordenadas manualmente como o jsPDF
// exige. Por isso a escolha de uma segunda lib de PDF em vez de reaproveitar a
// já existente.

import { Document, Page, View, Text, StyleSheet, renderToBuffer } from '@react-pdf/renderer'

export interface WeddingSummaryScoreBreakdown {
  label: string
  pct:   number
}

export interface WeddingSummaryScore {
  total:     number
  breakdown: WeddingSummaryScoreBreakdown[]
}

export interface WeddingSummaryPdfData {
  coupleNames: string
  /** yyyy-mm-dd */
  weddingDate: string
  checklist: { completed: number; total: number }
  guests:    { total: number; confirmed: number; declined: number; pending: number }
  /** Valores em centavos — mesma unidade de `weddings.budget` / `financial_entries.total_amount`. */
  financial: { budgetCents: number | null; totalSpentCents: number }
  gifts:     { purchased: number; total: number }
  files:     { count: number }
  /** `null` quando o módulo Wedding Score não está liberado pro casamento (ou nunca foi calculado). */
  score:     WeddingSummaryScore | null
  /** Default: `new Date()`. Parâmetro explícito só para deixar o PDF determinístico em teste. */
  generatedAt?: Date
}

const styles = StyleSheet.create({
  page: {
    paddingTop:        40,
    paddingBottom:      48,
    paddingHorizontal: 40,
    fontFamily: 'Helvetica',
    fontSize:   10,
    color:      '#3A2A18',
  },
  brand: {
    fontSize:      12,
    fontFamily:    'Helvetica-Bold',
    color:         '#C6943A',
    letterSpacing: 1,
    marginBottom:  6,
  },
  coupleNames: {
    fontSize:     22,
    fontFamily:   'Helvetica-Bold',
    color:        '#3A2A18',
    marginBottom: 4,
  },
  weddingDate: {
    fontSize:     11,
    color:        '#7A6A50',
    marginBottom: 24,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#E7DDC8',
    marginBottom:       20,
  },
  card: {
    borderWidth:  1,
    borderColor:  '#E7DDC8',
    borderRadius: 6,
    padding:      14,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize:     12,
    fontFamily:   'Helvetica-Bold',
    color:        '#3A2A18',
    marginBottom: 8,
  },
  row: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    marginBottom:    4,
  },
  rowLabel: {
    color: '#5A4A34',
  },
  rowValue: {
    fontFamily: 'Helvetica-Bold',
    color:      '#3A2A18',
  },
  scoreTotal: {
    fontSize:     28,
    fontFamily:   'Helvetica-Bold',
    color:        '#C6943A',
    marginBottom: 10,
  },
  footer: {
    position:  'absolute',
    bottom:    24,
    left:      40,
    right:     40,
    textAlign: 'center',
    color:     '#9A8A70',
    fontSize:  8,
  },
})

function formatCurrencyCents(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

// yyyy-mm-dd → dd/mm/yyyy sem passar por `new Date(iso)` — evita off-by-one por
// fuso, mesma preocupação já documentada em notify-wedding-milestones/route.ts.
function formatDateBR(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  if (!year || !month || !day) return isoDate
  return `${day}/${month}/${year}`
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  )
}

function WeddingSummaryDocument({ data }: { data: WeddingSummaryPdfData }) {
  const generatedAt = data.generatedAt ?? new Date()
  const generatedAtLabel = generatedAt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })

  return (
    <Document title={`Resumo do casamento - ${data.coupleNames}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>WEDNEST</Text>
        <Text style={styles.coupleNames}>{data.coupleNames}</Text>
        <Text style={styles.weddingDate}>Casamento em {formatDateBR(data.weddingDate)}</Text>
        <View style={styles.divider} />

        {data.score && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Wedding Score</Text>
            <Text style={styles.scoreTotal}>{data.score.total} / 100</Text>
            {data.score.breakdown.map((item) => (
              <SummaryRow key={item.label} label={item.label} value={`${Math.round(item.pct)}%`} />
            ))}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Checklist</Text>
          <SummaryRow label="Tarefas concluídas" value={`${data.checklist.completed} de ${data.checklist.total}`} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Convidados</Text>
          <SummaryRow label="Total cadastrado" value={String(data.guests.total)} />
          <SummaryRow label="Confirmados"      value={String(data.guests.confirmed)} />
          <SummaryRow label="Recusados"        value={String(data.guests.declined)} />
          <SummaryRow label="Pendentes"        value={String(data.guests.pending)} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Financeiro</Text>
          <SummaryRow
            label="Orçamento definido"
            value={data.financial.budgetCents !== null ? formatCurrencyCents(data.financial.budgetCents) : 'Não definido'}
          />
          <SummaryRow label="Total gasto/lançado" value={formatCurrencyCents(data.financial.totalSpentCents)} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Presentes</Text>
          <SummaryRow label="Itens recebidos" value={`${data.gifts.purchased} de ${data.gifts.total}`} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Arquivos</Text>
          <SummaryRow label="Arquivos guardados" value={String(data.files.count)} />
        </View>

        <Text style={styles.footer}>
          {`Documento gerado em ${generatedAtLabel} — registro gerado automaticamente pelo Wednest. Parabéns pelo casamento!`}
        </Text>
      </Page>
    </Document>
  )
}

/**
 * Renderiza o resumo do casamento (checklist, convidados, financeiro, presentes,
 * arquivos e, se liberado, o Wedding Score) como um PDF em memória — usado pelo
 * cron `notify-wedding-milestones` para anexar no e-mail do marco `day_after`.
 */
export async function renderWeddingSummaryPdf(data: WeddingSummaryPdfData): Promise<Buffer> {
  return renderToBuffer(<WeddingSummaryDocument data={data} />)
}
