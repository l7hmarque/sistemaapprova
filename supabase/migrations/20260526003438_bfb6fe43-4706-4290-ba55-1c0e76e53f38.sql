
CREATE TABLE public.cotacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objeto text NOT NULL,
  termo text,
  mes_referencia text,
  itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'coletando' CHECK (status IN ('coletando','pronto_para_mapa','finalizado')),
  mapa_drive_file_id text,
  mapa_drive_file_url text,
  observacoes text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cotacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth select" ON public.cotacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert" ON public.cotacoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update" ON public.cotacoes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete" ON public.cotacoes FOR DELETE TO authenticated USING (true);
CREATE TRIGGER touch_cotacoes BEFORE UPDATE ON public.cotacoes FOR EACH ROW EXECUTE FUNCTION public.touch_atualizado_em();

CREATE TABLE public.cotacao_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  objeto text,
  termo text,
  itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  fornecedores_sugeridos jsonb NOT NULL DEFAULT '[]'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cotacao_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth select" ON public.cotacao_presets FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert" ON public.cotacao_presets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update" ON public.cotacao_presets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete" ON public.cotacao_presets FOR DELETE TO authenticated USING (true);
CREATE TRIGGER touch_cotacao_presets BEFORE UPDATE ON public.cotacao_presets FOR EACH ROW EXECUTE FUNCTION public.touch_atualizado_em();

ALTER TABLE public.orcamentos_salvos
  ADD COLUMN IF NOT EXISTS cotacao_id uuid REFERENCES public.cotacoes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','preenchido','finalizado'));

CREATE INDEX IF NOT EXISTS idx_orcamentos_salvos_cotacao_id ON public.orcamentos_salvos(cotacao_id);
