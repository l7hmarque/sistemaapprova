ALTER TABLE public.configuracoes DROP CONSTRAINT IF EXISTS configuracoes_pkey;
ALTER TABLE public.configuracoes ADD CONSTRAINT configuracoes_pkey PRIMARY KEY (organization_id, chave);