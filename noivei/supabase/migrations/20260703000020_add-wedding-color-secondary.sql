-- Cor secundária do casamento — complementa wedding_color (cor "principal") com um
-- segundo tom usado no site público e em detalhes de UI (ex: item ativo do menu lateral).
-- Default reaproveita o rose-cobre que já é o acento secundário do design system
-- (globals.css, --color-accent).
ALTER TABLE weddings
  ADD COLUMN wedding_color_secondary TEXT NOT NULL DEFAULT '#C89070';
