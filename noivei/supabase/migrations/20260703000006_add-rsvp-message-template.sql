-- Template configurável da mensagem de WhatsApp enviada ao convidado com o link de RSVP
-- Placeholders suportados: {nome} (nome do convidado) e {link} (URL pública do RSVP)
ALTER TABLE weddings
  ADD COLUMN rsvp_message_template TEXT NOT NULL DEFAULT
    'Oi {nome}! Estamos organizando nosso casamento e adoraríamos contar com você 💍 Confirma sua presença aqui: {link}';
