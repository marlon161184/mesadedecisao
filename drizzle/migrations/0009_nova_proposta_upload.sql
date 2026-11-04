CREATE TABLE public.proposta_rascunho (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_numero integer NOT NULL DEFAULT 2,
  arquivo_caminho text NOT NULL,
  arquivo_nome text NOT NULL,
  arquivo_tipo text NOT NULL CHECK (arquivo_tipo IN ('pdf','docx','pptx','xlsx')),
  arquivo_tamanho integer NOT NULL CHECK (arquivo_tamanho > 0 AND arquivo_tamanho <= 20971520),
  status text NOT NULL DEFAULT 'enviado' CHECK (status IN ('enviado','lido','manual','aprovado','descartado')),
  erro text,
  conteudo jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_por uuid NOT NULL DEFAULT auth.uid(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  lido_em timestamptz,
  aprovado_por uuid,
  aprovado_em timestamptz,
  proposta_id uuid REFERENCES public.proposta(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposta_rascunho TO authenticated;
GRANT ALL ON public.proposta_rascunho TO service_role;
ALTER TABLE public.proposta_rascunho ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin le rascunho" ON public.proposta_rascunho FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin cria rascunho" ON public.proposta_rascunho FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') AND criado_por = auth.uid());
CREATE POLICY "admin altera rascunho" ON public.proposta_rascunho FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin exclui rascunho" ON public.proposta_rascunho FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER auditoria_proposta_rascunho AFTER INSERT OR UPDATE OR DELETE ON public.proposta_rascunho FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();

CREATE OR REPLACE FUNCTION public.grupo_socios(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.acesso_autorizado a
    WHERE a.user_id = _user_id AND a.grupo = 'Sócios' AND a.revogado_em IS NULL)
$$;

CREATE TABLE public.parecer_proposta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id uuid NOT NULL REFERENCES public.proposta(id),
  texto text NOT NULL,
  origem text NOT NULL CHECK (origem IN ('regra','ia')),
  revisado boolean NOT NULL DEFAULT false,
  publicado boolean NOT NULL DEFAULT false,
  autor uuid NOT NULL DEFAULT auth.uid(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  publicado_em timestamptz,
  CONSTRAINT parecer_publicado_revisado CHECK (NOT publicado OR revisado)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parecer_proposta TO authenticated;
GRANT ALL ON public.parecer_proposta TO service_role;
ALTER TABLE public.parecer_proposta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin ou socio le publicado" ON public.parecer_proposta FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin')
  OR (publicado AND (public.grupo_socios(auth.uid()) OR public.leitor_reuniao(auth.uid())))
);
CREATE POLICY "admin cria parecer" ON public.parecer_proposta FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin altera parecer" ON public.parecer_proposta FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin exclui parecer" ON public.parecer_proposta FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER auditoria_parecer_proposta AFTER INSERT OR UPDATE OR DELETE ON public.parecer_proposta FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();