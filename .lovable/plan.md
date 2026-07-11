## Próxima entrega: Milestone 1 — Blindagem multi-tenant, soft-delete e id_interno auditável

Fase 1 (neutralização de "IA" + auto-preenchimento de natureza contábil na captura) já foi aplicada no turno anterior. Sigo agora com o **Milestone 1** do `plano_acao_approva`, que é a fundação de segurança para os milestones seguintes.

### Escopo desta entrega

1. **Isolamento multi-tenant rigoroso (1.1)**
   - Migration removendo `DEFAULT public.current_user_org()` de todas as colunas `organization_id` em `public.*` (mantendo `NOT NULL`).
   - Novo helper server `assertOrgAccess(activeOrgId)` que valida `auth.uid()` × `organization_members` e é usado em todos os `*.functions.ts` de escrita/leitura sensível.
   - Server functions passam a exigir `activeOrgId: z.string().uuid()` no `inputValidator` e filtram/gravam sempre com esse id.
   - Frontend: `AdminShell`/`useActiveOrg` já expõem o org ativo — passar em todas as chamadas e incluir `activeOrgId` nas `queryKey` do React Query; ao trocar de org, `queryClient.removeQueries()`.

2. **Soft-delete + auditoria (1.2)**
   - `eventos_financeiros`: colunas `excluido_em timestamptz`, `excluido_por uuid` (já existem parcialmente pelo trigger `fn_eventos_financeiros_soft_delete`) — confirmar, garantir índice parcial `WHERE excluido_em IS NULL` e RLS filtrando.
   - Trigger genérica `fn_audit_row` já existe; anexar a `eventos_financeiros`, `fornecedores`, `configuracoes`, `prestacao_documentos`, `regras_despesa`.
   - Frontend: revisar todas as listagens de `eventos_financeiros` e adicionar `.is("excluido_em", null)` onde faltar (painel, captura, REO, arquivos, prestação).

3. **id_interno sequencial atômico (1.3)**
   - Hoje a trigger `fn_eventos_financeiros_set_id_interno` gera `NNNN` por org+mês via `contadores_periodo` (atômico). Ajustar para o formato pedido no plano: `YYYYMM-NNNN` (ex.: `202607-0012`) mantendo a atomicidade.
   - Backfill: atualizar registros existentes cujo `id_interno` esteja no formato antigo `NNNN` para o novo padrão, preservando a sequência dentro do mês.
   - Formulário de evento continua com o campo `read-only`.

### Mitigações já contempladas
- Race condition do sequencial: `contadores_periodo` com `INSERT … ON CONFLICT DO UPDATE … RETURNING` (atômico) — mantido.
- Cache cross-org: `queryKey` inclui `activeOrgId` + `removeQueries` no switch.
- Períodos homologados: preservados pelo `fn_lock_snapshot_eventos` (Milestone 3 ampliará).

### Fora de escopo neste bloco
Milestone 2 (motor de regras JSONB em fornecedores), Milestone 3 (Drive assíncrono + trava contábil ampliada) e Milestone 4 (Stripe + PlanoGuard + unificação de categorias) — entram nas próximas rodadas.

### Detalhes técnicos

```text
Migrations
├── remove default current_user_org() em todas colunas organization_id
├── ajusta trigger fn_eventos_financeiros_set_id_interno → 'YYYYMM-NNNN'
├── backfill id_interno antigos (NNNN → YYYYMM-NNNN)
└── anexa fn_audit_row a fornecedores, configuracoes, prestacao_documentos, regras_despesa

Código
├── src/lib/_shared/assertOrgAccess.server.ts (novo helper)
├── src/lib/*.functions.ts (activeOrgId obrigatório + assertOrgAccess)
├── src/hooks/use-active-org.tsx (removeQueries no switch)
└── revisão de queryKeys e filtros excluido_em nas telas admin
```

### Verificação
- `bun run build:dev` limpo.
- Trocar de org no `OrgSwitcher` não deixa dados vazando entre orgs (cache limpo).
- Deletar evento continua fazendo soft-delete (some da UI, permanece em `audit_log`).
- Novo evento recebe `id_interno = 202607-0001`.