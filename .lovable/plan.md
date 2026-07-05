
# Milestone 4 — Fechamento do plano original

Você tem razão: melhor terminar o M4 e só então polir. Se o polimento
descobrir algo, ele conserta em cima do M4 já entregue.

## Escopo confirmado

### 4.1 Categorias financeiras unificadas
Hoje `orcamentos` e `prestacao` mantêm listas de categorias independentes,
o que impede relatório de execução orçamentária (previsto × realizado).

- Nova tabela `categorias_financeiras` por org: `id`, `organization_id`,
  `nome`, `tipo` (`receita` | `despesa`), `codigo` (opcional para TCE),
  `ativo`, `ordem`, timestamps.
- RLS + `GRANT` completo (padrão do projeto).
- Seed idempotente por org com as categorias hoje hardcoded em `orcamentos`
  e `prestacao` (união dos dois conjuntos, deduplicada por nome).
- `orcamentos_itens.categoria_id` e `eventos_financeiros.categoria_id`
  passam a referenciar a nova tabela. Backfill via `nome` (case-insensitive)
  na mesma migração; linhas sem match ficam com `categoria_id NULL` e um
  aviso na UI ("categoria antiga — reclassificar").
- CRUD de categorias em `_authenticated.admin.configuracoes.organizacao.tsx`
  (nova aba/seção).
- `_authenticated.admin.orcamentos.tsx` e
  `_authenticated.admin.prestacao.tsx` passam a ler do banco (server fn
  `listarCategorias({ tipo })`).

### 4.2 Captura resiliente client-side
Complementa a fila server-side do M3. Cobre queda de rede/aba fechada
antes do upload chegar no Storage.

- Em `_authenticated.admin.captura.tsx`: fila local em `localStorage`
  chaveada por `activeOrgId`, item `{ id, file (base64), meta, tentativas,
  proximoRetry }`.
- Retry client-side 3× com backoff (2s → 10s → 30s) antes de marcar
  "falhou — reenvie manualmente".
- Barra de progresso por arquivo + banner "N upload(s) pendente(s)"
  restaurado ao reabrir a página.
- Quando o upload no Storage conclui, a fila server-side do M3 assume
  a partir daí (Drive).

### 4.3 Cobrança automática — decisão final
Fica **fora** por decisão sua. Apenas ajustar o texto do `PlanoGuard`
para não prometer autosserviço ("entre em contato com o suporte" em vez
de "reative seu plano"). ~5 linhas.

### 4.4 Remoções confirmadas (feitas dentro deste milestone)
- `rm src/routes/showcase.$screen.tsx`
- `rm src/routes/ferramenta.tsx`
- `rm src/lib/extracoes-online.ts`
- `rm src/lib/regrasUsuario.ts`
- Esconder item "Agenda" do menu em `src/components/admin/sidebar.tsx`
  (comentar entrada, manter arquivo da rota + `placeholder.tsx` para
  quando entregarmos Fase 4).
- Ajustar `sitemap[.]xml.ts` e qualquer `<Link>` que aponte para
  `/ferramenta` ou `/showcase/*` (varrer com `rg` antes de remover).

## Ordem de execução

1. Migração SQL (`categorias_financeiras` + backfill).
2. Server fn `listarCategorias` + CRUD UI.
3. Refatorar `orcamentos` e `prestacao` para ler do banco.
4. Fila local na captura.
5. Ajuste texto `PlanoGuard`.
6. Remoções + esconder Agenda + limpar links.
7. Regenerar types (automático) e conferir build.

## Detalhes técnicos

- Migração precisa dos 4 passos canônicos (CREATE → GRANT → ENABLE RLS →
  POLICY). Policies: `SELECT/INSERT/UPDATE/DELETE` para `authenticated`
  restritas por `organization_id = current_user_org()`; `ALL` para
  `service_role`.
- Backfill: `UPDATE ... SET categoria_id = (SELECT id FROM
  categorias_financeiras WHERE organization_id = ... AND lower(nome) =
  lower(<valor_antigo>) AND tipo = ...)`. Deixar coluna antiga
  `categoria_texto` por 1 milestone como fallback de leitura (não
  editável na UI).
- Fila local: usar `IndexedDB` se algum arquivo > 4 MB (localStorage
  quota); caso contrário `localStorage` mesmo, mais simples.
- Não tocar em `client.ts`, `types.ts`, `routeTree.gen.ts`, `.env`,
  `supabase/config.toml` (auto-gen).

## Fora de escopo (fica pro polimento posterior)

Metadata SEO das rotas públicas, scan de segurança, alertas de fila
Drive no painel `/owner`, revisão de `errorComponent`/`notFoundComponent`.
Depois do M4 eu retomo estes.
