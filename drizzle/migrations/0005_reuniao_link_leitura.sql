CREATE TABLE public.reuniao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL CHECK (char_length(nome) BETWEEN 2 AND 120),
  data date NOT NULL DEFAULT current_date,
  token_hash text NOT NULL UNIQUE,
  criada_por uuid,
  criada_em timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz NOT NULL,
  encerrada_em timestamptz,
  encerrada_por uuid,
  CHECK (expira_em <= criada_em + interval '12 hours 1 minute')
);
GRANT SELECT, INSERT, UPDATE ON public.reuniao TO authenticated;
GRANT ALL ON public.reuniao TO service_role;
ALTER TABLE public.reuniao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin le reunioes" ON public.reuniao FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin cria reuniao" ON public.reuniao FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') AND criada_por = auth.uid());
CREATE POLICY "admin encerra reuniao" ON public.reuniao FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.reuniao_participante (
  user_id uuid PRIMARY KEY,
  reuniao_id uuid NOT NULL REFERENCES public.reuniao(id) ON DELETE CASCADE,
  nome text NOT NULL CHECK (char_length(nome) BETWEEN 2 AND 80),
  ip text,
  entrou_em timestamptz NOT NULL DEFAULT now(),
  ultimo_acesso timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.reuniao_participante (reuniao_id);
GRANT SELECT ON public.reuniao_participante TO authenticated;
GRANT ALL ON public.reuniao_participante TO service_role;
ALTER TABLE public.reuniao_participante ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin le participantes" ON public.reuniao_participante FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.reuniao_tentativa (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip text NOT NULL,
  quando timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.reuniao_tentativa (ip, quando);
GRANT ALL ON public.reuniao_tentativa TO service_role;
ALTER TABLE public.reuniao_tentativa ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER auditoria_reuniao AFTER INSERT OR UPDATE OR DELETE ON public.reuniao FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();
CREATE TRIGGER auditoria_reuniao_participante AFTER INSERT OR DELETE ON public.reuniao_participante FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();

-- Papel REUNIÃO: válido só com reunião ativa e atividade nos últimos 60 minutos.
CREATE OR REPLACE FUNCTION public.leitor_reuniao(_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (select 1 from public.reuniao_participante p join public.reuniao r on r.id = p.reuniao_id
    where p.user_id = _user_id and r.encerrada_em is null and r.expira_em > now()
      and p.ultimo_acesso > now() - interval '60 minutes')
$$;
CREATE OR REPLACE FUNCTION public.pode_ler(_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select public.is_member(_user_id) or public.leitor_reuniao(_user_id)
$$;
CREATE OR REPLACE FUNCTION public.votacao_encerrada_cenario(_cenario uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (select 1 from public.trilha_decisao t where t.cenario_candidato = _cenario and t.votacao_encerrada)
$$;

-- Dados da própria reunião para o selo (nome, fim e conectados). Nulo quando não vale mais.
CREATE OR REPLACE FUNCTION public.minha_reuniao() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select jsonb_build_object('id', r.id, 'nome', r.nome, 'expira_em', r.expira_em, 'eu', p.nome,
    'conectados', (select coalesce(jsonb_agg(q.nome order by q.entrou_em), '[]'::jsonb) from public.reuniao_participante q
                   where q.reuniao_id = r.id and q.ultimo_acesso > now() - interval '3 minutes'))
  from public.reuniao_participante p join public.reuniao r on r.id = p.reuniao_id
  where p.user_id = auth.uid() and public.leitor_reuniao(auth.uid())
$$;
-- Reuniões ativas e conectados, visíveis a membros com conta (selo para todos).
CREATE OR REPLACE FUNCTION public.reunioes_ativas() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'nome', r.nome, 'expira_em', r.expira_em,
    'conectados', (select coalesce(jsonb_agg(q.nome order by q.entrou_em), '[]'::jsonb) from public.reuniao_participante q
                   where q.reuniao_id = r.id and q.ultimo_acesso > now() - interval '3 minutes')) order by r.criada_em), '[]'::jsonb)
  from public.reuniao r
  where r.encerrada_em is null and r.expira_em > now() and public.is_member(auth.uid())
$$;
-- Pulso de presença: só atualiza a própria linha e só enquanto a reunião vale.
CREATE OR REPLACE FUNCTION public.reuniao_pulso() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if not public.leitor_reuniao(auth.uid()) then return false; end if;
  update public.reuniao_participante set ultimo_acesso = now() where user_id = auth.uid();
  return true;
end $$;
REVOKE EXECUTE ON FUNCTION public.reuniao_pulso() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.minha_reuniao() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.reunioes_ativas() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.reuniao_pulso(), public.minha_reuniao(), public.reunioes_ativas() TO authenticated;

-- Leitura: o papel REUNIÃO lê o mesmo que o Observador nas tabelas de análise.
DO $$
declare t text;
begin
  foreach t in array array['ata','ata_aceite','cenario','cenario_comentario','cenario_modulo','cenario_versao','checklist_equalizacao','cobertura','comentario_tecnico','criterio','entrega_declarada','item_proposta','modulo','pergunta_filtro','player','ponto_atencao','portao','portao_resultado','premissa','proposta','requisito','resposta_filtro','revelacao','rfp','trilha_decisao'] loop
    execute format('drop policy if exists "membros leem" on public.%I', t);
    execute format('create policy "membros leem" on public.%I for select to authenticated using (public.pode_ler(auth.uid()))', t);
  end loop;
end $$;

-- Notas e pré-mortem: só depois da revelação; votos: só após o encerramento da votação.
DROP POLICY "propria ou revelada" ON public.nota_socio;
CREATE POLICY "propria ou revelada" ON public.nota_socio FOR SELECT TO authenticated
  USING (socio_id = auth.uid() OR (public.pode_ler(auth.uid()) AND public.notas_reveladas(criterio_id)));
DROP POLICY "proprio ou todos enviaram" ON public.premorte;
CREATE POLICY "proprio ou todos enviaram" ON public.premorte FOR SELECT TO authenticated
  USING (socio_id = auth.uid() OR (public.pode_ler(auth.uid()) AND public.premortes_visiveis(cenario_id)));
DROP POLICY "membros leem votos" ON public.voto;
CREATE POLICY "membros leem votos" ON public.voto FOR SELECT TO authenticated
  USING (public.is_member(auth.uid()) OR (public.leitor_reuniao(auth.uid()) AND public.votacao_encerrada_cenario(cenario_id)));

-- Perfil: só quem tem papel altera o próprio perfil (sessões de reunião não escrevem).
DROP POLICY "editar proprio perfil" ON public.profiles;
CREATE POLICY "editar proprio perfil" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() AND public.is_member(auth.uid())) WITH CHECK (id = auth.uid() AND public.is_member(auth.uid()));
-- proposta_arquivo, storage 'propostas', log_auditoria, exportacao e filtro_salvo seguem restritos a contas com papel.