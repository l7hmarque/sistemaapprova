## Milestone 2 — Workflow de aprovação/homologação e dashboard acionável

Milestone 1 (isolamento multi-tenant) está fechado. Proponho seguir com o M2 focado no fluxo de trabalho mensal do usuário: quem aprova o quê, quando fecha o mês, e o que a home do admin mostra.

### 1. Estados do evento financeiro
Hoje `eventos_financeiros` tem `status` livre. Vamos formalizar:
- `rascunho` (captura crua) → `pendente_revisao` → `aprovado` → `homologado` (via snapshot).
- Transições permitidas por papel: membro cria/edita rascunho e pendente; admin/owner aprova; snapshot homologa.
- Migração: adicionar `status_workflow` (enum) + backfill baseado em `prestacao_snapshot_id` e `revisado_em`.

### 2. Tela de Aprovações (`/admin/aprovacoes`)
A rota já existe como placeholder. Implementar:
- Lista de eventos `pendente_revisao` do mês, agrupados por natureza REO.
- Ações em lote: aprovar seleção, devolver para rascunho com motivo, marcar duplicata.
- Filtros: sem natureza, sem comprovante, valor divergente (previsto vs efetivo > 10%).
- Só admin/owner enxerga; membro é redirecionado.

### 3. Dashboard acionável (`/admin/index` — hoje `/admin/painel`)
Substituir a home genérica por cards de trabalho pendente da org ativa:
- **Aprovar**: nº de eventos pendentes → link p/ Aprovações.
- **Classificar REO**: eventos aprovados sem `natureza_despesa_codigo`.
- **Anexar comprovante**: eventos pagos sem anexo.
- **Documentos vencendo**: `prestacao_documentos` com vigência expirando em ≤ 30 dias.
- **Fechar mês**: se todos os eventos do mês anterior estão aprovados e sem pendências, botão "Gerar snapshot".
- **Últimos snapshots**: 3 mais recentes com link de download via proxy.

Cada card é uma query isolada (React Query) escopada por `activeOrgId`, com skeletons e vazio explícito.

### 4. Homologação (snapshot) exigindo aprovação
`src/lib/prestacao-snapshot.functions.ts`:
- Bloquear criação de snapshot se houver eventos do mês em `rascunho` ou `pendente_revisao`.
- Mensagem de erro aponta quantos e link para Aprovações.

### 5. Notificações leves
- Toast + badge no menu lateral para "Aprovações pendentes" e "Documentos vencendo" (contadores da mesma query do dashboard).
- Sem e-mail nesta fase.

### Detalhes técnicos
- Migração: enum `evento_status_workflow`, coluna `status_workflow`, backfill, índice `(organization_id, mes_referencia, status_workflow)`.
- Server fns novos em `src/lib/aprovacoes.functions.ts`: `listarPendentes`, `aprovarLote`, `devolverParaRascunho`.
- Reforço RLS: transições sensíveis (aprovar/homologar) checam `has_role` ou `is_org_owner`.
- Dashboard puxa contagens via uma única server fn `resumoDashboard` para minimizar round-trips.

### Fora de escopo
- E-mail/push de notificação.
- Reabrir mês homologado (já existe via revogação de snapshot).
- Redesenho visual profundo — mantém o design system atual.

Se aprovar, começo pela migração + server fns de aprovação, depois a tela de Aprovações, e por último o dashboard.