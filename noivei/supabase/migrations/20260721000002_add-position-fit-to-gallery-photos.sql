-- Ajuste de recorte por foto da galeria — mesmo problema relatado para a foto de capa
-- (cover_photo_position, ver 20260721000001): a pessoa importante da foto às vezes "some"
-- no recorte automático de object-fit: cover. Aqui aplicamos o mesmo conceito às fotos que
-- acompanham a linha do tempo/grid de galeria do site público:
--   position_y  — desloca o enquadramento vertical (0 = topo, 50 = centro, 100 = base)
--                 quando a foto usa object-fit: cover.
--   fit_contain — troca pra object-fit: contain (mostra a foto inteira, sem cortar, com
--                 possível barra neutra ao redor) quando nem o ajuste de posição resolve.
ALTER TABLE wedding_gallery_photos
  ADD COLUMN position_y  INTEGER NOT NULL DEFAULT 50 CHECK (position_y BETWEEN 0 AND 100),
  ADD COLUMN fit_contain BOOLEAN NOT NULL DEFAULT FALSE;
