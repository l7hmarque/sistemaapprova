
-- Tabela de leads (captação de demonstração)
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- dados pessoais
  nome text NOT NULL,
  email text NOT NULL,
  telefone text NOT NULL,
  cargo text NOT NULL,
  osc_nome text NOT NULL,

  -- interesse
  plano text NOT NULL CHECK (plano IN ('essencial','profissional','escritorio')),
  publico text CHECK (publico IN ('contador','gestor','outro')),

  -- enriquecimento opcional
  qtd_oscs integer,
  qtd_lancamentos integer,
  dor text,
  origem_descoberta text,

  -- atribuição
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  referrer text,
  user_agent text,
  ip_hash text,

  -- gestão interna
  status text NOT NULL DEFAULT 'novo' CHECK (status IN ('novo','contatado','demo_agendada','convertido','perdido','spam')),
  observacoes_internas text
);

CREATE INDEX idx_leads_created_at ON public.leads (created_at DESC);
CREATE INDEX idx_leads_status ON public.leads (status);
CREATE INDEX idx_leads_plano ON public.leads (plano);
CREATE INDEX idx_leads_utm_source ON public.leads (utm_source);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Apenas usuários autenticados (admin) podem visualizar leads.
-- Inserts vêm da server function via service role (bypassa RLS).
CREATE POLICY "auth_view_leads" ON public.leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_update_leads" ON public.leads FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Tabela de rate limit
CREATE TABLE public.leads_rate_limit (
  ip_hash text PRIMARY KEY,
  count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leads_rate_limit ENABLE ROW LEVEL SECURITY;
-- sem policies: só service role acessa
