-- "Quantidade de convidados" por convite — um convite pode cobrir mais de uma pessoa
-- (ex.: "Maria" com party_size=4 já inclui o marido e os 2 filhos dela). No RSVP, a
-- pessoa informa quantos de fato vão comparecer (attending_count, 1..party_size) e,
-- se for mais de 1, o nome/telefone de cada acompanhante vira um novo convidado
-- (parent_guest_id apontando pro convite principal), pra aparecer na lista de
-- Convidados como gente de verdade, não só um número solto.
--
-- party_size <= 20 é um teto defensivo (ninguém cadastra um convite pra mais de 20
-- pessoas na vida real) — sem isso, um convite com party_size absurdo permitiria
-- criar centenas de linhas de convidado numa única resposta de RSVP público.

ALTER TABLE guests
  ADD COLUMN party_size      INTEGER NOT NULL DEFAULT 1 CHECK (party_size BETWEEN 1 AND 20),
  ADD COLUMN attending_count INTEGER CHECK (attending_count IS NULL OR (attending_count BETWEEN 1 AND 20)),
  ADD COLUMN parent_guest_id UUID REFERENCES guests(id) ON DELETE CASCADE;

CREATE INDEX idx_guests_parent_guest_id ON guests(parent_guest_id) WHERE parent_guest_id IS NOT NULL;
