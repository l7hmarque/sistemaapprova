
-- Snapshot imutável de prestação mensal
CREATE TABLE public.prestacoes_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes_referencia text NOT NULL,
  titulo text,
  pdf_url text,
  pdf_path text,
  assinatura_hash text NOT NULL,
  manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_eventos integer NOT NULL DEFAULT 0,
  total_documentos integer NOT NULL DEFAULT 0,
  gerado_em timestamptz NOT NULL DEFAULT now(),
  gerado_por uuid
);

CREATE INDEX idx_prestacoes_snapshot_mes ON public.prestacoes_snapshot(mes_referencia DESC, gerado_em DESC);

ALTER TABLE public.prestacoes_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_view_snapshots" ON public.prestacoes_snapshot
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_insert_snapshots" ON public.prestacoes_snapshot
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth_delete_snapshots" ON public.prestacoes_snapshot
  FOR DELETE TO authenticated USING (true);

-- Bucket privado para PDFs gerados
INSERT INTO storage.buckets (id, name, public) VALUES ('prestacoes', 'prestacoes', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "auth_view_prestacoes_objects" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'prestacoes');

CREATE POLICY "auth_insert_prestacoes_objects" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'prestacoes');

CREATE POLICY "auth_delete_prestacoes_objects" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'prestacoes');
