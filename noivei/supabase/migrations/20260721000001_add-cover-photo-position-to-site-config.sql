-- Posição vertical de enquadramento da foto de capa (usada com background-position-y no
-- site público, já que a capa usa background-size: cover e pode cortar o casal da foto
-- dependendo da composição). 0 = topo, 50 = centro (comportamento atual/padrão), 100 = base.
ALTER TABLE site_config
  ADD COLUMN cover_photo_position INTEGER NOT NULL DEFAULT 50
    CHECK (cover_photo_position BETWEEN 0 AND 100);
