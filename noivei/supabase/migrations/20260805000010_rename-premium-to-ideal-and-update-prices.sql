-- Renomeia o plano "Premium" para "Ideal" (pedido direto do dono do produto) e
-- atualiza os preços dos planos pagos. Como `plans.name`/`plans.price_brl` são
-- lidos dinamicamente em toda a vitrine (cards, comparação, onboarding, FAQ) —
-- nenhum componente hardcoda o nome do plano, só posição/price_brl/highlight —
-- esta migration sozinha já propaga a mudança pra todo lugar que lê do banco.
-- Lugares com texto LIVRE (não vindo de `plans`) precisam de ajuste manual à
-- parte no código — ver commit que acompanha esta migration.
--
-- De quebra, remove a menção a "+ IA" da descrição do plano Exclusivo — mesma
-- limpeza de conteúdo fictício do item 1 do roadmap V1.1 (não existe recurso de
-- IA implementado), só que esta linha específica só foi encontrada agora.
UPDATE plans SET name = 'Ideal', price_brl = 1990
  WHERE id = 'premium_monthly';
UPDATE plans SET name = 'Ideal', price_brl = 9700
  WHERE id = 'premium_once';
UPDATE plans SET name = 'Exclusivo', price_brl = 3490
  WHERE id = 'premium_plus_monthly';
UPDATE plans SET name = 'Exclusivo', price_brl = 19700
  WHERE id = 'premium_plus_once';

UPDATE plans SET description = 'Tudo do Ideal, mais módulos exclusivos, mensal'
  WHERE id = 'premium_plus_monthly';
UPDATE plans SET description = 'Tudo do Ideal, mais módulos exclusivos, único'
  WHERE id = 'premium_plus_once';
