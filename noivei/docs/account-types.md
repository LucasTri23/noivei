# Contas de noivos e fornecedores

Cada identidade (e-mail do Supabase Auth) tem um único tipo permanente em profiles.account_type: couple ou vendor. A função administrativa continua independente em profiles.role.

Cadastro por senha grava o tipo; Google define o tipo no primeiro callback conforme a área escolhida. Login pelo tipo errado encerra a sessão e informa o conflito. Noivos não criam perfis de fornecedor e fornecedores não criam casamentos nem aceitam convites de casamento. A criação administrativa também exige um e-mail exclusivo para fornecedor.

Aplicar a migration 20261030000005 antes de publicar o código. Ela classifica contas existentes com perfil de fornecedor como vendor e as demais como couple. Contas novas sem tipo (OAuth/integrações) escolhem apenas uma vez; triggers no banco protegem a escolha inclusive em REST direto e operações concorrentes.

Se já houver uma conta com fornecedor e casamento, a migration interrompe sem apagar dados. Separe os registros em contas com e-mails distintos antes de executar novamente. Para localizar conflitos no SQL Editor:

```sql
SELECT u.id, u.email, vp.business_name
FROM auth.users u JOIN public.vendor_profiles vp ON vp.user_id = u.id
WHERE EXISTS (SELECT 1 FROM public.weddings w WHERE w.user_id = u.id)
   OR EXISTS (SELECT 1 FROM public.wedding_members wm WHERE wm.user_id = u.id);
```

A alteração local não executa migrations em produção.
