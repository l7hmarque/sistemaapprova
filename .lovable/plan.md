
# Milestone 2 — Motor de regras SIT por fornecedor (JSONB)

Objetivo: tirar as regras SIT do código (hoje engessadas em `src/lib/sit/inferCaptura.ts` e `catalogos.ts`) e colocá-las como **dados editáveis por organização**, ancoradas no fornecedor. Assim o contador cadastra uma vez as regras de cada fornecedor recorrente (Sanepar, Copel, folha, DARF, etc.) e a captura + geração SIT passam a usar essas regras automaticamente, sem tocar em código.

## Escopo

### 2.1 Coluna `regras_sit JSONB` em `fornecedores`
Migração adicionando:
- `regras_sit jsonb NOT NULL DEFAULT '{}'::jsonb` em `public.fornecedores`
- índice `GIN` para busca por chave
- comentário documentando o schema

Schema esperado do JSONB (validado por Zod em runtime, não no banco):
```json
{
  "tp_despesa": 3339039 43,
  "tp_documento_despesa": 1,
  "tp_documento_pagamento": 7,
  "cd_modalidade_compra": 8,
  "tp_doc_fav": "CNPJ",
  "nm_favorecido_override": "COPEL DISTRIBUICAO S.A.",
  "categoria_padrao": "3.3.90.39.43",
  "observacao": "Energia elétrica – todos os meses"
}
```
Todos os campos opcionais; ausência = cai no infer atual.

### 2.2 Precedência unificada de inferência
Reescrever `aplicarOverrideFavorecido` + `inferirTp*` para consumir uma única função `resolverCamposSIT(fornecedor, extracao)` com ordem clara:
1. `fornecedor.regras_sit.*` (mais forte)
2. Overrides hardcoded por tipo de documento (DARF→MF, GPS→FRGPS, etc.) — mantidos como fallback
3. Regex de nome (Sanepar/Copel) — mantido como fallback
4. Inferência por descrição/categoria

Um `.functions.ts` novo `sit-regras.functions.ts` expõe:
- `resolverRegrasSIT({ fornecedorId, activeOrgId, descricao, tipo, mesReferencia })` → retorna `CamposSIT`
- consumido tanto na captura (`captura.functions.ts`) quanto na geração do SIT (`formatLinha.ts` server-side).

### 2.3 UI de edição das regras no cadastro de fornecedor
Em `src/routes/_authenticated.admin.fornecedores.tsx`:
- Novo painel expansível "Regras SIT" no formulário do fornecedor
- Selects populados a partir de `catalogos.ts` (categorias, tp_documento_despesa, tp_documento_pagamento, modalidade)
- Botão "Aplicar template" (Energia, Água, Folha, DARF, GPS) que preenche o JSONB com um preset conhecido
- Preview: mostra em texto o que será inferido para uma despesa modelo

Server function `salvarFornecedor` (`fornecedores.functions.ts`) passa a aceitar `regras_sit` no schema Zod, com defaults seguros.

### 2.4 Migração de dados: extrair regras hardcoded para fornecedores existentes
Uma migração de dados (SQL `UPDATE` com `INSERT` de fornecedores canônicos quando ainda não existirem por org) que:
- Cria/atualiza fornecedores Sanepar, Copel, Ministério da Fazenda (DARF), FRGPS/INSS (GPS), Caixa (FGTS/GFD/GRRF) em cada organização com regras_sit preenchidas
- Idempotente (via `ON CONFLICT (organization_id, cnpj)`)

### 2.5 Rigor multi-tenant (herança do M1)
- Todo novo endpoint recebe `activeOrgId` obrigatório e valida via `assertOrgMembership` (já existe).
- `resolverRegrasSIT` só carrega fornecedor que pertence à org ativa.

## Detalhes técnicos

- **Não alterar** `src/integrations/supabase/types.ts` à mão — é regenerado após a migração.
- **Zod schema do JSONB** vive em `src/lib/sit/regrasSitSchema.ts`, importado tanto por frontend quanto por server functions.
- **Compat**: as funções `aplicarOverrideFavorecido`, `inferirTpDespesa`, `inferirTpDocDespesa` continuam exportadas (fallback), mas passam a ser chamadas por `resolverRegrasSIT` — nenhum caller antigo quebra.
- **Testes**: adicionar casos em `src/lib/sit/parsers.test.ts` (ou novo `regrasSit.test.ts`) cobrindo: regra vazia (fallback), regra parcial (mescla), regra total (override completo).
- **Auditoria**: o trigger `fn_audit_row` já ligado em `fornecedores` (M1) registra automaticamente toda alteração de `regras_sit` em `audit_log`. Nada extra.

## Ordem de execução

1. Migração SQL: coluna `regras_sit` + índice GIN + seed idempotente dos fornecedores canônicos por org.
2. `regrasSitSchema.ts` + `resolverRegrasSIT` no server.
3. Atualizar `captura.functions.ts` e `formatLinha` server-side para chamar `resolverRegrasSIT`.
4. UI: painel "Regras SIT" no formulário de fornecedor, templates prontos.
5. Ampliar `salvarFornecedor` para aceitar `regras_sit` (Zod).
6. Testes unitários + smoke test: captura de uma NF Sanepar deve trazer `tp_despesa 3339039 44` sem intervenção.

## Fora de escopo (fica para M3/M4)

- Fila assíncrona Drive + snapshot lock (M3).
- Unificação de categorias entre orçamento/prestação (M4.1).
- PlanoGuard/cobrança (M4.3).
- Qualquer alteração em `client.ts`, `types.ts`, `routeTree.gen.ts`, `.env`.
