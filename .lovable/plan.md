
# Milestone 3 — Confiabilidade de Captura, Sincronização e Bloqueio

Diretrizes cobertas do plano mestre: **#2 (Separação Storage ↔ Drive)** e **#4 (Imutabilidade de períodos homologados)**, mais o polimento de UX de captura que hoje falha silenciosamente quando o Drive/Connector oscila.

Hoje o fluxo é frágil em três pontos:
- `salvarComprovante` grava só no Supabase Storage (`comprovantes.functions.ts` L93). O Drive não recebe cópia — o "master" fica desatualizado.
- `orcamentos/cotacoes/prestacao` sobem direto pro Drive dentro do request; se o gateway do Google falha, o usuário vê erro no meio do fluxo.
- Após gerar snapshot (`prestacao-snapshot.functions.ts`), nada impede `UPDATE`/`DELETE` posterior em `eventos_financeiros` daquele mês, quebrando o hash da prestação.

---

## 3.1 Fila assíncrona Drive (Storage = fonte de verdade quente)

**Tabela nova** `public.drive_sync_queue` (JSONB payload, status, tentativas, próximo_retry, erro_ultimo, organization_id) com RLS por org e GRANT service_role.

**Enfileiramento síncrono, upload assíncrono:**
- `salvarComprovante` e demais escritas (orçamento/cotação/prestação) passam a: (1) gravar no Supabase Storage imediatamente, (2) inserir 1 job em `drive_sync_queue` com `{ bucket, path, sectionDrive, mesRef, docType, refId }`, (3) retornar sucesso. O usuário não espera o Drive.
- Worker: server route `POST /api/public/hooks/drive-sync-tick` (auth via `apikey` = anon key) processa até N jobs `pendente|falhou_retry` cujo `proximo_retry <= now()`. Pega `FOR UPDATE SKIP LOCKED` (Postgres) via RPC dedicado para evitar corrida.
- Retry exponencial (30s → 2min → 10min → 1h → 6h; máx 5 tentativas → `falhou_definitivo`).
- Agendado por `pg_cron` a cada 1 min chamando o endpoint com `apikey` do anon.
- Atualiza `documentos_anexos.drive_file_id` (coluna nova nullable) quando o upload conclui.

**UI:** badge "Sincronizando com Drive" em `admin.arquivos` para itens ainda pendentes; painel simples em `owner.suporte` mostrando contagem de falhas por org.

**Compensações:** o proxy `/api/files/:id/preview` já lê do Drive; enquanto não sincronizou, o preview cai de volta para o signed URL do bucket `documentos`.

## 3.2 Trava de imutabilidade (snapshot lock)

**Trigger** `trg_eventos_financeiros_lock_snapshot` `BEFORE UPDATE OR DELETE`:
- Se `OLD.prestacao_snapshot_id IS NOT NULL` **e** o campo alterado não estiver na allowlist (`observacao`, `tags`, `excluido_em/por` para soft-delete), `RAISE EXCEPTION 'Período homologado — reabra a prestação antes de editar'`.
- `DELETE` físico continua interceptado pelo trigger M1; adiciona verificação equivalente antes do soft-delete.

**Trigger análogo** em `documentos_anexos`: bloqueia remoção/alteração de anexos vinculados a evento com snapshot.

**Reabertura controlada:** server function `reabrirPrestacao({ snapshotId, motivo })` — só `owner/admin` da org, marca snapshot como `revogado_em/por/motivo`, zera `prestacao_snapshot_id` dos eventos, grava em `audit_log`. Nova geração cria snapshot v2 (a numeração já existe? confirmar em `prestacoes_snapshot` — se não, adicionar coluna `versao INT` com sequência por `(org, mes)`).

## 3.3 Captura resiliente (UX)

- Em `_authenticated.admin.captura.tsx`, envolver `salvarComprovante` em fila local com retry (3x, backoff) + toast persistente "3 comprovantes aguardando envio" quando offline/gateway lento.
- Persistir rascunho da fila em `localStorage` escopado por `activeOrgId` (chave `synsit:fila-captura:<orgId>`).
- Indicador de progresso por arquivo (não travar o formulário inteiro).
- Ao concluir upload no Storage, marcar evento como `status_documental='pendente_drive'` até o worker sincronizar → vira `'sincronizado'`.

---

## Fora de escopo (fica para M4)
- Unificação de categorias orçamento ↔ prestação (M4.1).
- PlanoGuard/cobrança automática (adiada por decisão do usuário).
- Reescrever `client.ts`, `types.ts`, `routeTree.gen.ts`, `.env`, `supabase/config.toml`.

## Impacto multi-tenant (herdado do M1)
Todo endpoint novo (`enfileirarSyncDrive`, `reabrirPrestacao`, tick do worker quando disparado manualmente) recebe `activeOrgId` no payload e chama `assertOrgMembership`. O tick agendado do pg_cron roda com `service_role` mas filtra jobs por `organization_id` embutido em cada linha.

---

## Detalhes técnicos

**Migrações SQL (uma migração única):**
```
-- 1. drive_sync_queue
CREATE TABLE public.drive_sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bucket text NOT NULL,
  path text NOT NULL,
  section text NOT NULL,             -- 'Orçamentos' | 'Cotações' | 'Prestações' | 'Documentos'
  mes_ref text,                       -- AAAA-MM opcional
  ref_table text,                     -- 'documentos_anexos' | 'orcamentos_salvos' | ...
  ref_id uuid,
  status text NOT NULL DEFAULT 'pendente',  -- pendente|em_andamento|sincronizado|falhou_retry|falhou_definitivo
  tentativas int NOT NULL DEFAULT 0,
  proximo_retry timestamptz NOT NULL DEFAULT now(),
  ultimo_erro text,
  drive_file_id text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_drive_queue_pending ON public.drive_sync_queue (status, proximo_retry)
  WHERE status IN ('pendente','falhou_retry');
GRANT SELECT ON public.drive_sync_queue TO authenticated;
GRANT ALL ON public.drive_sync_queue TO service_role;
ALTER TABLE public.drive_sync_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org read" ON public.drive_sync_queue FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.user_orgs(auth.uid())));

-- 2. RPC de dequeue atômico
CREATE FUNCTION public.drive_queue_claim(_limit int)
RETURNS SETOF public.drive_sync_queue
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  UPDATE public.drive_sync_queue q SET status='em_andamento', atualizado_em=now()
  WHERE q.id IN (
    SELECT id FROM public.drive_sync_queue
    WHERE status IN ('pendente','falhou_retry') AND proximo_retry <= now()
    ORDER BY proximo_retry ASC LIMIT _limit FOR UPDATE SKIP LOCKED
  ) RETURNING *;
$$;

-- 3. trava snapshot
CREATE FUNCTION public.fn_lock_snapshot() RETURNS trigger ... ;
CREATE TRIGGER trg_lock_snapshot_eventos BEFORE UPDATE OR DELETE ON public.eventos_financeiros ...;
CREATE TRIGGER trg_lock_snapshot_anexos  BEFORE UPDATE OR DELETE ON public.documentos_anexos ...;

-- 4. drive_file_id em documentos_anexos + versao em prestacoes_snapshot
ALTER TABLE public.documentos_anexos ADD COLUMN drive_file_id text;
ALTER TABLE public.prestacoes_snapshot ADD COLUMN IF NOT EXISTS versao int NOT NULL DEFAULT 1;
ALTER TABLE public.prestacoes_snapshot ADD COLUMN IF NOT EXISTS revogado_em timestamptz, ADD COLUMN IF NOT EXISTS revogado_por uuid, ADD COLUMN IF NOT EXISTS revogado_motivo text;

-- 5. pg_cron
SELECT cron.schedule('drive-sync-tick','* * * * *', $$
  SELECT net.http_post(
    url:='https://sistemaapprova.lovable.app/api/public/hooks/drive-sync-tick',
    headers:='{"Content-Type":"application/json","apikey":"<ANON_KEY>"}'::jsonb,
    body:='{}'::jsonb);
$$);
```

**Arquivos novos/alterados:**
- `src/lib/drive-queue.server.ts` (novo) — `enqueueDriveSync`, `processDriveQueueTick`.
- `src/routes/api/public/hooks/drive-sync-tick.ts` (novo) — server route com verificação `apikey`.
- `src/lib/prestacao-snapshot.functions.ts` — expõe `reabrirPrestacao`.
- `src/lib/comprovantes.functions.ts` — enfileirar após upload.
- `src/lib/orcamentos.functions.ts`, `cotacoes.functions.ts`, `prestacao.functions.ts` — enfileirar em vez de subir inline.
- `src/routes/_authenticated.admin.captura.tsx` — fila local + progresso por arquivo.
- `src/routes/_authenticated.admin.arquivos.tsx` — badge "sincronizando".
- `src/integrations/supabase/types.ts` — regenerado após migração.

**Validação:**
- Teste manual: subir comprovante offline (Drive derrubado via env falso) → aparece no Storage e no admin.arquivos com badge; após restaurar, tick sincroniza e badge some.
- Teste manual: gerar snapshot, tentar editar evento → erro claro "Período homologado"; reabrir prestação → edição volta a funcionar.
