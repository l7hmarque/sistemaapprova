
-- Helper: drop all existing policies on each table and recreate as authenticated-only
DO $$
DECLARE
  t text;
  p record;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'configuracoes','extracoes_salvas','fornecedores','modelos_planilha',
    'objetos_cotacao','orcamento_presets','orcamentos_salvos','prestacao_documentos'
  ])
  LOOP
    FOR p IN
      SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format($f$
      CREATE POLICY "auth select" ON public.%I FOR SELECT TO authenticated USING (true);
      CREATE POLICY "auth insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (true);
      CREATE POLICY "auth update" ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
      CREATE POLICY "auth delete" ON public.%I FOR DELETE TO authenticated USING (true);
    $f$, t, t, t, t);
  END LOOP;
END $$;
