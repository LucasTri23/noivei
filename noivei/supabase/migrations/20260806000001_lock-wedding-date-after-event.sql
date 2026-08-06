-- Complementa o trigger de limite de troca de data (migration 20260805000016):
-- depois que a data do casamento já passou, a data não pode mais ser alterada
-- de jeito nenhum — mesmo que o casal ainda tenha trocas sobrando das 3
-- permitidas. Pedido de produto: uma vez que o evento aconteceu, mudar a data
-- não faz sentido (checklist/timeline recalculados, convidados já confirmados
-- via RSVP para a data original) e só criaria inconsistência retroativa.
--
-- "Já passou" é resolvido em America/Sao_Paulo (mesmo fuso usado no resto do
-- projeto para comparações de "hoje" — ver isAlbumUploadWindowOpen em
-- src/lib/album/wedding-day.ts) para não depender do fuso da sessão do
-- Postgres/Vercel (UTC), que criaria off-by-one perto da meia-noite de
-- Brasília.
--
-- Mesma filosofia de "nunca confiar só em client-side": o formulário
-- (wedding-data-form.tsx) já desabilita o campo quando a data passou, mas a
-- trava de verdade continua sendo este trigger.

CREATE OR REPLACE FUNCTION fn_enforce_wedding_date_change_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.wedding_date IS DISTINCT FROM OLD.wedding_date THEN
    IF OLD.wedding_date IS NOT NULL
       AND OLD.wedding_date < (NOW() AT TIME ZONE 'America/Sao_Paulo')::date THEN
      RAISE EXCEPTION 'Não é possível alterar a data do casamento depois que ela já passou.';
    END IF;

    IF OLD.wedding_date_changed_count >= 3 THEN
      RAISE EXCEPTION 'Limite de alterações da data do casamento atingido (máximo 3).';
    END IF;

    NEW.wedding_date_changed_count := OLD.wedding_date_changed_count + 1;
  END IF;

  RETURN NEW;
END;
$$;
