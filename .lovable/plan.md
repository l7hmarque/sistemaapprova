
# Plano — Aba de Orçamentos + Mapa Comparativo

## Escopo

Nova rota top-level `/orcamentos` com 4 sub-áreas:

1. **Novo orçamento** — formulário que replica os campos da planilha modelo (Anexo I — Solicitação de Cotação).
2. **Mapa comparativo** — formulário com objeto de cotação + 3 fornecedores + lista de itens com preço por fornecedor (Anexo II).
3. **Presets** — modelos salvos de orçamentos recorrentes.
4. **Histórico** — orçamentos/mapas já gerados, com link para a planilha no Drive.

Nada do fluxo atual de extração de PDF / geração de `Despesa.txt` muda.

## Fonte dos modelos

- **Orçamento (Anexo I)**: `1IDWjnJisXhVrRRHSEqIxrqqevXMnlQPj94i3PSNnyno`
- **Mapa Comparativo (Anexo II)**: `1V_1THOUUWMhpVlb_4peuCmZcgQUno1GxJD2NIm-jooM`

Estratégia: ao gerar, **copiar o arquivo modelo no Drive** (Drive API `files/{id}/copy`), depois preencher os ranges via Sheets API `values:batchUpdate` (`USER_ENTERED`, preserva fórmulas). Cada cópia recebe nome `Orcamento - {objeto} - {fornecedor} - {data}` (ou `MapaComparativo - {objeto} - {data}`) numa pasta `Orcamentos SIT/{AAAA-MM}` criada se não existir.

## Campos das planilhas

**Orçamento (1 planilha por fornecedor)**
- Cabeçalho fixo editável: Entidade, CNPJ entidade, Representante, CPF (linhas 6–7); Termo (linha 11).
- Por orçamento: Fornecedor (razão+CNPJ+representante+CPF) linhas 8–9; Objeto, Validade (default 30), Data linha 10.
- Itens a partir da linha 13: Item nº, Especificação, Qtd, Unidade, Preço Unitário (Total = fórmula existente).

**Mapa Comparativo (1 planilha por cotação)**
- Cabeçalho idem + Objeto.
- 3 fornecedores nas linhas 12–14: Razão, CNPJ, Data Emissão, Data Validade, Prazo.
- Itens a partir da linha 18: Item, Especificação, Unidade, Quantidade, Preço Unitário por fornecedor (3 colunas). Menor preço/total = fórmulas existentes.

## Linhas dinâmicas (sem limite fixo)

Quando o número de itens excede o que o modelo já traz (5 no orçamento, 3 no mapa atual), inserimos linhas extras **antes de preencher**, mantendo formatação, mesclagens e fórmulas:

1. Identificamos no template o `sheetId`, a `linhaUltimoItem` e a `linhaTotalGeral`.
2. Se `qtdItens > qtdLinhasDisponiveis`, executamos `spreadsheets:batchUpdate` com:
   - `insertDimension` (`ROWS`, `inheritFromBefore: true`) inserindo `N` linhas imediatamente **acima** da linha "Total Geral" (no orçamento) / linha "Totais" (no mapa). Isso herda formatação, bordas e mescla da última linha de item.
   - `copyPaste` (`pasteType: PASTE_NORMAL`) replicando a linha do último item original sobre as linhas recém-inseridas, garantindo que fórmulas relativas (Preço Total = Qtd × Unitário; Menor preço) sejam estendidas corretamente.
3. Depois disso, `values:batchUpdate` preenche todos os itens (originais + novos) usando a numeração sequencial `1..N` na coluna Item.
4. As fórmulas de soma do "Total Geral" / "Totais" se ajustam automaticamente porque a inserção é **acima** da linha de totais (Sheets atualiza ranges).

Helper único: `expandirLinhasItens({ spreadsheetId, sheetId, linhaModeloItem, linhaTotais, qtdNecessaria, qtdExistente })` reaproveitado pelos dois fluxos.

## Modelo de dados (Lovable Cloud)

```text
fornecedores
  id uuid pk, cnpj text unique, razao_social text,
  representante_legal text, cpf_representante text,
  endereco text, email text, telefone text, criado_em timestamptz

objetos_cotacao
  id uuid pk, descricao text, unidade_padrao text,
  categoria text, uso_count int default 0, criado_em timestamptz

orcamento_presets
  id uuid pk, nome text, objeto text, termo text,
  itens jsonb, fornecedores_sugeridos jsonb, criado_em timestamptz

orcamentos_salvos
  id uuid pk, tipo text ('cotacao'|'mapa_comparativo'),
  objeto text, termo text, mes_referencia text,
  fornecedor_id uuid null, dados jsonb,
  drive_file_id text, drive_file_url text, criado_em timestamptz
```

RLS: igual ao `extracoes_salvas` (public read/insert/delete anon).

Autocomplete de objetos: `upsert` em `objetos_cotacao` incrementando `uso_count` ao salvar; lista ordenada por `uso_count desc`. Fornecedores: busca por CNPJ/razão; cria se novo. Seed opcional a partir dos favorecidos já presentes em `favorecidosPadrao.ts` (não bloqueante).

## Integração Drive + Sheets

Connectors `google_drive` e `google_sheets` já linkados. Toda chamada via `createServerFn` (nunca do cliente).

Server functions novas em `src/lib/orcamentos.functions.ts` (+ helpers em `src/lib/orcamentos.server.ts`):

- `gerarOrcamentoNoDrive({ dados })` → copia template → `expandirLinhasItens` se preciso → `values:batchUpdate` → salva snapshot → retorna `{ fileId, url }`.
- `gerarMapaComparativoNoDrive({ dados })` → idem.
- CRUD: `listar/upsert Fornecedor`, `listarObjetos(q)`, `listar/salvar/apagar Preset`, `listar/salvar Orcamento`.

Zod valida todos os payloads.

## UI (`/orcamentos`)

`src/routes/orcamentos.tsx` com tabs (shadcn):
- **Novo Orçamento** — cabeçalho + fornecedor com autocomplete + lista de itens (add/remover linhas livremente) + botão "Gerar planilha no Drive". Após gerar: link "Abrir no Sheets" + salva snapshot.
- **Mapa Comparativo** — cabeçalho + 3 fornecedores (autocomplete) + itens com preço por fornecedor. Botão "Importar de orçamentos salvos" pré-preenche a partir de 3 cotações do mesmo objeto.
- **Presets** — listar/criar/editar/apagar; aplicar preset ao iniciar um novo orçamento.
- **Histórico** — tabela com filtros (mês/tipo) + link Drive + ação "duplicar".

Navegação: novo `<Link to="/orcamentos">` no header do `__root.tsx`.

## Detalhes técnicos

- `TEMPLATE_MAP` define por modelo: `sheetId`, células de cabeçalho, linha de início de itens, linha modelo (a copiar ao expandir), linha de totais.
- Cliente usa `useServerFn` + TanStack Query.
- Datas enviadas como `dd/mm/aaaa` string com `USER_ENTERED` (Sheets converte para data corretamente).

## O que NÃO muda

- Upload/extração de PDF, geração de `.txt`, tabelas `extracoes_salvas`, endpoints `/api/extract`, parsers, pipeline, layout dos cards atuais da home.

## Riscos / mitigação

- **Expansão de linhas**: `insertDimension` com `inheritFromBefore: true` + `copyPaste` da linha modelo garantem fórmulas e formatação corretas; testamos com 10+ itens no smoke test antes de finalizar.
- **Mesclagens (merges)**: a linha 13 do orçamento tem células mescladas em "Especificação". `insertDimension` herda merges; validamos no teste e, se quebrar em algum caso, adicionamos `mergeCells` explicitamente no batch.
- **Permissões Drive**: planilha gerada herda permissões da conta da conexão; retornamos `webViewLink`. Compartilhamento público explícito fica como botão futuro.
- **Conta única**: todas as planilhas ficam no Drive do dono da conexão (consistente com padrão atual).
- **Locale**: USER_ENTERED + locale pt-BR do template já cuidam de `R$` e datas.

## Entrega em 4 passos (após aprovação)

1. Migration: 4 tabelas + RLS.
2. `orcamentos.server.ts` + `orcamentos.functions.ts` (Drive copy, expandir linhas, batchUpdate, CRUD).
3. Rota `/orcamentos` com 4 tabs + componentes de formulário e autocomplete.
4. Link no header + smoke test gerando 1 orçamento com 8 itens e 1 mapa com 6 itens (valida expansão de linhas).
