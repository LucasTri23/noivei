-- Rastreia quando o casal enviou (ou reenviou) o link de confirmação pro convidado
-- pelo WhatsApp — hoje o botão "Enviar por WhatsApp" só abre o wa.me, sem deixar
-- nenhum registro de que aquele convidado já foi avisado. Sem isso, o casal perde a
-- noção de quem já recebeu o link, especialmente relevante agora que a confirmação
-- redireciona pro site do casal: se o convidado quiser voltar e mudar a resposta
-- depois, o jeito de achar o link de novo é o casal reenviar — e pra reenviar de forma
-- consciente, o casal precisa saber que já enviou uma vez.
ALTER TABLE guests
  ADD COLUMN invite_sent_at TIMESTAMPTZ;
