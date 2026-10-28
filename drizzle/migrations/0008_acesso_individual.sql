CREATE TABLE public.acesso_autorizado (
  email text PRIMARY KEY CHECK (email = lower(btrim(email))),
  nome text,
  grupo text NOT NULL CHECK (grupo IN ('Sócios','Conselheiros','Colaboradores')),
  user_id uuid,
  convidado_em timestamptz,
  revogado_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.acesso_autorizado TO authenticated;
GRANT ALL ON public.acesso_autorizado TO service_role;
ALTER TABLE public.acesso_autorizado ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin le acessos" ON public.acesso_autorizado FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin altera acessos" ON public.acesso_autorizado FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER auditoria_acesso_autorizado AFTER INSERT OR UPDATE OR DELETE ON public.acesso_autorizado FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();

CREATE TABLE public.tentativa_login (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL,
  ip text,
  sucesso boolean NOT NULL,
  quando timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tentativa_login_email_quando ON public.tentativa_login (email, quando DESC);
GRANT ALL ON public.tentativa_login TO service_role;
ALTER TABLE public.tentativa_login ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.log_entrada (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  email text NOT NULL,
  ip text,
  quando timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.log_entrada TO authenticated;
GRANT ALL ON public.log_entrada TO service_role;
ALTER TABLE public.log_entrada ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin le entradas" ON public.log_entrada FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  if coalesce(new.raw_app_meta_data->>'reuniao', '') = 'true' then
    return new;
  end if;
  insert into public.profiles (id, email, nome)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  elsif exists (select 1 from public.acesso_autorizado a where a.email = lower(new.email) and a.revogado_em is null) then
    -- Pessoas da lista autorizada entram sempre com o papel de leitura.
    update public.acesso_autorizado set user_id = new.id where email = lower(new.email);
    insert into public.user_roles (user_id, role) values (new.id, 'observador') on conflict do nothing;
  end if;
  return new;
end $function$;