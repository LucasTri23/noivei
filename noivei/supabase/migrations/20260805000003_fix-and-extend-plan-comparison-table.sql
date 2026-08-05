-- Correção + extensão da tabela de comparação de recursos (plan_feature_*, ver
-- migration 20260723000002). Dois problemas encontrados ao revisar o conteúdo
-- contra os valores REAIS aplicados pelo produto (plan_limits, plan_module_access):
--
-- 1) A linha "Convidados" mostrava números que nunca corresponderam ao limite de
--    verdade (checkGuestLimit usa plan_limits.max_guests): dizia "Até 50 / Até 250 /
--    Ilimitados", o valor real sempre foi 100 / 500 / 999. Corrigido abaixo.
-- 2) A tabela nunca foi atualizada com os módulos adicionados depois dela existir:
--    Álbum de fotos (mural via QR code), Check-in no dia (Portaria) e o segundo
--    estilo de site (Portfólio). Adicionados abaixo, com o texto refletindo o
--    critério real de liberação (plan_module_access, hoje só o plano ativo mais
--    caro por padrão, ajustável em /admin/planos/modulos — os textos aqui dizem
--    "no plano Exclusivo" partindo do padrão de fábrica; se o admin mudar quem tem
--    acesso a esses módulos, esta tabela precisa ser reeditada em /admin/planos).
--
-- Não removidas nesta migration: várias outras linhas da categoria "Suporte &
-- personalização" (IA, Backup, Notificações Push, PDF/Excel, remoção de marca
-- d'água) descrevem recursos que não foram encontrados no código atual do produto
-- — não foram alteradas aqui de propósito, por serem conteúdo de marketing/decisão
-- de produto, não um bug factual claro como o dos convidados. Revisar manualmente
-- em /admin/planos.

DO $$
DECLARE
  feat        UUID;
  cat_convidados UUID;
  cat_id      UUID;
BEGIN
  -- 1) Corrige a linha "Convidados" (categoria "Limites") pro valor real de plan_limits.max_guests.
  SELECT pf.id INTO feat
  FROM plan_features pf
  JOIN plan_feature_categories pc ON pc.id = pf.category_id
  WHERE pc.title = 'Limites' AND pf.label = 'Convidados'
  LIMIT 1;

  IF feat IS NOT NULL THEN
    UPDATE plan_feature_values SET value = 'Até 100' WHERE feature_id = feat AND group_key = 'free';
    UPDATE plan_feature_values SET value = 'Até 500' WHERE feature_id = feat AND group_key = 'premium';
    UPDATE plan_feature_values SET value = 'Até 999' WHERE feature_id = feat AND group_key = 'plus';
  END IF;

  -- 2) Novas linhas em "Convidados & site" (categoria já existente) — módulos
  -- criados depois desta tabela existir.
  SELECT id INTO cat_convidados FROM plan_feature_categories WHERE title = 'Convidados & site' LIMIT 1;

  IF cat_convidados IS NOT NULL THEN
    -- Estilo do site: Clássico é liberado pra qualquer plano pago (mesmo critério
    -- de "Site do casal" já existente); Portfólio depende do módulo 'album' —
    -- hoje só o plano ativo mais caro por padrão (Exclusivo, pagamento único).
    INSERT INTO plan_features (category_id, label, sort_order)
    VALUES (cat_convidados, 'Estilo do site', 4)
    RETURNING id INTO feat;
    INSERT INTO plan_feature_values (feature_id, group_key, value) VALUES
      (feat, 'free',    '—'),
      (feat, 'premium', 'Clássico'),
      (feat, 'plus',    'Clássico + Portfólio');

    -- Álbum de fotos (mural via QR code, convidados enviam foto anônimo no dia).
    INSERT INTO plan_features (category_id, label, sort_order)
    VALUES (cat_convidados, 'Álbum de fotos (mural via QR code)', 5)
    RETURNING id INTO feat;
    INSERT INTO plan_feature_values (feature_id, group_key, value) VALUES
      (feat, 'free',    '❌'),
      (feat, 'premium', '❌'),
      (feat, 'plus',    '✅');

    -- Check-in no dia (Portaria): validação de entrada por QR code do ingresso.
    INSERT INTO plan_features (category_id, label, sort_order)
    VALUES (cat_convidados, 'Check-in no dia (Portaria/QR)', 6)
    RETURNING id INTO feat;
    INSERT INTO plan_feature_values (feature_id, group_key, value) VALUES
      (feat, 'free',    '❌'),
      (feat, 'premium', '❌'),
      (feat, 'plus',    '✅');
  END IF;
END $$;
