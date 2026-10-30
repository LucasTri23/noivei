-- Corrige regressão da policy SELECT introduzida em 20261030000001.
-- INSERT ... RETURNING (supabase .insert().select()) também avalia SELECT.
-- fn_can_access_conversation é STABLE e consulta vendor_conversations: usa o
-- snapshot do início da instrução e não enxerga a conversa recém-inserida.
-- Valida os campos da própria linha, consultando apenas casamento/fornecedor.
-- Mantém a restrição de acesso do fornecedor aos status aprovados.
ALTER POLICY "participants can read own conversation"
ON public.vendor_conversations
USING (
  public.fn_has_module_access(wedding_id, auth.uid(), 'fornecedores')
  OR EXISTS (
    SELECT 1 FROM public.vendor_profiles vp
    WHERE vp.id = vendor_conversations.vendor_id
      AND vp.user_id = auth.uid()
      AND vp.status IN ('active', 'paused')
  )
);
