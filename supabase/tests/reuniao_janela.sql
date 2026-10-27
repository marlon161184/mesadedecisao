-- Testa a expressão real da restrição sem inserir ou abrir nenhuma reunião.
-- A exceção final mantém o padrão de testes desfeitos do projeto.
DO $$
DECLARE
  regra text;
  aceitou boolean;
BEGIN
  SELECT pg_get_expr(conbin, conrelid) INTO regra
  FROM pg_constraint
  WHERE conrelid = 'public.reuniao'::regclass AND conname = 'reuniao_check';
  IF regra IS NULL THEN RAISE EXCEPTION 'FALHA · reuniao_check ausente'; END IF;

  EXECUTE format('SELECT %s FROM (SELECT timestamptz ''2026-10-27 23:15:00+00'' AS criada_em, timestamptz ''2026-10-31 23:15:00+00'' AS expira_em) reuniao', regra) INTO aceitou;
  IF aceitou IS DISTINCT FROM true THEN RAISE EXCEPTION 'FALHA · limite de 96 horas recusado'; END IF;

  EXECUTE format('SELECT %s FROM (SELECT timestamptz ''2026-10-27 23:15:00+00'' AS criada_em, timestamptz ''2026-10-31 23:16:00+00'' AS expira_em) reuniao', regra) INTO aceitou;
  IF aceitou IS DISTINCT FROM true THEN RAISE EXCEPTION 'FALHA · tolerância de 1 minuto recusada'; END IF;

  EXECUTE format('SELECT %s FROM (SELECT timestamptz ''2026-10-27 23:15:00+00'' AS criada_em, timestamptz ''2026-10-31 23:16:01+00'' AS expira_em) reuniao', regra) INTO aceitou;
  IF aceitou IS DISTINCT FROM false THEN RAISE EXCEPTION 'FALHA · acima de 96 horas e 1 minuto aceito'; END IF;

  RAISE EXCEPTION 'OK · restrição aceita 96h + 1min e recusa acima; nenhuma reunião criada (tudo desfeito)';
END $$;