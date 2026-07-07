
-- 1) Catálogo público de naturezas de despesa
CREATE TABLE public.naturezas_despesa (
  codigo TEXT PRIMARY KEY,
  descricao TEXT NOT NULL,
  grupo TEXT NOT NULL CHECK (grupo IN ('pessoal','material','servico','investimento','outros')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.naturezas_despesa TO anon, authenticated;
GRANT ALL ON public.naturezas_despesa TO service_role;
ALTER TABLE public.naturezas_despesa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "naturezas_read_all" ON public.naturezas_despesa FOR SELECT USING (true);
CREATE POLICY "naturezas_admin_write" ON public.naturezas_despesa FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Seed (baseado no REO exemplo)
INSERT INTO public.naturezas_despesa (codigo, descricao, grupo) VALUES
  ('3.1.90.11.01','Vencimentos e salários','pessoal'),
  ('3.1.90.11.43','13º salário','pessoal'),
  ('3.1.90.11.45','Férias - Abono constitucional','pessoal'),
  ('3.1.90.13.01','FGTS','pessoal'),
  ('3.1.90.13.02','Contribuições previdenciária - INSS','pessoal'),
  ('3.1.90.16.00','Outras despesas variáveis - Pessoal Civil','pessoal'),
  ('3.1.90.47.99','Outras obrigações tributárias e contributivas (pessoal)','pessoal'),
  ('3.1.90.49.00','Auxílio-transporte','pessoal'),
  ('3.1.90.94.00','Indenizações e restituições trabalhistas','pessoal'),
  ('3.3.90.30.01','Combustíveis e lubrificantes automotivos','material'),
  ('3.3.90.30.07','Gêneros de alimentação','material'),
  ('3.3.90.30.14','Material educativo e esportivo','material'),
  ('3.3.90.30.16','Material de expediente','material'),
  ('3.3.90.30.22','Material de limpeza e produtos de higienização','material'),
  ('3.3.90.30.23','Uniformes, tecidos e aviamentos','material'),
  ('3.3.90.33.03','Despesas com transporte escolar','servico'),
  ('3.3.90.36.15','Locação de imóvel','servico'),
  ('3.3.90.36.26','Serviços domésticos','servico'),
  ('3.3.90.36.39','Fretes e transportes de encomendas','servico'),
  ('3.3.90.39.05','Serviços técnicos profissionais','servico'),
  ('3.3.90.39.19','Manutenção e conservação de veículos','servico'),
  ('3.3.90.39.43','Serviços de energia elétrica','servico'),
  ('3.3.90.39.44','Serviços de água e esgoto','servico'),
  ('3.3.90.39.69','Seguros em Geral','servico'),
  ('3.3.90.39.81','Serviços bancários','servico'),
  ('3.3.90.39.99','Outros serviços de terceiros, pessoa jurídica','servico'),
  ('3.3.90.40.97','Despesas de teleprocessamento','servico'),
  ('3.3.90.47.99','Outras obrigações tributárias e contributivas','outros'),
  ('4.4.90.52.52','Veículo de tração mecânica','investimento'),
  ('4.4.90.52.99','Outros materiais permanentes','investimento')
ON CONFLICT (codigo) DO NOTHING;

-- 2) Plano de aplicação por org/vigência
CREATE TABLE public.plano_aplicacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vigencia_inicio DATE NOT NULL,
  vigencia_fim DATE NOT NULL,
  natureza_codigo TEXT NOT NULL REFERENCES public.naturezas_despesa(codigo),
  valor_previsto NUMERIC(14,2) NOT NULL DEFAULT 0,
  convenio TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, vigencia_inicio, natureza_codigo, convenio)
);
CREATE INDEX idx_plano_aplic_org ON public.plano_aplicacao(organization_id, vigencia_inicio);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plano_aplicacao TO authenticated;
GRANT ALL ON public.plano_aplicacao TO service_role;
ALTER TABLE public.plano_aplicacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plano_org_all" ON public.plano_aplicacao FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.user_orgs(auth.uid())))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.user_orgs(auth.uid())));
CREATE TRIGGER trg_plano_touch BEFORE UPDATE ON public.plano_aplicacao
  FOR EACH ROW EXECUTE FUNCTION public.touch_atualizado_em();

-- 3) Repasses recebidos (item 2.1)
CREATE TABLE public.repasses_recebidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  mes_referencia TEXT NOT NULL CHECK (mes_referencia ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  numero_parcela INTEGER NOT NULL,
  valor NUMERIC(14,2) NOT NULL,
  data_recebimento DATE NOT NULL,
  convenio TEXT,
  observacao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_repasses_org_mes ON public.repasses_recebidos(organization_id, mes_referencia);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.repasses_recebidos TO authenticated;
GRANT ALL ON public.repasses_recebidos TO service_role;
ALTER TABLE public.repasses_recebidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "repasses_org_all" ON public.repasses_recebidos FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.user_orgs(auth.uid())))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.user_orgs(auth.uid())));
CREATE TRIGGER trg_repasses_touch BEFORE UPDATE ON public.repasses_recebidos
  FOR EACH ROW EXECUTE FUNCTION public.touch_atualizado_em();

-- 4) Movimento bancário mensal (item 2.3)
CREATE TABLE public.movimento_bancario_mensal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  mes_referencia TEXT NOT NULL CHECK (mes_referencia ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  saldo_anterior NUMERIC(14,2) NOT NULL DEFAULT 0,
  rendimentos NUMERIC(14,2) NOT NULL DEFAULT 0,
  estornos_extra NUMERIC(14,2) NOT NULL DEFAULT 0,
  observacao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, mes_referencia)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.movimento_bancario_mensal TO authenticated;
GRANT ALL ON public.movimento_bancario_mensal TO service_role;
ALTER TABLE public.movimento_bancario_mensal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mov_org_all" ON public.movimento_bancario_mensal FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.user_orgs(auth.uid())))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.user_orgs(auth.uid())));
CREATE TRIGGER trg_mov_touch BEFORE UPDATE ON public.movimento_bancario_mensal
  FOR EACH ROW EXECUTE FUNCTION public.touch_atualizado_em();

-- 5) Extensão de eventos_financeiros
ALTER TABLE public.eventos_financeiros
  ADD COLUMN IF NOT EXISTS natureza_despesa_codigo TEXT REFERENCES public.naturezas_despesa(codigo),
  ADD COLUMN IF NOT EXISTS valor_estornado NUMERIC(14,2) NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_eventos_natureza ON public.eventos_financeiros(organization_id, natureza_despesa_codigo);

-- 6) Extensão de regras_despesa
ALTER TABLE public.regras_despesa
  ADD COLUMN IF NOT EXISTS set_natureza_codigo TEXT REFERENCES public.naturezas_despesa(codigo);
