## Milestone 1 — Continuação: Isolamento multi-tenant no cliente e blindagem final

Contexto: as server functions já exigem `organization_id` explícito. Falta blindar o **cliente** para (a) não vazar dados entre organizações ao alternar contexto e (b) garantir que todo insert/update passe a org ativa correta.

### 1. Isolamento no switch de organização
Arquivo: `src/hooks/use-active-org.tsx`
- Ao trocar de organização ativa: `queryClient.removeQueries()` (remoção total, não apenas invalidate) para eliminar cache cruzado.
- Persistir a org ativa em `localStorage` com chave versionada e limpar no `signOutLimpo`.
- Expor `activeOrgId` tipado e um helper `requireActiveOrg()` que lança se null.

### 2. Sign-out hygiene
Arquivo: `src/lib/auth/signOutLimpo.ts`
- Após `supabase.auth.signOut()`: `queryClient.clear()` + limpar chaves `synsit_*` / `approva_*` do localStorage.

### 3. Auditoria de inserts diretos do cliente
Varrer `src/**/*.tsx` e `src/**/*.ts` procurando `.from("<tabela>").insert(` sem `organization_id`. Candidatos prováveis:
- `src/routes/_authenticated.admin.configuracoes.*` (regras, equipe, organização)
- `src/routes/_authenticated.admin.fornecedores.tsx`
- `src/routes/_authenticated.admin.objetos.tsx`
- `src/routes/_authenticated.admin.orcamentos.tsx`
- `src/routes/_authenticated.admin.modelos.tsx`
- `src/routes/_authenticated.admin.agenda.tsx`
- `src/routes/_authenticated.admin.prestacao.tsx`

Para cada ocorrência: injetar `organization_id: activeOrgId` a partir do hook, ou migrar a escrita para uma server function que já resolve a org via `current_user_org()`.

### 4. Guard-rail de leitura
Nos hooks/queries que listam por organização, adicionar `.eq("organization_id", activeOrgId)` explícito mesmo quando RLS já filtra — evita bugs se um dia a policy afrouxar e serve de documentação.

### 5. Verificação
- Build limpo (tsgo).
- Testar manualmente: criar 2 orgs, alternar, confirmar que listas trocam e que criar registro na org B não aparece na org A.
- Conferir `audit_log` registrando as escritas das tabelas críticas.

### Fora de escopo (próximos milestones)
- Milestone 2 (workflow de aprovação/homologação).
- Refactor de UI do dashboard acionável.
- Otimizações de performance do REO.

Após aprovação, executo em uma passada com edits paralelos por arquivo.
