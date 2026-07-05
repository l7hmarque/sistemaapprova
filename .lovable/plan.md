# Parte B — Polimento técnico

Segue o encerramento do milestone de polimento, sem novas features.

## 1. Auditoria do gate `_authenticated/`
- Varrer `src/routes/` e listar toda rota que consome dados do usuário logado ou chama serverFn com `requireSupabaseAuth`.
- Garantir que todas estejam sob `src/routes/_authenticated/…`. Mover as que estiverem soltas (renomear arquivo, atualizar `<Link>` afetados).
- Confirmar que nenhuma rota pública tem `loader` chamando serverFn protegida (evita 401 em prerender/SSR).

## 2. Boundaries padronizados
- Toda rota com `loader` deve declarar `errorComponent` **e** `notFoundComponent`.
- `__root.tsx` mantém `notFoundComponent` global; `router.tsx` mantém `defaultErrorComponent`.
- Criar dois helpers reutilizáveis em `src/components/route-boundaries/` (`RouteError`, `RouteNotFound`) usando tokens da marca e botão de retry com `router.invalidate() + reset()`.
- Aplicar nos loaders existentes que hoje não definem esses componentes.

## 3. Mensagens humanizadas no reprocessamento
- Revisar handlers de reprocessar documento / fila Drive: mapear erros técnicos (`PGRST…`, `storage/…`, `unenv…`) para mensagens em PT-BR acionáveis (ex.: "Arquivo não encontrado no Drive — reenvie ou reconecte a pasta.").
- Log técnico continua indo pro console/servidor; usuário vê texto amigável no toast.

## 4. Alertas da fila Drive no painel `/owner`
- Adicionar card "Fila Drive (todas as organizações)" em `/_authenticated/owner`.
- ServerFn com `requireSupabaseAuth` + checagem `has_role(auth.uid(),'super_admin')`; dentro do handler carrega `supabaseAdmin` via `await import('@/integrations/supabase/client.server')` e agrega `drive_sync_queue` por status (pendente, em_andamento, falhou_retry, concluído nas últimas 24h).
- UI: contagens + destaque quando `falhou_retry > 0` + link para logs.
- Sem cron novo, sem mudança de schema.

## 5. Security scan
- Rodar `security--run_security_scan` ao final para validar M3 (`drive_sync_queue`) + tabelas recentes.
- Corrigir apenas findings acionáveis (RLS/GRANT/policy). Ignorar com justificativa em `@security-memory` o que não se aplica.

## Ordem de execução
1. Auditoria de rotas → mover o que estiver fora do gate.
2. Boundaries reutilizáveis + aplicação.
3. Mensagens humanizadas de reprocessamento.
4. Card de fila Drive no `/owner`.
5. Security scan + tratamento dos findings.

## Fora de escopo
- Redesign visual, novas features, cobrança automática, mudanças no schema, novos cron jobs.

## Notas técnicas
- Nenhum arquivo autogerado é editado (`client.ts`, `types.ts`, `routeTree.gen.ts`, `.env`, `config.toml`).
- ServerFns protegidas nunca são chamadas em `loader` de rota pública.
- `supabaseAdmin` só é usado dentro de handler autorizado (`super_admin`), nunca no bundle cliente.
