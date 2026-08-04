-- Zoom extra da foto de capa do site público, usado em conjunto com cover_photo_position
-- (ver migration 20260721000001). O template "portfolio" renderiza a capa em tela cheia
-- (minHeight: 100vh) enquanto o "classic" usa um banner curto — com a MESMA foto e o
-- MESMO background-size: cover, a área muito mais alta do portfólio pode exigir um recorte
-- bem mais agressivo, e a posição vertical sozinha só decide QUAL parte da foto aparece,
-- não QUANTO da foto aparece. Este campo dá esse controle de zoom ao casal.
-- Conversão do valor 0-100 para a escala CSS (transform: scale) aplicada por cima do
-- background-size: cover já calculado automaticamente: fator = 1 + (zoom/100) * 0.6,
-- ou seja, de 1.0x (sem zoom extra) a 1.6x no máximo — teto escolhido para não pixelizar/
-- distorcer a foto. 0 = sem zoom extra (comportamento atual, cover puro; padrão, para não
-- mudar nada em site já publicado), 100 = zoom máximo permitido (1.6x).
ALTER TABLE site_config
  ADD COLUMN cover_photo_zoom INTEGER NOT NULL DEFAULT 0
    CHECK (cover_photo_zoom BETWEEN 0 AND 100);
