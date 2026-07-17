'use client'

// Wizard compartilhado das 6 etapas de personalização do checklist (Q3–Q24 do
// docs/checklist-rule-engine.md — Q1 = data do casamento e Q2 = nº de convidados
// são coletados fora do questionário). Usado pelo onboarding (planos pagos) e pela
// rota /checklist/personalizar (contas que já têm casamento). O componente renderiza
// UMA etapa por vez; quem hospeda controla o índice, o botão "Voltar" e a barra de
// progresso — assim o onboarding mantém a numeração global de passos.

import type { WeddingAnswers } from '@/lib/checklist/facts'

export const QUESTIONNAIRE_STEPS = 6

// ── Opções do questionário (§3 do doc de regras) ──

type Option<T extends string> = { val: T; label: string }

const ORCAMENTO_OPTS: Option<WeddingAnswers['orcamento']>[] = [
  { val: 'ate_30',   label: 'Até R$ 30 mil' },
  { val: '30_80',    label: 'R$ 30–80 mil' },
  { val: '80_150',   label: 'R$ 80–150 mil' },
  { val: '150_mais', label: 'R$ 150 mil+' },
  { val: 'nao_sei',  label: 'Ainda não sabemos' },
]
const ORGANIZACAO_OPTS: Option<WeddingAnswers['organizacao']>[] = [
  { val: 'so_nos',      label: 'Só nós dois' },
  { val: 'com_familia', label: 'Com ajuda de família/amigos' },
]
const ASSESSORIA_OPTS: Option<WeddingAnswers['assessoria']>[] = [
  { val: 'completa', label: 'Assessoria completa' },
  { val: 'dia',      label: 'Só "assessoria do dia"' },
  { val: 'nao',      label: 'Não vamos contratar' },
  { val: 'nao_sei',  label: 'Ainda não sabemos' },
]
const CIVIL_OPTS: Option<WeddingAnswers['civil']>[] = [
  { val: 'cartorio',   label: 'No cartório' },
  { val: 'no_local',   label: 'Civil no local da festa' },
  { val: 'ja_casados', label: 'Já somos casados no civil' },
  { val: 'sem_civil',  label: 'Não teremos civil agora' },
  { val: 'nao_sei',    label: 'Ainda não sabemos' },
]
const CERIMONIA_OPTS: Option<WeddingAnswers['cerimonia']>[] = [
  { val: 'catolica',       label: 'Católica' },
  { val: 'outra_religiao', label: 'Evangélica ou outra religião' },
  { val: 'simbolica',      label: 'Celebrante simbólico' },
  { val: 'nao',            label: 'Não teremos' },
  { val: 'nao_sei',        label: 'Ainda não sabemos' },
]
const LOCAL_OPTS: Option<WeddingAnswers['local']>[] = [
  { val: 'espaco_cidade', label: 'Espaço de eventos na nossa cidade' },
  { val: 'campo',         label: 'Campo ou fazenda' },
  { val: 'praia',         label: 'Praia' },
  { val: 'casa',          label: 'Em casa' },
  { val: 'outra_cidade',  label: 'Outra cidade' },
  { val: 'outro_pais',    label: 'Outro país' },
  { val: 'nao_sei',       label: 'Ainda não sabemos' },
]
const REGIME_OPTS: Option<WeddingAnswers['regime_bens']>[] = [
  { val: 'comunhao_parcial', label: 'Comunhão parcial (padrão)' },
  { val: 'outro',            label: 'Outro regime' },
  { val: 'nao_sei',          label: 'Ainda não sabemos' },
]
const SOBRENOME_OPTS: Option<WeddingAnswers['alterar_sobrenome']>[] = [
  { val: 'sim',     label: 'Sim' },
  { val: 'nao',     label: 'Não' },
  { val: 'nao_sei', label: 'Ainda não sabemos' },
]
const RECEPCAO_OPTS: Option<WeddingAnswers['recepcao']>[] = [
  { val: 'festa_pista', label: 'Festa completa com pista' },
  { val: 'sem_pista',   label: 'Recepção sem pista (almoço/jantar)' },
  { val: 'nao',         label: 'Não teremos recepção' },
  { val: 'nao_sei',     label: 'Ainda não sabemos' },
]
const MUSICA_OPTS: Option<WeddingAnswers['musica']>[] = [
  { val: 'dj',       label: 'DJ' },
  { val: 'banda',    label: 'Banda' },
  { val: 'dj_banda', label: 'DJ + banda' },
  { val: 'playlist', label: 'Playlist própria' },
  { val: 'nao_sei',  label: 'Ainda não sabemos' },
]
const BEBIDAS_OPTS: Option<WeddingAnswers['bebidas']>[] = [
  { val: 'open_bar',   label: 'Open bar completo' },
  { val: 'simples',    label: 'Cerveja, vinho e drinks simples' },
  { val: 'sem_alcool', label: 'Sem álcool' },
  { val: 'nao_sei',    label: 'Ainda não sabemos' },
]
const CRIANCAS_OPTS: Option<WeddingAnswers['criancas']>[] = [
  { val: 'muitas',  label: 'Sim, muitas' },
  { val: 'algumas', label: 'Algumas' },
  { val: 'nao',     label: 'Não (festa só para adultos)' },
  { val: 'nao_sei', label: 'Ainda não sabemos' },
]
const CORTEJO_OPTS: Option<WeddingAnswers['cortejo'][number]>[] = [
  { val: 'padrinhos',       label: 'Padrinhos e madrinhas' },
  { val: 'daminhas_pajens', label: 'Daminhas e pajens' },
]
const FORNECEDORES_OPTS: Option<WeddingAnswers['fornecedores'][number]>[] = [
  { val: 'buffet',                label: 'Buffet' },
  { val: 'fotografia',            label: 'Fotografia' },
  { val: 'filmagem',              label: 'Filmagem' },
  { val: 'doces',                 label: 'Doces e bem-casados' },
  { val: 'bolo',                  label: 'Bolo' },
  { val: 'flores_decoracao',      label: 'Flores e decoração' },
  { val: 'carro_cerimonia',       label: 'Carro da cerimônia' },
  { val: 'cabine_fotos',          label: 'Cabine de fotos' },
  { val: 'iluminacao_cenica',     label: 'Iluminação cênica' },
  { val: 'som_estrutura',         label: 'Som e estrutura' },
  { val: 'beleza',                label: 'Beleza (cabelo e maquiagem)' },
  { val: 'transporte_convidados', label: 'Transporte de convidados' },
]
const TRAJE_OPTS: Option<WeddingAnswers['traje_noiva']>[] = [
  { val: 'sob_medida', label: 'Sob medida' },
  { val: 'pronto',     label: 'Pronto (comprar)' },
  { val: 'alugado',    label: 'Alugado' },
  { val: 'nao_sei',    label: 'Ainda não sei' },
]
const SIM_NAO_OPTS: Option<'sim' | 'nao' | 'nao_sei'>[] = [
  { val: 'sim',     label: 'Sim' },
  { val: 'nao',     label: 'Não' },
  { val: 'nao_sei', label: 'Ainda não sabemos' },
]
const CONVITES_OPTS: Option<WeddingAnswers['convites']>[] = [
  { val: 'impressos', label: 'Impressos' },
  { val: 'digitais',  label: 'Digitais' },
  { val: 'os_dois',   label: 'Os dois' },
  { val: 'nao_sei',   label: 'Ainda não sabemos' },
]
const RSVP_OPTS: Option<WeddingAnswers['rsvp']>[] = [
  { val: 'online',  label: 'Online (site/WhatsApp)' },
  { val: 'manual',  label: 'Manual (telefone/pessoalmente)' },
  { val: 'nao_sei', label: 'Ainda não sabemos' },
]
const LUA_DE_MEL_OPTS: Option<WeddingAnswers['lua_de_mel']>[] = [
  { val: 'internacional', label: 'Internacional' },
  { val: 'nacional',      label: 'Nacional' },
  { val: 'adiar',         label: 'Vamos adiar (minimoon depois)' },
  { val: 'nao',           label: 'Não teremos' },
  { val: 'nao_sei',       label: 'Ainda não sabemos' },
]
const MOMENTOS_OPTS: Option<WeddingAnswers['momentos'][number]>[] = [
  { val: 'making_of',  label: 'Making of' },
  { val: 'first_look', label: 'First look' },
  { val: 'votos',      label: 'Votos personalizados' },
]
const EVENTOS_OPTS: Option<WeddingAnswers['eventos'][number]>[] = [
  { val: 'cha_panela',    label: 'Chá de panela' },
  { val: 'cha_bar',       label: 'Chá bar ou chá de casa nova' },
  { val: 'despedida',     label: 'Despedida de solteiro(a)' },
  { val: 'jantar_ensaio', label: 'Jantar de ensaio' },
]

// ── Blocos visuais reutilizáveis (exportados para o onboarding usar nos passos próprios) ──

function pillStyle(active: boolean): React.CSSProperties {
  return {
    padding: '10px 14px', borderRadius: '12px',
    border: `1.5px solid ${active ? '#C6943A' : '#EBDDD0'}`,
    background: active ? '#FBF5EE' : '#FFFFFF',
    color: active ? '#9A7020' : '#9A7A60',
    fontWeight: active ? 700 : 500, fontSize: '13.5px',
    cursor: 'pointer', transition: 'all 0.18s', textAlign: 'left',
  }
}

function Question({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '13px', fontWeight: 600, color: '#3C2818', marginBottom: '8px' }}>{label}</div>
      {children}
    </div>
  )
}

function ChoiceGroup<T extends string>({ options, value, onChange }: {
  options: Option<T>[]
  value: T
  onChange: (val: T) => void
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      {options.map((opt) => (
        <button key={opt.val} type="button" onClick={() => onChange(opt.val)} style={pillStyle(value === opt.val)}>
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function MultiGroup<T extends string>({ options, values, onToggle, onClear, noneLabel }: {
  options: Option<T>[]
  values: readonly T[]
  onToggle: (val: T) => void
  onClear?: () => void
  noneLabel?: string
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      {options.map((opt) => (
        <button key={opt.val} type="button" onClick={() => onToggle(opt.val)} style={pillStyle(values.includes(opt.val))}>
          {opt.label}
        </button>
      ))}
      {noneLabel && onClear && (
        <button type="button" onClick={onClear} style={pillStyle(values.length === 0)}>
          {noneLabel}
        </button>
      )}
    </div>
  )
}

export function StepTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <>
      <h1 className="font-display" style={{ fontWeight: 500, fontSize: 'clamp(26px,3.4vw,34px)', margin: '0 0 4px', color: '#3C2818' }}>
        {title}
      </h1>
      <p style={{ fontSize: '14px', color: '#9A7A60', margin: '0 0 24px' }}>{subtitle}</p>
    </>
  )
}

export function NextButton({ onClick, label = 'Continuar', disabled = false }: { onClick: () => void; label?: string; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%', background: '#C6943A', color: '#fff', border: 'none',
        borderRadius: '12px', padding: '15px', fontWeight: 600, fontSize: '15px',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.7 : 1,
        boxShadow: '0 10px 24px rgba(198,148,58,0.32)',
      }}
    >
      {label}
    </button>
  )
}

// ── Wizard ──

type MultiKey = 'cortejo' | 'fornecedores' | 'momentos' | 'eventos'

interface QuestionnaireWizardProps {
  /** Etapa atual do questionário (0 a QUESTIONNAIRE_STEPS - 1). */
  step: number
  answers: WeddingAnswers
  onAnswersChange: (answers: WeddingAnswers) => void
  onNext: () => void
  nextLabel?: string
  nextDisabled?: boolean
}

export default function QuestionnaireWizard({
  step,
  answers,
  onAnswersChange,
  onNext,
  nextLabel = 'Continuar',
  nextDisabled = false,
}: QuestionnaireWizardProps) {
  function setAnswer<K extends keyof WeddingAnswers>(key: K, val: WeddingAnswers[K]) {
    onAnswersChange({ ...answers, [key]: val })
  }

  function toggleMulti(key: MultiKey, val: string) {
    const arr  = answers[key] as string[]
    const next = arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]
    onAnswersChange({ ...answers, [key]: next } as WeddingAnswers)
  }

  const stack: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }

  return (
    <div>
      {/* ── Etapa 1: Sobre o grande dia (Q3–Q5) ── */}
      {step === 0 && (
        <div>
          <StepTitle title="Sobre o grande dia" subtitle="Orçamento e quem organiza — a base de tudo." />

          <div style={stack}>
            <Question label="Qual a faixa de orçamento total?">
              <ChoiceGroup options={ORCAMENTO_OPTS} value={answers.orcamento} onChange={(v) => setAnswer('orcamento', v)} />
            </Question>

            <Question label="Quem participa da organização?">
              <ChoiceGroup options={ORGANIZACAO_OPTS} value={answers.organizacao} onChange={(v) => setAnswer('organizacao', v)} />
            </Question>

            <Question label="Vão contratar assessoria/cerimonial?">
              <ChoiceGroup options={ASSESSORIA_OPTS} value={answers.assessoria} onChange={(v) => setAnswer('assessoria', v)} />
            </Question>
          </div>

          <NextButton onClick={onNext} label={nextLabel} disabled={nextDisabled} />
        </div>
      )}

      {/* ── Etapa 2: A cerimônia (Q6–Q10) ── */}
      {step === 1 && (
        <div>
          <StepTitle title="A cerimônia" subtitle="Civil, religiosa e o lugar do sim." />

          <div style={stack}>
            <Question label="Como será o casamento civil?">
              <ChoiceGroup options={CIVIL_OPTS} value={answers.civil} onChange={(v) => setAnswer('civil', v)} />
            </Question>

            <Question label="Terá cerimônia religiosa ou simbólica?">
              <ChoiceGroup options={CERIMONIA_OPTS} value={answers.cerimonia} onChange={(v) => setAnswer('cerimonia', v)} />
            </Question>

            <Question label="Onde será?">
              <ChoiceGroup options={LOCAL_OPTS} value={answers.local} onChange={(v) => setAnswer('local', v)} />
            </Question>

            <Question label="Vocês já sabem o regime de bens?">
              <ChoiceGroup options={REGIME_OPTS} value={answers.regime_bens} onChange={(v) => setAnswer('regime_bens', v)} />
            </Question>

            <Question label="Alguém vai alterar o sobrenome?">
              <ChoiceGroup options={SOBRENOME_OPTS} value={answers.alterar_sobrenome} onChange={(v) => setAnswer('alterar_sobrenome', v)} />
            </Question>
          </div>

          <NextButton onClick={onNext} label={nextLabel} disabled={nextDisabled} />
        </div>
      )}

      {/* ── Etapa 3: A festa (Q11–Q15) ── */}
      {step === 2 && (
        <div>
          <StepTitle title="A festa" subtitle="Como vocês imaginam a celebração." />

          <div style={stack}>
            <Question label="Como será a recepção?">
              <ChoiceGroup options={RECEPCAO_OPTS} value={answers.recepcao} onChange={(v) => setAnswer('recepcao', v)} />
            </Question>

            <Question label="Música da festa">
              <ChoiceGroup options={MUSICA_OPTS} value={answers.musica} onChange={(v) => setAnswer('musica', v)} />
            </Question>

            <Question label="Bebidas">
              <ChoiceGroup options={BEBIDAS_OPTS} value={answers.bebidas} onChange={(v) => setAnswer('bebidas', v)} />
            </Question>

            <Question label="Crianças entre os convidados?">
              <ChoiceGroup options={CRIANCAS_OPTS} value={answers.criancas} onChange={(v) => setAnswer('criancas', v)} />
            </Question>

            <Question label="Terá cortejo? (marque todos que se aplicam)">
              <MultiGroup
                options={CORTEJO_OPTS}
                values={answers.cortejo}
                onToggle={(v) => toggleMulti('cortejo', v)}
                onClear={() => setAnswer('cortejo', [])}
                noneLabel="Nenhum"
              />
            </Question>
          </div>

          <NextButton onClick={onNext} label={nextLabel} disabled={nextDisabled} />
        </div>
      )}

      {/* ── Etapa 4: Fornecedores (Q16) ── */}
      {step === 3 && (
        <div>
          <StepTitle title="Fornecedores" subtitle="O que vocês pretendem contratar? Marque todos que se aplicam." />

          <div style={{ marginBottom: '24px' }}>
            <MultiGroup
              options={FORNECEDORES_OPTS}
              values={answers.fornecedores}
              onToggle={(v) => toggleMulti('fornecedores', v)}
            />
            <p style={{ fontSize: '12.5px', color: '#9A7A60', marginTop: '10px' }}>
              DJ e banda já entram pela resposta de música. Cada item marcado gera as etapas de pesquisa, contrato e pagamento no seu checklist.
            </p>
          </div>

          <NextButton onClick={onNext} label={nextLabel} disabled={nextDisabled} />
        </div>
      )}

      {/* ── Etapa 5: Trajes e convites (Q17–Q21) ── */}
      {step === 4 && (
        <div>
          <StepTitle title="Trajes e convites" subtitle="O visual do casal e o convite para os convidados." />

          <div style={stack}>
            <Question label="Vestido da noiva">
              <ChoiceGroup options={TRAJE_OPTS} value={answers.traje_noiva} onChange={(v) => setAnswer('traje_noiva', v)} />
            </Question>

            <Question label="Terno do noivo">
              <ChoiceGroup options={TRAJE_OPTS} value={answers.traje_noivo} onChange={(v) => setAnswer('traje_noivo', v)} />
            </Question>

            <Question label="Segundo traje para a festa?">
              <ChoiceGroup options={SIM_NAO_OPTS} value={answers.segundo_traje} onChange={(v) => setAnswer('segundo_traje', v)} />
            </Question>

            <Question label="Convites">
              <ChoiceGroup options={CONVITES_OPTS} value={answers.convites} onChange={(v) => setAnswer('convites', v)} />
            </Question>

            <Question label="Vão enviar save the date?">
              <ChoiceGroup options={SIM_NAO_OPTS} value={answers.save_the_date} onChange={(v) => setAnswer('save_the_date', v)} />
            </Question>

            <Question label="Como será a confirmação de presença (RSVP)?">
              <ChoiceGroup options={RSVP_OPTS} value={answers.rsvp} onChange={(v) => setAnswer('rsvp', v)} />
            </Question>
          </div>

          <NextButton onClick={onNext} label={nextLabel} disabled={nextDisabled} />
        </div>
      )}

      {/* ── Etapa 6: Depois do sim (Q22–Q24) ── */}
      {step === 5 && (
        <div>
          <StepTitle title="Depois do sim" subtitle="Lua de mel, momentos especiais e celebrações ao redor." />

          <div style={stack}>
            <Question label="Lua de mel">
              <ChoiceGroup options={LUA_DE_MEL_OPTS} value={answers.lua_de_mel} onChange={(v) => setAnswer('lua_de_mel', v)} />
            </Question>

            <Question label="Momentos especiais no dia (marque todos que se aplicam)">
              <MultiGroup
                options={MOMENTOS_OPTS}
                values={answers.momentos}
                onToggle={(v) => toggleMulti('momentos', v)}
                onClear={() => setAnswer('momentos', [])}
                noneLabel="Nenhum"
              />
            </Question>

            <Question label="Eventos ao redor do casamento (marque todos que se aplicam)">
              <MultiGroup
                options={EVENTOS_OPTS}
                values={answers.eventos}
                onToggle={(v) => toggleMulti('eventos', v)}
                onClear={() => setAnswer('eventos', [])}
                noneLabel="Nenhum"
              />
            </Question>
          </div>

          <NextButton onClick={onNext} label={nextLabel} disabled={nextDisabled} />
        </div>
      )}
    </div>
  )
}
