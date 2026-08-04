// Purge definitivo (LGPD, art. 18 VI) de contas soft-deletadas há mais de 30 dias.
// Disparada via Vercel Cron (ver vercel.json), protegida por CRON_SECRET — mesmo
// padrão de cron/notify-overdue.
//
// Precisa limpar o Storage (fotos, documentos, contratos) ANTES de apagar as
// linhas do banco: `weddings`/`auth.users` tem cascade só dentro do Postgres
// (checklist_items, guests, financial_entries etc.) — storage.objects é uma
// tabela separada, sem FK com as tabelas da aplicação, então apagar a linha do
// banco não apaga o arquivo físico. Sem essa ordem, os arquivos ficam órfãos no
// Storage pra sempre, mesmo com a "conta apagada" — foi um achado real na
// revisão da Política de Privacidade (a promessa de eliminação em 30 dias não
// estava sendo cumprida por completo).
//
// Substitui o agendamento interno do pg_cron (ver migration
// 20260729000002_unschedule-sql-purge-cron.sql) — só esta rota deve disparar o
// expurgo agora, pra garantir a ordem (Storage antes do banco) sempre.

import { err, handleApiError, ok } from '@/lib/api/response'
import { createSupabaseService } from '@/lib/supabase/service'

// Todo bucket que guarda arquivo prefixado por "{wedding_id}/..." precisa estar
// aqui (ver migrations em supabase/migrations para a lista completa de buckets
// do projeto). "wedding-album-photos" (mural de fotos via QR code, migration
// 20260803000001_add-album-module.sql) ficou de fora até aqui — bug real de
// retenção: fotos de convidados nunca eram apagadas no expurgo definitivo.
const STORAGE_BUCKETS = [
  'wedding-files',
  'wedding-photos',
  'wedding-gift-photos',
  'wedding-album-photos',
] as const

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export async function GET(req: Request) {
  try {
    const secret = process.env.CRON_SECRET
    const authHeader = req.headers.get('authorization')

    if (!secret || authHeader !== `Bearer ${secret}`) {
      return err(401, 'UNAUTHORIZED', 'Não autorizado.')
    }

    const supabase = createSupabaseService()

    const { data: weddings, error: weddingsError } = await supabase
      .from('weddings')
      .select('id')
      .not('deleted_at', 'is', null)
      .lt('deleted_at', new Date(Date.now() - THIRTY_DAYS_MS).toISOString())

    if (weddingsError) return err(500, 'DB_ERROR', 'Erro ao buscar casamentos a expurgar.')

    let filesRemoved = 0

    for (const wedding of (weddings ?? []) as { id: string }[]) {
      for (const bucket of STORAGE_BUCKETS) {
        // Convenção de path em todo o projeto: "{weddingId}/{uuid}-{nome}" — um só
        // nível, então list() na "pasta" do casamento já traz tudo daquele bucket.
        const { data: objects, error: listError } = await supabase.storage
          .from(bucket)
          .list(wedding.id, { limit: 1000 })

        if (listError) {
          console.error(`[cron/purge-accounts] falha ao listar ${bucket} pro casamento ${wedding.id}:`, listError)
          continue
        }
        if (!objects || objects.length === 0) continue

        const paths = objects.map((obj) => `${wedding.id}/${obj.name}`)
        const { error: removeError } = await supabase.storage.from(bucket).remove(paths)

        if (removeError) {
          console.error(`[cron/purge-accounts] falha ao remover arquivos de ${bucket} pro casamento ${wedding.id}:`, removeError)
          continue
        }
        filesRemoved += paths.length
      }
    }

    // Cascade real (auth.users -> weddings -> tabelas filhas) só depois de limpar
    // o Storage acima — ver comentário no topo do arquivo.
    const { error: purgeError } = await supabase.rpc('fn_purge_soft_deleted_accounts')
    if (purgeError) return err(500, 'DB_ERROR', 'Erro ao expurgar contas.')

    return ok({ weddingsProcessed: weddings?.length ?? 0, filesRemoved })
  } catch (error) {
    return handleApiError(error)
  }
}
