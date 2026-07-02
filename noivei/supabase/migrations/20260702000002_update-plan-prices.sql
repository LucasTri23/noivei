-- Atualiza preços conforme nova proposta comercial
-- Premium (pagamento único): R$99,90 -> R$149,90 (válido até 1 ano após a data do casamento)
-- Premium Plus (pagamento único): R$149,90 -> R$299,00 (válido até um período após o casamento, não vitalício)
UPDATE plans SET price_brl = 14990, description = 'Acesso completo, pagamento único (válido até 1 ano após o casamento)' WHERE id = 'premium_once';
UPDATE plans SET price_brl = 29900, description = 'Tudo do Premium + IA, pagamento único (válido até um período após o casamento)' WHERE id = 'premium_plus_once';
