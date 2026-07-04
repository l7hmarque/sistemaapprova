
# Plano — Fase 0 + Milestone 1

Executarei em **duas etapas encadeadas neste mesmo ciclo de build**: primeiro a Fase 0 (refactor de rotas), depois o Milestone 1 (blindagem). Os milestones 2, 3 e 4 ficam para planos separados após esta entrega ser validada.

Sobre `current_user_org()`: **mantenho a função no banco** (dropar é arriscado porque ainda é chamada indiretamente pelo `handle_new_user` e por RLS de algumas tabelas). O que farei é **remover todo uso dela como fallback em server functions e no `AdminShell`**, e **exigir `activeOrgId` explícito** em toda escrita. Isso entrega o objetivo de segurança da tarefa 1.1 sem quebra colateral.

---

## Fase 0 — Migração de rotas para `_authenticated/`

**Objetivo:** alinhar o roteamento ao padrão TanStack Start (gate único, SSR desligado no subtree autenticado, bearer middleware) exigido pelos milestones seguintes.

### Escopo
1. Criar `src/routes/_authenticated/route.tsx` (layout gerenciado: `ssr: false`, `beforeLoad` chamando `supabase.auth.getUser()`, redirect para `/auth` se sem sessão, `<Outlet />`).
2. Mover **todos** os arquivos `src/routes/admin.*.tsx` e `src/routes/owner.*.tsx` para `src/routes/_authenticated/admin.*.tsx` e `src/routes/_authenticated/owner.*.tsx`, atualizando cada `createFileRoute("/admin/...")` → `createFileRoute("/_authenticated/admin/...")`.
3. Remover qualquer `beforeLoad` de auth redundante nos filhos (o gate do layout basta).
4. Atualizar todos os `<Link to="/admin/...">` / `navigate({ to: "/admin/..." })` / `redirect({ to: ... })` no código para os novos paths tipados. TanStack falha em typecheck se algum ficar para trás — vou varrer com `rg`.
5. Confirmar `src/start.ts` com `functionMiddleware` do bearer Supabase (append, não substituir).
6. Rodar build para regenerar `src/routeTree.gen.ts` (não editado à mão).

### Rotas públicas que **permanecem** top-level (não movem)
- `/`, `/auth`, `/reset-password`, `/leads`, `/cotacao/$token`, `/setup`, `/api/public/*`.

### Riscos
- **URLs mudam?** Não — o segmento `_authenticated` é *pathless*, então `/admin/painel` continua sendo `/admin/painel` para o usuário.
- **Refresh em rota protegida perde sessão?** Não — `ssr: false` no subtree evita o loop clássico do gate SSR sem `localStorage`.

---

## Milestone 1 — Blindagem, Soft-Delete e id_interno

### 1.1 Rigor multi-tenant (activeOrgId obrigatório)

**Server functions** — em cada `src/**/*.functions.ts` de escrita/leitura sensível:
- Adicionar `activeOrgId: z.string().uuid()` no `inputValidator`.
- No handler, após `requireSupabaseAuth`, validar membership:
  ```ts
  const { data: member } = await context.supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', context.userId)
    .eq('organization_id', data.activeOrgId)
    .maybeSingle();
  if (!member && !(await isSuperAdmin(context))) throw new Error('Forbidden: org membership');
  ```
- Usar `data.activeOrgId` em vez de qualquer chamada a `current_user_org()` ou default do banco.

**Frontend** — hook `useActiveOrg` (ou equivalente no `AdminShell`) já provê o id; passar em toda mutation/query. React Query keys ganham `activeOrgId` como primeira chave (ex.: `['eventos', activeOrgId, mes]`). Ao trocar org, chamar `queryClient.removeQueries()`.

**Banco** — migração para reforçar `organization_id NOT NULL` nas tabelas multi-tenant que ainda aceitam NULL (auditar via `information_schema` antes). Não removo o `DEFAULT current_user_org()` porque **verifiquei que nenhuma coluna do schema atual tem esse default** — o fallback existe só em código.

### 1.2 Soft-delete de `eventos_financeiros` + auditoria automática

**Migração SQL** (uma só):
1. `ALTER TABLE eventos_financeiros ADD COLUMN excluido_em timestamptz, ADD COLUMN excluido_por uuid REFERENCES auth.users(id)`.
2. Trigger `BEFORE DELETE` em `eventos_financeiros`:
   ```sql
   UPDATE eventos_financeiros
     SET excluido_em = now(), excluido_por = auth.uid()
     WHERE id = OLD.id AND excluido_em IS NULL;
   RETURN NULL; -- cancela o DELETE físico
   ```
3. Ajustar todas as **RLS SELECT policies** de `eventos_financeiros` para incluir `AND excluido_em IS NULL` (super_admin continua vendo tudo via `has_role`).
4. Criar função genérica `public.fn_audit_row()` + triggers `AFTER INSERT/UPDATE/DELETE` em `eventos_financeiros`, `fornecedores`, `configuracoes` gravando em `audit_log(organization_id, user_id, table_name, operation, old_data jsonb, new_data jsonb)`.

**Frontend** — todas as queries de eventos passam a filtrar `excluido_em is null`. Adicionar toggle "Ver excluídos" só para `super_admin` no `/admin/painel` (opcional, mas útil para auditoria).

### 1.3 `id_interno` sequencial atômico (`YYYYMM-XXXX`)

**Migração SQL:**
1. Nova tabela auxiliar de contadores:
   ```sql
   CREATE TABLE public.contadores_periodo (
     organization_id uuid NOT NULL,
     mes_referencia text NOT NULL,
     ultimo_numero int NOT NULL DEFAULT 0,
     PRIMARY KEY (organization_id, mes_referencia)
   );
   GRANT SELECT, INSERT, UPDATE ON public.contadores_periodo TO authenticated;
   GRANT ALL ON public.contadores_periodo TO service_role;
   ALTER TABLE public.contadores_periodo ENABLE ROW LEVEL SECURITY;
   CREATE POLICY sel_contador ON public.contadores_periodo FOR SELECT TO authenticated
     USING (organization_id IN (SELECT user_orgs(auth.uid())));
   ```
   (INSERT/UPDATE via trigger `SECURITY DEFINER`, sem policy pública de escrita.)

2. Trigger `BEFORE INSERT` em `eventos_financeiros`:
   ```sql
   INSERT INTO contadores_periodo (organization_id, mes_referencia, ultimo_numero)
     VALUES (NEW.organization_id, NEW.mes_referencia, 1)
     ON CONFLICT (organization_id, mes_referencia)
     DO UPDATE SET ultimo_numero = contadores_periodo.ultimo_numero + 1
     RETURNING ultimo_numero INTO v_seq;
   NEW.id_interno := replace(NEW.mes_referencia, '-', '') || '-' || lpad(v_seq::text, 4, '0');
   ```
   O `UPDATE ... RETURNING` é atômico dentro da transação → sem race condition.

3. Índice único `unique(organization_id, id_interno)` (se ainda não existir).

4. Remover a geração aleatória de `id_interno` em `src/lib/sit/inferCaptura.ts` (o frontend para de enviar esse campo; o banco preenche).

### Mitigação de riscos aplicada
- **Race condition sequencial** → resolvido pelo `INSERT ... ON CONFLICT DO UPDATE RETURNING` atômico.
- **Cache poluído ao trocar org** → `queryClient.removeQueries()` no `useActiveOrg` + `activeOrgId` em toda queryKey.
- **Soft-delete quebrando reports antigos** → RLS filtra por default; toggle super_admin permite auditoria.

---

## Ordem de execução (após aprovação)

1. Migração de rotas → build → confirmar preview OK.
2. Migração SQL única do Milestone 1 (soft-delete + auditoria + contador + trigger id_interno + NOT NULL onde falta).
3. Refactor de `*.functions.ts` para exigir `activeOrgId` + membership check.
4. Ajustar frontend (queryKeys, remoção de id_interno client-side, filtros `excluido_em`).
5. Validação: build passa, `/admin/painel` lista eventos, criar despesa gera `id_interno` no formato correto, excluir marca `excluido_em` sem apagar.

## Fora de escopo (fica para milestones seguintes)
- Motor JSONB de regras SIT em fornecedores (M2).
- Fila assíncrona Drive + bloqueio de snapshot (M3).
- Unificação de categorias e cobrança Stripe/Paddle (M4).
- Qualquer edição em arquivos auto-gerados (`client.ts`, `types.ts`, `routeTree.gen.ts`, `.env`).
