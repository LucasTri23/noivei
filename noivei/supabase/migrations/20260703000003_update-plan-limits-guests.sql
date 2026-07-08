-- Alinha os limites de convidados com a tabela de planos definida depois do seed original
-- (Gratuito: 50 · Premium: 250 · Premium Plus: ilimitado)
UPDATE plan_limits SET value = 50     WHERE feature = 'max_guests' AND plan_id = 'free';
UPDATE plan_limits SET value = 250    WHERE feature = 'max_guests' AND plan_id IN ('premium_monthly', 'premium_once');
UPDATE plan_limits SET value = 999999 WHERE feature = 'max_guests' AND plan_id IN ('premium_plus_monthly', 'premium_plus_once');
