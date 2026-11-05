ALTER TABLE public.pergunta_filtro
  ADD COLUMN player_id uuid NULL REFERENCES public.player(id) ON DELETE CASCADE,
  ADD COLUMN secao text NULL,
  ADD COLUMN ordem integer NULL,
  ADD COLUMN prazo_resposta timestamptz NULL;
CREATE INDEX pergunta_filtro_player_idx ON public.pergunta_filtro(player_id);
COMMENT ON COLUMN public.pergunta_filtro.player_id IS 'Nulo = pergunta geral, vale para todas as propostas do RFP.';