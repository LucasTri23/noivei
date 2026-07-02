-- Preferências de notificação do usuário
-- TODO Fase 2: usar essas preferências no envio real de e-mail/push
ALTER TABLE profiles
  ADD COLUMN notify_timeline BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN notify_rsvp     BOOLEAN NOT NULL DEFAULT TRUE;
