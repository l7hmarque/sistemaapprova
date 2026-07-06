## Objetivo

Três melhorias em `/admin/prestacao`:

1. **Documentos com vigência** que atravessam vários meses.
2. **Preview em iframe** do PDF antes de finalizar/salvar no Drive.
3. **Ajustes de organização** dos anexos das despesas (sem separadores).

---

## 1. Documentos com vigência plurianual

### Modelo de dados (migração)

Adicionar em `prestacao_documentos`:

- `valido_de date` — início da vigência (default = `data_emissao` ou 1º dia de `mes_referencia`).
- `valido_ate date` — fim da vigência (default = `data_vencimento`).
- `mes_referencia_fim text NULL` — quando o usuário exclui "só até este mês", grava aqui o corte.
- Índice `(organization_id, valido_de, valido_ate)`.

### Regra de exibição no mês filtrado

Ao abrir o mês `AAAA-MM`, um documento aparece quando:

```text
mes_referencia <= AAAA-MM
AND (mes_referencia_fim IS NULL OR AAAA-MM <= mes_referencia_fim)
AND (valido_ate IS NULL OR valido_ate >= <primeiro dia de AAAA-MM>)
```

Ou seja: cadastrado num mês anterior + vigência ainda cobrindo o mês atual + não cortado manualmente.

Cada card mostra badge:

- **Vigente** (verde discreto) quando `valido_ate > hoje+30`.
- **Vence em X dias** (amarelo) quando `valido_ate` entre hoje e hoje+30.
- **Vencido** (vermelho) quando `valido_ate < hoje` — com CTA "Cadastrar novo em substituição" (abre modal já preenchido com nome e sugerindo nova `valido_de = hoje`).

### Exclusão com 3 opções

Ao clicar em excluir, abre modal com radio (preselecionado no meio):

- Excluir só neste mês → grava um registro em nova tabela `prestacao_documentos_excecoes(documento_id, mes_referencia)` (pula esse mês na exibição/PDF).
- **Excluir só neste mês e todos os seguintes (preset)** → `UPDATE ... SET mes_referencia_fim = <mês anterior ao atual>`.
- Excluir tudo (todos os meses) → `DELETE` físico.

### PDF

O `gerarPrestacaoContas` passa a usar a mesma regra de exibição em vez de `eq("mes_referencia", mes)`.

---

## 2. Preview em iframe do PDF antes de salvar

### Fluxo

1. Novo botão "Pré-visualizar" ao lado de "Gerar relatório".
2. Chama nova server fn `gerarPrestacaoContasRascunho` — mesmo pipeline, mas **não sobe pro Drive**; retorna os bytes como base64 (ou usa `URL.createObjectURL` a partir de um Blob devolvido via fetch).
3. Abre `Dialog` fullscreen com `<iframe src={blobUrl}>` ocupando a tela + rodapé com:
   - Metadados (X páginas, Y documentos, Z comprovantes).
   - Botão "Fechar" (descarta).
   - Botão "Gerar oficial e salvar no Drive" (chama `gerarPrestacaoContas` atual e abre o resultado).

### Implementação técnica

- Refatorar `gerarPrestacaoContas` extraindo o pipeline (`montarPdfBytes(orgId, mes, titulo)`) em helper server-only.
- `gerarPrestacaoContasRascunho` chama o helper e retorna `{ base64, totalPaginas, totalDocs, totalComprovantes }`.
- `gerarPrestacaoContas` chama o helper + upload Drive (comportamento atual).
- Frontend: `atob → Uint8Array → new Blob([...], { type: 'application/pdf' }) → URL.createObjectURL`.

Nota: PDF de rascunho pode ficar grande (>5MB). Se ultrapassar limite prático de RPC, alternativa é criar server route `POST /api/prestacao/preview` que devolve `Response(pdfBytes, { headers: { 'Content-Type': 'application/pdf' } })` — mais eficiente. **Vou por essa rota** desde o início.

---

## 3. Ajustes nos comprovantes (sem separadores)

Confirmado: **não** adicionar página separadora por evento. Apenas garantir:

- Ordenação estável: `data_pagamento asc`, depois `id_interno`.
- No sumário, cada evento com anexo continua listado com ID interno + favorecido + valor (para navegação).
- Anexos de um mesmo evento entram em sequência, na ordem: `tipo = 'nf'` → `'boleto'` → `'comprovante'` → outros.

---

## Arquivos

**Migração (nova):**
- `prestacao_documentos`: colunas `valido_de`, `valido_ate`, `mes_referencia_fim` + índice.
- Nova tabela `prestacao_documentos_excecoes` com GRANTs + RLS por org.
- Backfill: `valido_de = COALESCE(data_emissao, to_date(mes_referencia||'-01','YYYY-MM-DD'))`, `valido_ate = data_vencimento`.

**Editados:**
- `src/lib/prestacao.functions.ts` — extrair `montarPdfBytes`, atualizar query com regra de vigência, ordenar anexos por tipo.
- `src/routes/_authenticated.admin.prestacao.tsx` — nova query com regra de vigência, badges (vigente/vence/vencido), modal de exclusão com 3 opções, botão "Pré-visualizar", modal fullscreen com iframe.
- Novo `src/routes/api/prestacao.preview.ts` (server route autenticada) que devolve `application/pdf` direto — chamada com bearer via fetch autenticado.

**Sem alteração:** snapshot / bucket `prestacoes` / template.

---

## Fora de escopo

- Notificação por email de "documento vai vencer" (só badge visual no card).
- Auto-substituição do documento vencido (só sugere via CTA).
- Assinatura digital / marca d'água.
