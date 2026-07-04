# Milestone 3 — Confiabilidade de Captura e Sincronização (implementado)

## Entregas

### 3.1 Fila assíncrona Drive
- Tabela `drive_sync_queue` (status/tentativas/próximo_retry/erro/drive_file_id), RLS por org, GRANT service_role, RPC atômico `drive_queue_claim` (FOR UPDATE SKIP LOCKED).
- `src/lib/drive-queue.server.ts` — `enqueueDriveSync` (inserção não bloqueante) e `processDriveQueueTick` (retry exponencial 30s → 6h, máx 5 tentativas).
- `src/routes/api/public/hooks/drive-sync-tick.ts` — endpoint público autenticado por `apikey` (anon).
- `pg_cron` agenda `drive-sync-tick` a cada 1 minuto.
- `anexarComprovante` passa a enfileirar após upload no Storage.
- Colunas `drive_file_id` em `documentos_anexos` e `prestacao_documentos` (propagadas quando o job conclui).

### 3.2 Trava de imutabilidade (snapshot lock)
- `fn_lock_snapshot_eventos` + trigger BEFORE UPDATE/DELETE em `eventos_financeiros` — só permite editar observação/tags/soft-delete quando o evento está vinculado a prestação homologada não revogada.
- `fn_lock_snapshot_anexos` + trigger BEFORE UPDATE/DELETE em `documentos_anexos`.
- `prestacoes_snapshot` ganhou `revogado_em/por/motivo` (`versao` reservado).
- `reabrirPrestacao({ snapshotId, activeOrgId, motivo })` — só owner/admin, marca snapshot como revogado, libera eventos e registra em `audit_log`.

### 3.3 UI
- `_authenticated.admin.arquivos.tsx` — badge "Sincronizando N arquivo(s) com Drive…" / "N falha(s) — retry automático" no cartão de armazenamento; `getDriveSyncStatus` refetch a cada 30s.

## Fora de escopo (M4)
- UX profunda de fila local na captura (retry client-side com localStorage) — deixado para M4 quando revisitarmos captura completa.
- Unificação categorias orçamento ↔ prestação (M4.1).
- PlanoGuard/cobrança automática (adiada).
