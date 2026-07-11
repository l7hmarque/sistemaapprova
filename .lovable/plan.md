## Fase 1 — Captura: remover "IA" na UI + auto-vincular natureza

Escopo restrito a `src/lib/captura-processor.server.ts` (leitura/consulta a `src/lib/extract/schema.ts` só se necessário). Nenhuma outra rota, schema ou migration.

### Parte A — Remover menções a "IA" visíveis ao usuário
- `src/lib/captura-processor.server.ts` linha 267: trocar `mensagem: "extraindo com IA"` por `"lendo documento"`.
- Varredura já feita: as demais ocorrências de "IA" no `src/` estão em comentários de código, `console.warn` ou docstrings — não aparecem ao usuário, ficam como estão.
- Estados "processando" e "lançando eventos" já são neutros — manter.

### Parte B — Preencher `natureza_despesa_codigo` no insert de novos eventos

Local: bloco que monta `evIns` dentro do loop `for (let idx = 0; idx < listaDados.length; idx++)` em `captura-processor.server.ts` (por volta da linha 437), avaliado por documento (`dados = listaDados[idx]`).

1. Carregar catálogo ativo uma vez antes do loop:
   ```ts
   const { data: natRaw } = await supabaseAdmin
     .from("naturezas_despesa")
     .select("codigo")
     .eq("ativo", true);
   const naturezasAtivas = new Set((natRaw ?? []).map(n => n.codigo));
   ```
2. Para cada documento, resolver na ordem:
   - **IA**: `dados.sugestaoCategoria` (trim) presente e ∈ `naturezasAtivas` → usa, `origem = "ia"`.
   - **Regra fornecedor**: senão, primeira `regrasOrg` que casar (mesmo mecanismo já usado no bloco de `camposFinal`) e cujo `set_natureza_codigo` esteja em `naturezasAtivas` → usa, `origem = "regra_fornecedor"`.
   - Senão → `null`, `origem = null`.
3. Injetar no insert:
   - `natureza_despesa_codigo: naturezaResolvida`
   - `metadata: { ...atual, origem_natureza: origem }`

### Cuidados
- Avaliação por documento (nunca herdar do idx 0).
- Não retroagir (sem migration/script para eventos antigos).
- Não tocar no bloco `Default REO 271` de `cd_modalidade_compra` (campo diferente).
- Manter tela manual de vinculação como fallback para `null`.
- Sem mudanças em `schema.ts`, banco, ou outras rotas (`/admin/painel`, `/admin/prestacao`, `/admin/reo`).

### Verificação
- `tsgo` limpo.
- Confirmar no código: nenhum trecho de UI ainda emite "IA"; novos eventos sem match continuam com natureza `null`.