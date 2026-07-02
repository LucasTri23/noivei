-- Nome individual da noiva e do noivo (além de couple_names, usado para exibição)
-- Necessário para futuras regras de visibilidade (ex: não deixar o noivo ver o traje da noiva)
ALTER TABLE weddings
  ADD COLUMN bride_name TEXT,
  ADD COLUMN groom_name TEXT;
