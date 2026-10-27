ALTER TABLE public.reuniao DROP CONSTRAINT reuniao_check;
ALTER TABLE public.reuniao ADD CONSTRAINT reuniao_check CHECK (expira_em <= criada_em + interval '96 hours' + interval '1 minute');