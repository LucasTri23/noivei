// Gera o PDF de "Exportar meus dados" (LGPD art. 18, direito à portabilidade),
// baixado sob demanda em Perfil pelo dono do casamento — ver
// src/app/api/v1/weddings/[wid]/export/route.ts. Antes, essa rota devolvia um
// JSON bruto de ~19 tabelas; a maioria dos usuários não tem como abrir/ler
// isso. Aqui o mesmo conteúdo vira um relatório com uma tabela por seção,
// usando @react-pdf/renderer (mesma lib do resumo enviado por e-mail no
// marco `day_after`, ver wedding-summary-pdf.tsx) — diferente daquele, este
// PDF é o dado bruto por completo (todo convidado, todo lançamento...), não
// um resumo agregado, então pode ficar com várias páginas dependendo do
// quanto o casal já cadastrou.

import { Document, Page, View, Text, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import type { ExportPayload } from '@/lib/export/wedding-export-payload'

const styles = StyleSheet.create({
  page: {
    paddingTop:        40,
    paddingBottom:      48,
    paddingHorizontal: 40,
    fontFamily: 'Helvetica',
    fontSize:   9,
    color:      '#3A2A18',
  },
  brand: {
    fontSize:      12,
    fontFamily:    'Helvetica-Bold',
    color:         '#C6943A',
    letterSpacing: 1,
    marginBottom:  6,
  },
  title: {
    fontSize:     18,
    fontFamily:   'Helvetica-Bold',
    color:        '#3A2A18',
    marginBottom: 4,
  },
  subtitle: {
    fontSize:     10,
    color:        '#7A6A50',
    marginBottom: 20,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#E7DDC8',
    marginBottom:       16,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize:     11,
    fontFamily:   'Helvetica-Bold',
    color:        '#3A2A18',
    backgroundColor: '#F7F1E6',
    padding:      6,
    marginBottom: 8,
  },
  emptyText: {
    fontSize:    8.5,
    color:       '#9A8A70',
    fontStyle:   'italic',
    marginBottom: 4,
  },
  noteText: {
    fontSize:    7.5,
    color:       '#9A8A70',
    marginTop:   3,
  },
  kvRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    marginBottom:   3,
    paddingHorizontal: 2,
  },
  kvLabel: {
    color: '#5A4A34',
  },
  kvValue: {
    fontFamily: 'Helvetica-Bold',
    color:      '#3A2A18',
    textAlign:  'right',
  },
  table: {
    borderWidth:  1,
    borderColor:  '#E7DDC8',
    borderRadius: 4,
  },
  tableRow: {
    flexDirection:     'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E7DDC8',
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableHeaderRow: {
    backgroundColor: '#F7F1E6',
  },
  tableCell: {
    padding:  5,
    fontSize: 8,
  },
  tableHeaderCell: {
    fontFamily: 'Helvetica-Bold',
    color:      '#5A4A34',
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
  pageNumber: {
    position: 'absolute',
    bottom:   24,
    right:    40,
    color:    '#9A8A70',
    fontSize: 8,
  },
})

function formatCurrencyCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return 'Não definido'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

// yyyy-mm-dd → dd/mm/yyyy sem passar por `new Date(iso)` — evita off-by-one por
// fuso, mesma preocupação já documentada em notify-wedding-milestones/route.ts.
function formatDateOnlyBR(isoDate: string | null): string {
  if (!isoDate) return '—'
  const [year, month, day] = isoDate.split('-')
  if (!year || !month || !day) return isoDate
  return `${day}/${month}/${year}`
}

function formatDateTimeBR(isoTimestamp: string | null): string {
  if (!isoTimestamp) return '—'
  return new Date(isoTimestamp).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function yesNo(value: boolean): string {
  return value ? 'Sim' : 'Não'
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue}>{value}</Text>
    </View>
  )
}

interface TableColumn {
  header: string
  width:  string
}

function DataTable({ columns, rows, emptyLabel, note }: {
  columns:    TableColumn[]
  rows:       string[][]
  emptyLabel: string
  note?:      string
}) {
  if (rows.length === 0) {
    return <Text style={styles.emptyText}>{emptyLabel}</Text>
  }

  return (
    <>
      <View style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeaderRow]}>
          {columns.map((col) => (
            <Text key={col.header} style={[styles.tableCell, styles.tableHeaderCell, { width: col.width }]}>{col.header}</Text>
          ))}
        </View>
        {rows.map((row, ri) => (
          <View key={ri} style={[styles.tableRow, ...(ri === rows.length - 1 ? [styles.tableRowLast] : [])]} wrap={false}>
            {row.map((cell, ci) => (
              <Text key={ci} style={[styles.tableCell, { width: columns[ci]?.width ?? 'auto' }]}>{cell}</Text>
            ))}
          </View>
        ))}
      </View>
      {note && <Text style={styles.noteText}>{note}</Text>}
    </>
  )
}

const GUEST_STATUS_LABEL: Record<string, string> = {
  confirmado: 'Confirmado',
  pendente:   'Pendente',
  recusado:   'Recusado',
}

const INVITE_STATUS_LABEL: Record<string, string> = {
  pending:  'Pendente',
  accepted: 'Aceito',
  revoked:  'Revogado',
}

const GIFT_TYPE_LABEL: Record<string, string> = {
  link:         'Link externo',
  app_payment:  'Pago pelo app',
}

function WeddingDataExportDocument({ data }: { data: ExportPayload }) {
  const { wedding } = data
  const coupleNames = wedding?.couple_names ?? 'Casamento'
  const generatedAtLabel = new Date(data.exported_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

  return (
    <Document title={`Meus dados - ${coupleNames}`}>
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.brand}>WEDNEST</Text>
        <Text style={styles.title}>Exportação completa dos seus dados</Text>
        <Text style={styles.subtitle}>{coupleNames} — gerado em {generatedAtLabel}</Text>
        <View style={styles.divider} />

        <View style={styles.section}>
          <SectionTitle>Casamento</SectionTitle>
          {wedding ? (
            <>
              <KeyValue label="Nome do casal" value={wedding.couple_names} />
              <KeyValue label="Noiva" value={wedding.bride_name ?? '—'} />
              <KeyValue label="Noivo" value={wedding.groom_name ?? '—'} />
              <KeyValue label="Data do casamento" value={formatDateOnlyBR(wedding.wedding_date)} />
              <KeyValue label="Alterações de data usadas" value={`${wedding.wedding_date_changed_count} de 3`} />
              <KeyValue label="Local" value={wedding.venue ?? '—'} />
              <KeyValue label="Cidade" value={wedding.city ?? '—'} />
              <KeyValue label="Orçamento" value={wedding.budget !== null ? formatCurrencyCents(wedding.budget) : 'Não definido'} />
              <KeyValue label="Estilo" value={wedding.style ?? '—'} />
              <KeyValue label="Wedding Score" value={`${wedding.wedding_score} / 100`} />
              <KeyValue label="Conta criada em" value={formatDateTimeBR(wedding.created_at)} />
            </>
          ) : (
            <Text style={styles.emptyText}>Casamento não encontrado.</Text>
          )}
        </View>

        <View style={styles.section}>
          <SectionTitle>Seu perfil</SectionTitle>
          {data.profile ? (
            <>
              <KeyValue label="Nome" value={data.profile.full_name ?? '—'} />
              <KeyValue label="Notificações de timeline" value={yesNo(data.profile.notify_timeline)} />
              <KeyValue label="Notificações de RSVP" value={yesNo(data.profile.notify_rsvp)} />
              <KeyValue label="Conta criada em" value={formatDateTimeBR(data.profile.created_at)} />
            </>
          ) : (
            <Text style={styles.emptyText}>Perfil não encontrado.</Text>
          )}
        </View>

        <View style={styles.section}>
          <SectionTitle>Assinatura</SectionTitle>
          {data.subscription ? (
            <>
              <KeyValue label="Plano" value={data.subscription.plan_id} />
              <KeyValue label="Status" value={data.subscription.status} />
              <KeyValue label="Em período de teste" value={yesNo(data.subscription.is_trial)} />
              <KeyValue label="Período atual até" value={formatDateTimeBR(data.subscription.current_period_end)} />
              <KeyValue label="Expira em" value={formatDateTimeBR(data.subscription.expires_at)} />
            </>
          ) : (
            <Text style={styles.emptyText}>Nenhuma assinatura registrada (plano Gratuito).</Text>
          )}
        </View>

        <View style={styles.section}>
          <SectionTitle>{`Convidados (${data.guests.length})`}</SectionTitle>
          <DataTable
            emptyLabel="Nenhum convidado cadastrado."
            columns={[
              { header: 'Nome',      width: '24%' },
              { header: 'Grupo',     width: '14%' },
              { header: 'Status',    width: '13%' },
              { header: 'Pessoas',   width: '10%' },
              { header: 'E-mail',    width: '22%' },
              { header: 'Telefone',  width: '17%' },
            ]}
            rows={data.guests.map((g) => [
              g.name,
              g.group_name ?? '—',
              GUEST_STATUS_LABEL[g.status] ?? g.status,
              g.attending_count !== null ? `${g.attending_count}/${g.party_size}` : `—/${g.party_size}`,
              g.email ?? '—',
              g.phone ?? '—',
            ])}
          />
        </View>

        <View style={styles.section}>
          <SectionTitle>{`Checklist (${data.checklist_items.length})`}</SectionTitle>
          <DataTable
            emptyLabel="Nenhuma tarefa cadastrada."
            columns={[
              { header: 'Tarefa',     width: '46%' },
              { header: 'Categoria',  width: '22%' },
              { header: 'Prazo',      width: '16%' },
              { header: 'Concluída',  width: '16%' },
            ]}
            rows={data.checklist_items.map((c) => [
              c.label,
              c.category ?? '—',
              formatDateOnlyBR(c.due_date),
              yesNo(c.completed),
            ])}
          />
        </View>

        <View style={styles.section}>
          <SectionTitle>{`Financeiro — Lançamentos (${data.financial.entries.length})`}</SectionTitle>
          <DataTable
            emptyLabel="Nenhum lançamento cadastrado."
            columns={[
              { header: 'Categoria',   width: '16%' },
              { header: 'Fornecedor',  width: '18%' },
              { header: 'Descrição',   width: '26%' },
              { header: 'Total',       width: '14%' },
              { header: 'Pago',        width: '13%' },
              { header: 'Vencimento',  width: '13%' },
            ]}
            rows={data.financial.entries.map((e) => [
              e.category,
              e.vendor ?? '—',
              e.description ?? '—',
              formatCurrencyCents(e.total_amount),
              formatCurrencyCents(e.paid_amount),
              formatDateOnlyBR(e.due_date),
            ])}
          />
        </View>

        <View style={styles.section}>
          <SectionTitle>{`Financeiro — Cotações (${data.financial.quotes.length})`}</SectionTitle>
          <DataTable
            emptyLabel="Nenhuma cotação registrada."
            columns={[
              { header: 'Tipo',        width: '20%' },
              { header: 'Fornecedor',  width: '35%' },
              { header: 'Valor',       width: '25%' },
              { header: 'Selecionada', width: '20%' },
            ]}
            rows={data.financial.quotes.map((q) => [
              q.type,
              q.vendor_name,
              formatCurrencyCents(q.amount_cents),
              yesNo(q.is_selected),
            ])}
          />
        </View>

        <View style={styles.section}>
          <SectionTitle>{`Financeiro — Parcelas (${data.financial.installments.length})`}</SectionTitle>
          <DataTable
            emptyLabel="Nenhuma parcela registrada."
            columns={[
              { header: 'Parcela',     width: '20%' },
              { header: 'Valor',       width: '30%' },
              { header: 'Vencimento',  width: '25%' },
              { header: 'Paga',        width: '25%' },
            ]}
            rows={data.financial.installments.map((i) => [
              `${i.installment_number}/${i.total_installments}`,
              formatCurrencyCents(i.amount_cents),
              formatDateOnlyBR(i.due_date),
              yesNo(i.paid),
            ])}
          />
        </View>

        <View style={styles.section}>
          <SectionTitle>{`Financeiro — Orçamento por categoria (${data.financial.category_budgets.length})`}</SectionTitle>
          <DataTable
            emptyLabel="Nenhum orçamento por categoria definido."
            columns={[
              { header: 'Categoria', width: '55%' },
              { header: 'Orçamento', width: '45%' },
            ]}
            rows={data.financial.category_budgets.map((b) => [b.category, formatCurrencyCents(b.budget_cents)])}
          />
        </View>

        <View style={styles.section}>
          <SectionTitle>{`Lista de presentes (${data.gift_registry.length})`}</SectionTitle>
          <DataTable
            emptyLabel="Nenhum presente cadastrado."
            columns={[
              { header: 'Nome',      width: '40%' },
              { header: 'Preço',     width: '22%' },
              { header: 'Tipo',      width: '20%' },
              { header: 'Comprado',  width: '18%' },
            ]}
            rows={data.gift_registry.map((g) => [
              g.name,
              g.price_cents !== null ? formatCurrencyCents(g.price_cents) : '—',
              GIFT_TYPE_LABEL[g.gift_type] ?? g.gift_type,
              yesNo(g.is_purchased),
            ])}
          />
        </View>

        <View style={styles.section}>
          <SectionTitle>{`Padrinhos e cortejo (${data.wedding_party.length})`}</SectionTitle>
          <DataTable
            emptyLabel="Nenhum padrinho/madrinha cadastrado."
            columns={[
              { header: 'Papel',            width: '40%' },
              { header: 'Carrega alianças', width: '30%' },
              { header: 'Ordem',            width: '30%' },
            ]}
            rows={data.wedding_party.map((w) => [w.role, yesNo(w.carries_rings), String(w.sort_order + 1)])}
          />
        </View>

        <View style={styles.section}>
          <SectionTitle>{`Mesas (${data.tables.config.length})`}</SectionTitle>
          <DataTable
            emptyLabel="Nenhuma mesa cadastrada."
            columns={[
              { header: 'Mesa',       width: '60%' },
              { header: 'Capacidade', width: '40%' },
            ]}
            rows={data.tables.config.map((t) => [t.label, String(t.capacity)])}
          />
        </View>

        <View style={styles.section}>
          <SectionTitle>{`Distribuição nas mesas (${data.tables.assignments.length})`}</SectionTitle>
          <DataTable
            emptyLabel="Nenhum convidado distribuído em mesa."
            note="Mesa e convidado identificados pelo ID técnico — cruze com as seções Mesas e Convidados acima."
            columns={[
              { header: 'ID da mesa',      width: '50%' },
              { header: 'ID do convidado', width: '50%' },
            ]}
            rows={data.tables.assignments.map((a) => [a.table_id, a.guest_id])}
          />
        </View>

        <View style={styles.section}>
          <SectionTitle>Site do casal</SectionTitle>
          {data.site_config ? (
            <>
              <KeyValue label="Endereço (slug)" value={data.site_config.slug} />
              <KeyValue label="Publicado" value={yesNo(data.site_config.published)} />
              <KeyValue label="Template" value={data.site_config.template} />
            </>
          ) : (
            <Text style={styles.emptyText}>Nenhum site configurado.</Text>
          )}
        </View>

        <View style={styles.section}>
          <SectionTitle>{`Arquivos (${data.files.length})`}</SectionTitle>
          <DataTable
            emptyLabel="Nenhum arquivo enviado."
            columns={[
              { header: 'Nome',        width: '40%' },
              { header: 'Tamanho',     width: '15%' },
              { header: 'Tipo',        width: '20%' },
              { header: 'Enviado em',  width: '25%' },
            ]}
            rows={data.files.map((f) => [f.file_name, formatBytes(f.size_bytes), f.mime_type ?? '—', formatDateTimeBR(f.created_at)])}
          />
        </View>

        <View style={styles.section}>
          <SectionTitle>{`Fotos do álbum (${data.gallery_photos.length})`}</SectionTitle>
          <DataTable
            emptyLabel="Nenhuma foto enviada."
            columns={[
              { header: 'Tamanho',     width: '30%' },
              { header: 'Tipo',        width: '35%' },
              { header: 'Enviado em',  width: '35%' },
            ]}
            rows={data.gallery_photos.map((p) => [formatBytes(p.size_bytes), p.mime_type ?? '—', formatDateTimeBR(p.created_at)])}
          />
        </View>

        <View style={styles.section}>
          <SectionTitle>Questionário de personalização</SectionTitle>
          {data.preferences ? (
            <>
              <KeyValue label="Respostas registradas" value={String(Object.keys(data.preferences.answers).length)} />
              <KeyValue label="Última atualização" value={formatDateTimeBR(data.preferences.updated_at)} />
            </>
          ) : (
            <Text style={styles.emptyText}>Questionário ainda não respondido.</Text>
          )}
        </View>

        <View style={styles.section}>
          <SectionTitle>{`Membros com acesso ao casamento (${data.members.length})`}</SectionTitle>
          <DataTable
            emptyLabel="Nenhum membro cadastrado."
            columns={[
              { header: 'Papel',           width: '34%' },
              { header: 'Acesso completo', width: '33%' },
              { header: 'Desde',           width: '33%' },
            ]}
            rows={data.members.map((m) => [
              m.role === 'owner' ? 'Dono' : 'Membro',
              yesNo(m.permissions.full_access),
              formatDateTimeBR(m.created_at),
            ])}
          />
        </View>

        <View style={styles.section}>
          <SectionTitle>{`Convites enviados (${data.invites_sent.length})`}</SectionTitle>
          <DataTable
            emptyLabel="Nenhum convite enviado."
            columns={[
              { header: 'Status',      width: '20%' },
              { header: 'Criado em',   width: '27%' },
              { header: 'Expira em',   width: '27%' },
              { header: 'Aceito em',   width: '26%' },
            ]}
            rows={data.invites_sent.map((inv) => [
              INVITE_STATUS_LABEL[inv.status] ?? inv.status,
              formatDateTimeBR(inv.created_at),
              formatDateTimeBR(inv.expires_at),
              inv.accepted_at ? formatDateTimeBR(inv.accepted_at) : '—',
            ])}
          />
        </View>

        <Text style={styles.footer} fixed>
          Documento gerado automaticamente pelo Wednest — dados pessoais tratados conforme a Política de Privacidade.
        </Text>
        <Text
          style={styles.pageNumber}
          fixed
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
        />
      </Page>
    </Document>
  )
}

/**
 * Renderiza a exportação completa dos dados do casamento (LGPD art. 18) como um
 * PDF em memória — usado por GET /api/v1/weddings/[wid]/export.
 */
export async function renderWeddingDataExportPdf(data: ExportPayload): Promise<Buffer> {
  return renderToBuffer(<WeddingDataExportDocument data={data} />)
}
