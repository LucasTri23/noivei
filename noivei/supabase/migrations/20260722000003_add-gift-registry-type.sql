-- Lista de presentes: o casal agora escolhe, por item, como o convidado presenteia:
-- 'link'        -> like hoje, um link externo (store_url) pra onde comprar
-- 'app_payment' -> presente "fictício"/simbólico (ex.: "opinar no casamento") sem
--                  loja real — o valor é só simbólico e o dinheiro cairia na conta do
--                  casal via pagamento dentro do próprio app. A integração de
--                  pagamento em si ainda não existe: por enquanto o site público só
--                  sinaliza esse modo (ver [slug]/page.tsx), sem processar nada.
--
-- DEFAULT 'link' preserva compatibilidade com todo item já cadastrado (todos usavam
-- store_url até aqui).

ALTER TABLE gift_registry_items
  ADD COLUMN gift_type TEXT NOT NULL DEFAULT 'link' CHECK (gift_type IN ('link', 'app_payment'));
