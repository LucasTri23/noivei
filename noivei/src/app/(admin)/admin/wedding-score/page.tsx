import Link from 'next/link'
import AdminWeddingScoreManager from '@/components/admin/admin-wedding-score-manager'
import { createSupabaseServer } from '@/lib/supabase/server'

export const metadata = { title: 'Admin · Wedding Score' }

const CONFIG_COLUMNS =
  'enabled, title, description, label_low, description_low, label_mid, description_mid, label_high, description_high'

export default async function AdminWeddingScorePage() {
  const supabase = await createSupabaseServer()

  const [{ data: config }, { data: weights }] = await Promise.all([
    supabase.from('wedding_score_config').select(CONFIG_COLUMNS).eq('id', true).maybeSingle(),
    supabase.from('wedding_score_module_weights').select('module_key, label, weight, sort_order').order('sort_order'),
  ])

  return (
    <div>
      <h1
        className="font-display"
        style={{ fontWeight: 500, fontSize: 'clamp(28px,4vw,38px)', lineHeight: 1.05, color: '#2A1E10', margin: '0 0 6px' }}
      >
        Wedding Score
      </h1>
      <p style={{ fontSize: '14.5px', color: '#8A7560', margin: '0 0 28px' }}>
        Configure o Wedding Score completo: liga/desliga global, textos exibidos no Dashboard e o peso de
        cada um dos 7 módulos que compõem a nota. Quem libera o módulo por plano é a matriz em{' '}
        <Link href="/admin/planos/modulos" style={{ color: '#8A7560', textDecoration: 'underline' }}>
          Módulos por plano
        </Link>
        , não esta tela.
      </p>

      <AdminWeddingScoreManager
        initialConfig={{
          enabled:           (config?.enabled as boolean | undefined) ?? true,
          title:             (config?.title as string | undefined) ?? 'Wedding Score',
          description:       (config?.description as string | undefined) ?? 'Descubra o quanto o planejamento do casamento já está avançado.',
          label_low:         (config?.label_low as string | undefined) ?? 'Início de jornada',
          description_low:   (config?.description_low as string | undefined) ?? 'Ainda no começo — cada passo conta.',
          label_mid:         (config?.label_mid as string | undefined) ?? 'No caminho',
          description_mid:   (config?.description_mid as string | undefined) ?? 'Vocês estão avançando bem, continue assim.',
          label_high:        (config?.label_high as string | undefined) ?? 'Quase lá',
          description_high:  (config?.description_high as string | undefined) ?? 'Seu planejamento está bem encaminhado.',
        }}
        initialWeights={(weights ?? []) as { module_key: string; label: string; weight: number; sort_order: number }[]}
      />
    </div>
  )
}
