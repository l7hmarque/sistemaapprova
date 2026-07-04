
-- 1) Fila de sincronização Drive
CREATE TABLE public.drive_sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bucket text NOT NULL,
  path text NOT NULL,
  section text NOT NULL,
  mes_ref text,
  ref_table text,
  ref_id uuid,
  nome_original text,
  mime_type text,
  status text NOT NULL DEFAULT 'pendente',
  tentativas int NOT NULL DEFAULT 0,
  proximo_retry timestamptz NOT NULL DEFAULT now(),
  ultimo_erro text,
  drive_file_id text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT drive_sync_queue_status_chk
    CHECK (status IN ('pendente','em_andamento','sincronizado','falhou_retry','falhou_definitivo'))
);

GRANT SELECT ON public.drive_sync_queue TO authenticated;
GRANT ALL ON public.drive_sync_queue TO service_role;
ALTER TABLE public.drive_sync_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org read own queue"
  ON public.drive_sync_queue FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.user_orgs(auth.uid())));

CREATE INDEX ix_drive_queue_pending
  ON public.drive_sync_queue (proximo_retry)
  WHERE status IN ('pendente','falhou_retry');

CREATE INDEX ix_drive_queue_org
  ON public.drive_sync_queue (organization_id, status);

CREATE INDEX ix_drive_queue_ref
  ON public.drive_sync_queue (ref_table, ref_id)
  WHERE ref_id IS NOT NULL;

CREATE TRIGGER trg_drive_queue_touch
  BEFORE UPDATE ON public.drive_sync_queue
  FOR EACH ROW EXECUTE FUNCTION public.touch_atualizado_em();

-- 2) RPC de dequeue atômico
CREATE OR REPLACE FUNCTION public.drive_queue_claim(_limit int DEFAULT 10)
RETURNS SETOF public.drive_sync_queue
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  UPDATE public.drive_sync_queue q
     SET status = 'em_andamento',
         tentativas = q.tentativas + 1,
         atualizado_em = now()
   WHERE q.id IN (
     SELECT id FROM public.drive_sync_queue
      WHERE status IN ('pendente','falhou_retry')
        AND proximo_retry <= now()
      ORDER BY proximo_retry ASC
      LIMIT _limit
      FOR UPDATE SKIP LOCKED
   )
   RETURNING q.*;
END;
$$;

REVOKE ALL ON FUNCTION public.drive_queue_claim(int) FROM public;
GRANT EXECUTE ON FUNCTION public.drive_queue_claim(int) TO service_role;

-- 3) Colunas novas
ALTER TABLE public.documentos_anexos ADD COLUMN IF NOT EXISTS drive_file_id text;
ALTER TABLE public.prestacao_documentos ADD COLUMN IF NOT EXISTS drive_file_id text;
ALTER TABLE public.prestacoes_snapshot ADD COLUMN IF NOT EXISTS versao int NOT NULL DEFAULT 1;
ALTER TABLE public.prestacoes_snapshot ADD COLUMN IF NOT EXISTS revogado_em timestamptz;
ALTER TABLE public.prestacoes_snapshot ADD COLUMN IF NOT EXISTS revogado_por uuid;
ALTER TABLE public.prestacoes_snapshot ADD COLUMN IF NOT EXISTS revogado_motivo text;

-- 4) Trigger de trava de snapshot em eventos_financeiros
CREATE OR REPLACE FUNCTION public.fn_lock_snapshot_eventos()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- só bloqueia se o evento estava vinculado a um snapshot NÃO revogado
  IF TG_OP = 'DELETE' THEN
    IF OLD.prestacao_snapshot_id IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM public.prestacoes_snapshot ps
          WHERE ps.id = OLD.prestacao_snapshot_id AND ps.revogado_em IS NULL
       ) THEN
      RAISE EXCEPTION 'Período homologado — reabra a prestação antes de excluir (id=%).', OLD.id
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.prestacao_snapshot_id IS NULL THEN RETURN NEW; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.prestacoes_snapshot ps
     WHERE ps.id = OLD.prestacao_snapshot_id AND ps.revogado_em IS NULL
  ) THEN
    RETURN NEW;
  END IF;

  -- Allowlist: campos que podem ser editados mesmo com snapshot ativo.
  IF (NEW.observacao IS DISTINCT FROM OLD.observacao)
     OR (NEW.tags IS DISTINCT FROM OLD.tags)
     OR (NEW.excluido_em IS DISTINCT FROM OLD.excluido_em)
     OR (NEW.excluido_por IS DISTINCT FROM OLD.excluido_por)
     OR (NEW.prestacao_snapshot_id IS DISTINCT FROM OLD.prestacao_snapshot_id)
  THEN
    -- OK — mas checa se ALÉM disso mudou algo mais
    IF (to_jsonb(NEW) - 'observacao' - 'tags' - 'excluido_em' - 'excluido_por' - 'prestacao_snapshot_id' - 'atualizado_em')
       IS DISTINCT FROM
       (to_jsonb(OLD) - 'observacao' - 'tags' - 'excluido_em' - 'excluido_por' - 'prestacao_snapshot_id' - 'atualizado_em')
    THEN
      RAISE EXCEPTION 'Período homologado — reabra a prestação antes de editar (id=%).', OLD.id
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  -- Sem alteração na allowlist: qualquer diferença bloqueia
  IF to_jsonb(NEW) - 'atualizado_em' IS DISTINCT FROM to_jsonb(OLD) - 'atualizado_em' THEN
    RAISE EXCEPTION 'Período homologado — reabra a prestação antes de editar (id=%).', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lock_snapshot_eventos
  BEFORE UPDATE OR DELETE ON public.eventos_financeiros
  FOR EACH ROW EXECUTE FUNCTION public.fn_lock_snapshot_eventos();

-- 5) Trigger análogo em documentos_anexos
CREATE OR REPLACE FUNCTION public.fn_lock_snapshot_anexos()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_evento uuid;
  v_snap uuid;
BEGIN
  v_evento := COALESCE(NEW.evento_id, OLD.evento_id);
  IF v_evento IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  SELECT prestacao_snapshot_id INTO v_snap
    FROM public.eventos_financeiros WHERE id = v_evento;
  IF v_snap IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.prestacoes_snapshot ps WHERE ps.id = v_snap AND ps.revogado_em IS NULL) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'Anexo pertence a prestação homologada — reabra antes de alterar/remover.'
    USING ERRCODE = 'check_violation';
END;
$$;

CREATE TRIGGER trg_lock_snapshot_anexos
  BEFORE UPDATE OR DELETE ON public.documentos_anexos
  FOR EACH ROW EXECUTE FUNCTION public.fn_lock_snapshot_anexos();

REVOKE EXECUTE ON FUNCTION public.fn_lock_snapshot_eventos() FROM public;
REVOKE EXECUTE ON FUNCTION public.fn_lock_snapshot_anexos() FROM public;
