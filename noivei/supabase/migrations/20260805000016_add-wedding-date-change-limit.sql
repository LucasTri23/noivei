-- Limita a 3 o número de vezes que o casal pode alterar a data do casamento
-- (weddings.wedding_date) depois de definida. Pedido de produto: trocar a data
-- repetidamente bagunça prazos de checklist/timeline (recalculados a cada troca,
-- ver recalculateChecklistDueDates) e confunde convidados que já confirmaram
-- presença via RSVP.
--
-- wedding-data-form.tsx grava direto no Supabase via RLS — não existe Route
-- Handler no meio desse fluxo. Uma trava só no formulário (campo desabilitado)
-- seria puramente cosmética: qualquer um poderia chamar o Supabase direto e
-- contornar. Por isso o limite de verdade fica aqui, num trigger BEFORE UPDATE
-- — a UI (wedding-data-form.tsx) só reflete o contador e desabilita o campo
-- como conveniência, nunca como única defesa (mesma filosofia de "nunca confiar
-- só em client-side" já seguida no resto do projeto via RLS).
--
-- Importante: o trigger só age quando `wedding_date` de fato muda (IS DISTINCT
-- FROM), não em qualquer UPDATE de `weddings` — a tabela é atualizada por várias
-- telas que não mexem na data (perfil, financeiro, plano, etc.), e nenhuma delas
-- deve consumir o limite. Conferido em todos os call sites de
-- `.from('weddings').update(...)` no client (grep em src): o único lugar que
-- grava `wedding_date` fora deste formulário é o onboarding
-- (src/app/(auth)/onboarding/page.tsx), que faz um INSERT (criação do casamento
-- com a data já preenchida) — INSERT nunca dispara um trigger BEFORE UPDATE,
-- então a criação inicial corretamente não conta como "troca".

ALTER TABLE weddings
  ADD COLUMN wedding_date_changed_count INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION fn_enforce_wedding_date_change_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Resalvar o mesmo valor (ou mexer só em outros campos) nunca consome o limite.
  IF NEW.wedding_date IS DISTINCT FROM OLD.wedding_date THEN
    IF OLD.wedding_date_changed_count >= 3 THEN
      -- Mensagem fixa e reconhecível de propósito: o formulário (wedding-data-form.tsx)
      -- detecta esse texto em error.message pra trocar por um toastError amigável em
      -- vez de deixar vazar o erro cru do Postgres (isso só deve acontecer numa corrida
      -- rara — o próprio formulário já desabilita o campo com count >= 3).
      RAISE EXCEPTION 'Limite de alterações da data do casamento atingido (máximo 3).';
    END IF;

    NEW.wedding_date_changed_count := OLD.wedding_date_changed_count + 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_wedding_date_change_limit ON weddings;
CREATE TRIGGER trg_enforce_wedding_date_change_limit
  BEFORE UPDATE ON weddings
  FOR EACH ROW EXECUTE FUNCTION fn_enforce_wedding_date_change_limit();
