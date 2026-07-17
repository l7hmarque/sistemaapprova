
ALTER TABLE public.cotacoes
  ADD COLUMN IF NOT EXISTS orcamento_vencedor_id uuid REFERENCES public.orcamentos_salvos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS evento_financeiro_id uuid REFERENCES public.eventos_financeiros(id) ON DELETE SET NULL;

ALTER TABLE public.convites_cotacao
  ADD COLUMN IF NOT EXISTS envios_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS ultimo_envio_em timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_convites_pendentes_expira
  ON public.convites_cotacao (organization_id, status, expira_em);
