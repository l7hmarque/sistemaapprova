## Objetivo

Restaurar o fluxo completo "captura → painel → Despesa.txt (SIT)" que existia no projeto SIT Sync, agora integrado ao Supabase e ao multi-org do projeto atual. Hoje a IA extrai apenas dados genéricos e o painel não tem botão de exportar — o lançamento no SIT está quebrado.

## 1. Migration — colunas SIT em `eventos_financeiros` e Termo por organização

Adicionar em `public.eventos_financeiros` (todas nullable, para não quebrar dados existentes):

- `id_interno text` (≤30 chars, controle/conferência)
- `data_emissao date` (campo 12 do SIT)
- `tp_documento_despesa smallint` (campo 9 — Apêndice A item 16)
- `tp_doc_fav text` (`CPF` | `CNPJ` | `EXT`)
- `nr_doc_fav text` (campo 7)
- `nm_favorecido text` (campo 8, ≤250)
- `nr_documento text` (campo 10, ≤10)
- `cd_modalidade_compra smallint` (campo 17)
- `tp_documento_pagamento smallint` (campo 20)
- `nr_documento_pagamento text` (campo 21, ≤15)
- `tp_despesa integer` (campo 5 — código REO/Apêndice A item 12)

Persistir o Termo por organização em `public.configuracoes` na chave `sit_termo` com o JSON:

```json
{
  "nrCNPJConcedente": "00000000000000",
  "tpTransferencia": 1,
  "nrInternoConcedente": "string",
  "anoTransferencia": 2025
}
```

(usa a tabela `configuracoes` já existente — RLS por organização já está aplicada.)

## 2. Atualizar prompt e schema da IA (`src/lib/captura.functions.ts`)

Estender `DadosExtraidos` e o SYSTEM prompt para também sugerir a classificação SIT:

```json
{
  "tipo": "...",
  "cnpj": "...", "razao_social": "...",
  "valor": 0, "numero": "...",
  "data_emissao": "AAAA-MM-DD|null",
  "data_vencimento": "AAAA-MM-DD|null",
  "data_pagamento": "AAAA-MM-DD|null",
  "descricao": "≤200 chars",

  "tp_doc_fav": "CNPJ|CPF|EXT|null",
  "tp_documento_despesa": "código Apêndice A item 16 ou null",
  "tp_documento_pagamento": "código Apêndice A item 18 ou null",
  "categoria_sit": "código REO (tpDespesa) sugerido ou null",
  "cd_modalidade_compra": "código ou null"
}
```

Incluir no prompt a tabela resumida dos códigos SIT mais usados (NF=1, Boleto=8, DARF=9, GPS=10, GFIP/GRRF=11/12, Recibo=2, Holerite=4, Fatura=5) e dos tipos de pagamento (Cheque=1, TED/DOC=2, Transferência=3, PIX=4, Débito automático=5, Dinheiro=6).

## 3. Mapeamento na captura (`src/routes/admin.captura.tsx`)

- Preencher os novos campos `tp_documento_despesa`, `tp_doc_fav`, `nr_doc_fav`, `nm_favorecido`, `nr_documento`, `tp_documento_pagamento`, `data_emissao`, `tp_despesa` direto na coluna do evento (não só no `metadata`).
- Aplicar overrides automáticos de favorecido padrão antes do insert (DARF → CNPJ Min. Fazenda; GPS → FRGPS; GFIP/GRRF/GFD → CAIXA; Sanepar/Copel quando reconhecidos). Reusar o `aplicarFavorecidoPadrao` de `src/lib/extract/favorecidosPadrao.ts`.
- Substituir `inferirCategoria` (que devolve label) por um mapeamento para código REO; quando a IA não souber, deixar `tp_despesa` null e marcar `status_documental = 'pendente'`.
- Gerar `id_interno` curto (ex.: `mes_referencia + sequencial`) ≤30 chars.

## 4. Painel — edição dos campos SIT (`src/routes/admin.painel.tsx`)

No diálogo de edição do evento, adicionar inputs nativos (não em metadata) para:

- Nº documento, data emissão, data vencimento, data pagamento (já existem)
- Tipo doc favorecido (select CPF/CNPJ/EXT)
- Nº doc favorecido + Nome favorecido
- Tipo documento despesa (select com Apêndice A item 16)
- Modalidade de compra (select Apêndice A item 17)
- Tipo documento pagamento (select Apêndice A item 18) + Nº doc pagamento
- Tp despesa / código REO (select alimentado pelos catálogos em `src/lib/sit/catalogos.ts`)
- Descrição (já existe, manter `maxLength={200}`)
- `id_interno` (opcional, ≤30 chars)

No card, exibir badge "Pronto p/ SIT" quando todos os campos obrigatórios do SIT estiverem preenchidos; senão "Faltam: …".

## 5. Configurações — tela do Termo (`src/routes/admin.configuracoes.organizacao.tsx`)

Adicionar um bloco "Dados do Termo (SIT)" com os 4 campos do Termo, salvando em `configuracoes.sit_termo` da organização ativa. Validar CNPJ (14 dígitos) e ano (4 dígitos).

Aplicar os dados pro CAIA Medianeira que estavam no projeto anterior citado.

## 6. Exportar Despesa.txt no painel

Adicionar botão **"Exportar Despesa.txt"** no header do `admin.painel.tsx`, filtrado pelo `mes_referencia` selecionado. Lógica:

1. Buscar `configuracoes.sit_termo` da org; se ausente → toast "Configure o Termo em Configurações > Organização" e abortar.
2. Buscar eventos do mês com `data_pagamento` preenchido e `tp_despesa` não-nulo. Eventos incompletos entram em um relatório de pendências exibido antes do download (lista do que falta por evento).
3. Para cada evento elegível, montar `DespesaInput` e gerar linha via `formatLinhaSIT(termo, despesa)` (reusar `src/lib/sit/formatLinha.ts`).
4. Concatenar com `\r\n`, codificar com `encodeWin1252` (já existe em `src/lib/sit/ansiEncode.ts`) e disparar download `Despesa-{mes}.txt`.

Nenhuma chamada de servidor é necessária — tudo no cliente, já que `formatLinhaSIT`/`encodeWin1252` são puros e os eventos já vêm via Supabase.

## 7. Limpeza

- Não remover o exportador legado em `src/routes/ferramenta.tsx` (continua funcionando com localStorage para usuários que ainda usam).
- `documentos_anexos` permanece como hoje (anexos por evento, sem mudança de schema).

## Arquivos afetados

- **migration**: novas colunas em `eventos_financeiros` (apenas `ALTER TABLE … ADD COLUMN`, sem mudar policies).
- `src/lib/captura.functions.ts` — schema/prompt enriquecidos com campos SIT.
- `src/routes/admin.captura.tsx` — mapeamento dos novos campos + overrides de favorecido padrão + id_interno.
- `src/routes/admin.painel.tsx` — diálogo de edição completo + botão "Exportar Despesa.txt" + validação de pendências.
- `src/routes/admin.configuracoes.organizacao.tsx` — bloco "Dados do Termo (SIT)".
- (sem mudanças em `src/lib/sit/*` — catálogos, `formatLinhaSIT` e `encodeWin1252` já estão corretos e idênticos ao SIT Sync.)

## Observações

- Como `tp_despesa` agora é coluna, dá pra filtrar/agrupar por código REO no painel no futuro (não faz parte deste plano).
- O TXT segue 24 campos pipe-separated terminando com `|`, datas DD-MM-AAAA, valor `0.00`, ANSI (Win-1252) — exatamente como no SIT Sync.
- A migration só adiciona colunas nullable — dados existentes continuam válidos; o usuário completa via diálogo do painel ou re-extração.