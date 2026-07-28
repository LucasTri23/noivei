-- Noivo e noiva entram em momentos separados do cortejo (não como uma dupla só) —
-- cada um precisa da própria posição, não uma posição combinada. Substitui
-- couple_entrance_position (20260727000004) por duas colunas independentes.
ALTER TABLE weddings
  ADD COLUMN IF NOT EXISTS groom_entrance_position INTEGER NOT NULL DEFAULT 999999,
  ADD COLUMN IF NOT EXISTS bride_entrance_position INTEGER NOT NULL DEFAULT 1000000;

-- Preserva a posição já escolhida por quem tiver mexido nisso antes da separação,
-- em vez de resetar pro default (bride sempre um passo depois do valor salvo, pra
-- manter a tradição de o noivo entrar antes já refletida no default acima).
UPDATE weddings
SET groom_entrance_position = couple_entrance_position,
    bride_entrance_position = couple_entrance_position + 1
WHERE couple_entrance_position IS NOT NULL AND couple_entrance_position < 999999;

ALTER TABLE weddings DROP COLUMN IF EXISTS couple_entrance_position;
