-- Preferências de notificação: novo membro aceitou convite do casamento, e
-- marcos importantes da data do casamento (30/7/1 dias antes, no dia, dia seguinte)
ALTER TABLE profiles
  ADD COLUMN notify_members    BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN notify_milestones BOOLEAN NOT NULL DEFAULT TRUE;
