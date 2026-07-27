-- Permite ao casal decidir em que ponto do cortejo noivo e noiva entram (hoje era
-- fixo — sempre mostrado como a entrada final, sem poder mudar). O valor conta
-- quantas entradas do cortejo (wedding_party_entries) aparecem ANTES dos noivos;
-- o default alto preserva o comportamento atual (sempre por último) até o casal
-- decidir mudar. A posição é ajustada visualmente (clamp) se o número de entradas
-- do cortejo mudar depois — não precisa recalcular aqui.
ALTER TABLE weddings
  ADD COLUMN IF NOT EXISTS couple_entrance_position INTEGER NOT NULL DEFAULT 999999;
