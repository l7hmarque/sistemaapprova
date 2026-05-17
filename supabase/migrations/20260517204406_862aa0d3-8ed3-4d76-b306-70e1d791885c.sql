
CREATE TABLE public.fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj text UNIQUE NOT NULL,
  razao_social text NOT NULL,
  representante_legal text,
  cpf_representante text,
  endereco text,
  email text,
  telefone text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fornecedores select all" ON public.fornecedores FOR SELECT TO public USING (true);
CREATE POLICY "fornecedores insert anon" ON public.fornecedores FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "fornecedores delete anon" ON public.fornecedores FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE public.objetos_cotacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao text NOT NULL,
  unidade_padrao text,
  categoria text,
  uso_count integer NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX objetos_cotacao_descricao_uniq ON public.objetos_cotacao (lower(descricao));
ALTER TABLE public.objetos_cotacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "objetos select all" ON public.objetos_cotacao FOR SELECT TO public USING (true);
CREATE POLICY "objetos insert anon" ON public.objetos_cotacao FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "objetos delete anon" ON public.objetos_cotacao FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE public.orcamento_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  objeto text,
  termo text,
  itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  fornecedores_sugeridos jsonb NOT NULL DEFAULT '[]'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.orcamento_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "presets select all" ON public.orcamento_presets FOR SELECT TO public USING (true);
CREATE POLICY "presets insert anon" ON public.orcamento_presets FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "presets delete anon" ON public.orcamento_presets FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE public.orcamentos_salvos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('cotacao','mapa_comparativo')),
  objeto text,
  termo text,
  mes_referencia text,
  fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  dados jsonb NOT NULL,
  drive_file_id text,
  drive_file_url text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.orcamentos_salvos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orcamentos select all" ON public.orcamentos_salvos FOR SELECT TO public USING (true);
CREATE POLICY "orcamentos insert anon" ON public.orcamentos_salvos FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "orcamentos delete anon" ON public.orcamentos_salvos FOR DELETE TO anon, authenticated USING (true);
