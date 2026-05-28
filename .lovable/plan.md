## Objetivo
Melhorar a captura e a edição no painel financeiro: extrair múltiplos documentos por PDF (nota/boleto + comprovante de pagamento), separar datas (emissão, vencimento, pagamento), simplificar a descrição e permitir editar o Nº do documento.

## 1. Extração (`src/lib/captura.functions.ts`)

Trocar o schema/prompt para um único objeto consolidado, lendo TODAS as páginas do PDF (a nota/boleto E o comprovante quando vierem juntos):

```json
{
  "tipo": "...",
  "cnpj": "...",
  "razao_social": "...",
  "valor": 123.45,
  "numero": "string|null",
  "data_emissao": "AAAA-MM-DD|null",
  "data_vencimento": "AAAA-MM-DD|null",
  "data_pagamento": "AAAA-MM-DD|null",
  "descricao": "resumo curto (máx 200 caracteres, SEM número do documento)"
}
```

Regras adicionais no SYSTEM prompt:
- "O PDF pode conter mais de um documento (nota/boleto + comprovante de pagamento). Combine as informações: dados do fornecedor/valor da nota e a data de pagamento do comprovante."
- "Se houver comprovante de pagamento anexo, preencha `data_pagamento` com a data efetiva da transação."
- "`data_emissao` = data da NF; `data_vencimento` = vencimento do boleto; `data_pagamento` = data do comprovante."
- "`descricao`: até 200 caracteres, em 1 linha, NÃO incluir o número do documento (ele vai em campo próprio)."

Atualizar `DadosExtraidos`, `parseDados` e `pareceVazio` para os novos campos. Truncar `descricao` em 200 chars no parse.

## 2. Inserção do evento (`src/routes/admin.captura.tsx`)

- Mapear: `data_vencimento = dados.data_vencimento ?? dados.data_emissao`, `data_pagamento = dados.data_pagamento` (não copiar mais a mesma data nos dois).
- `descricao`: usar `dados.descricao` truncada em 200 chars, sem prefixar número.
- `metadata`: gravar `numero_extraido`, `data_emissao`, `data_pagamento_extraida`.
- Se `data_pagamento` veio preenchido pelo comprovante e `valor` existe → `status_documental = "completo"`; senão segue regra atual.

## 3. Painel — exibição e edição (`src/routes/admin.painel.tsx`)

No card do evento, exibir três linhas de data: **Emissão**, **Vencimento**, **Pagamento**, além de **Nº doc** (vindo de `metadata.numero_extraido`).

No diálogo de edição, adicionar campos:
- `Nº do documento` (input text) — gravar em `metadata.numero_extraido` (merge com metadata atual).
- `Data de emissão` (input date) — gravar em `metadata.data_emissao`.
- `Data de vencimento` (já existe).
- `Data de pagamento` (já existe).
- `Descrição` com `maxLength={200}` e contador.

No `salvar()`, fazer update incluindo `metadata: { ...metadataAtual, numero_extraido, data_emissao }` junto com os campos nativos.

## Arquivos alterados
- `src/lib/captura.functions.ts` — schema, prompt, parse.
- `src/routes/admin.captura.tsx` — mapeamento dos campos extraídos.
- `src/routes/admin.painel.tsx` — card com as 3 datas + Nº doc, diálogo com novos campos e merge de metadata.

## Observações
- Não há mudança de schema do banco: número do doc, data de emissão e dados extras continuam em `metadata` (jsonb). Vencimento e pagamento usam colunas nativas.
- Comprovante junto: como o PDF inteiro já é enviado para a IA, basta o prompt instruir a leitura combinada — não precisa de novo upload.
