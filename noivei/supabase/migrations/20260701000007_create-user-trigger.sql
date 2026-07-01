-- Trigger: ao criar usuário, cria profile + assinatura gratuita
CREATE OR REPLACE FUNCTION fn_on_user_created()
RETURNS TRIGGER AS $$
BEGIN
  -- Cria perfil
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );

  -- Cria assinatura gratuita
  INSERT INTO public.subscriptions (user_id, plan_id, status)
  VALUES (NEW.id, 'free', 'active');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_users_on_insert
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION fn_on_user_created();
