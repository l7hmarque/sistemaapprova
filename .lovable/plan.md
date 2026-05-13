## Visão Geral

App web (TanStack Start) para a prestação de contas no padrão **SIT/TCE-PR**. O usuário sobe um PDF mensal de despesas; a IA (Lovable AI Gateway, Gemini) extrai as linhas; o app exibe 4 tabelas de conferência editáveis (1.1, 1.2, 1.3, 2.4) e gera o `Despesa.txt` ANSI com pipes prontos para importação.

Backend mínimo: **Lovable Cloud** ativada para guardar as sessões de prestação de contas (PDF + linhas extraídas + correções) e permitir reabrir/baixar depois. A chamada à IA fica em uma server route `/api/extract` que recebe o PDF e devolve JSON estruturado.

---

## Arquitetura

```text
src/
  routes/
    index.tsx                  # Dashboard / nova prestação
    prestacao.$id.tsx          # Workspace de revisão (4 tabelas + export)
    api/extract.ts             # POST PDF -> JSON estruturado (Gemini)
    api/export.$id.ts          # GET .TXT ANSI gerado
  lib/
    sit/
      formatLinha.ts           # Função do item 1 (12 campos | pipe)
      formatLinha.test.ts      # Testes unitários (casos do prompt)
      categorias.ts            # Códigos 3.1.90.11.01 etc.
      tiposDocumento.ts        # 1=NF, 2=Recibo, 3=Folha, 4=Guia, 6=Tarifa, 20=Outros
      subtipos.ts              # 4=RPA, 5=Holerite, 7=DARF, 9=GPS, 10=GFIP
      ansiEncode.ts            # UTF-8 -> ANSI (windows-1252) para download
    extract/
      schema.ts                # Zod schema do retorno da IA
      prompt.ts                # System prompt da extração
  components/
    UploadDropzone.tsx
    ResumoFinanceiroCards.tsx  # Tabela 1.3
    TabelaReceitas.tsx         # Tabela 1.1
    TabelaDespesas.tsx         # Tabela 1.2 (editável + dropdown categoria)
    TabelaCategorias.tsx       # Tabela 2.4
    ExportarTxtButton.tsx
```

---

## Item 1 — Função `formatLinhaSIT` (TypeScript puro, testada)

Arquivo: `src/lib/sit/formatLinha.ts`

Assinatura:
```ts
type DespesaInput = {
  dtDespesa: string; vlDespesa: string | number;
  cdTipoDocumentoDespesa: number; cdSubtipoDocumentoDespesa?: number | null;
  nrDocumentoDespesa: string; dtEmissaoDocumentoDespesa: string;
  tpDocumentoFavorecido: 'CPF' | 'CNPJ' | 'EXT';
  nrDocumentoFavorecido: string; nmFavorecido: string; dsObjetoDespesa: string;
};
formatLinhaSIT(input: DespesaInput, nrLinha: number, idDespesa: number | string): string
```

Regras (exatas conforme o prompt):
- **Higienização**:
  - `nrDocumentoFavorecido`: `.replace(/\D/g,'')`.
  - `vlDespesa`: se string, remover `.` de milhar, trocar `,` por `.`, `Number().toFixed(2)`.
  - `nmFavorecido`, `dsObjetoDespesa`, `nrDocumentoDespesa`: `.replace(/[|"'\\\r\n]/g,' ')` + `.normalize('NFD').replace(/[\u0300-\u036f]/g,'')`.
  - Truncate: nome ≤ 100, objeto ≤ 1000.
- **Override de Guias** (`cdTipoDocumentoDespesa === 4`):
  - subtipo 7 (DARF) → CNPJ `00394460000141`, "Ministerio da Fazenda".
  - subtipo 9 (GPS)  → CNPJ `16727230000197`, "Fundo do Regime Geral de Previdencia Social".
  - subtipo 10 (GFIP) → CNPJ `00360305000104`, "Caixa Economica Federal".
- **Saída**: 12 campos na ordem `nrLinha|idDespesa|dtDespesa|vlDespesa|cdTipo|cdSubtipo|nrDocDespesa|dtEmissao|tpDocFav|nrDocFav|nmFavorecido|dsObjeto|` — sempre **terminando com `|`**, vazios viram `||`.

Teste com Vitest cobrindo: caso normal, override DARF/GPS/GFIP, valor "1.250,50" → "1250.50", acentos/pipes removidos, truncate.

---

## Item 2 — Pipeline de Extração (PDF → 4 Tabelas)

`POST /api/extract` (server route) recebe o PDF (multipart) e chama `google/gemini-3-flash-preview` via Lovable AI Gateway com **structured output** (Zod). Schema retornado:

```ts
{
  receitas: [{ numeroParcela, valor, dataRecebimento }],            // -> Tabela 1.1
  despesas: [{                                                       // -> Tabela 1.2
    idInterno, data, descricao, favorecido, documento, valor,
    tipoDocumento, subtipoDocumento, tpDocFav, nrDocFav,
    sugestaoCategoria  // ex: '3.1.90.11.01'
  }],
  resumo: { saldoAnterior, transferidos, rendimentos, estornados }, // -> Tabela 1.3
}
```

A **Tabela 2.4** (saldo por categoria econômica) é montada no front cruzando `despesas[].sugestaoCategoria` (editável pelo usuário) com a tabela de previsão fixa em `lib/sit/categorias.ts` (extraída do REO.xlsx — 30 códigos com Valor Previsto). Valor Gasto e Saldo Disponível recalculam ao vivo.

Tabela 1.3 calcula `Saldo do mês = saldoAnterior + transferidos + rendimentos – estornados – Σ(despesas)`, exibido no dashboard de cards.

---

## Item 3 — UI

**`/` (index)**: dropzone grande de PDF + lista de prestações anteriores. Ao subir, chama `/api/extract`, persiste em `prestacoes` (Lovable Cloud) e navega para `/prestacao/$id`.

**`/prestacao/$id`** (workspace, layout 12-col profissional):
- Topo fixo: nome do mês + botão **"Exportar .TXT"** (sticky).
- Faixa de **cards (Tabela 1.3)**: Saldo Anterior, Transferidos, Rendimentos, Estornados, Executado, Saldo Próximo Mês — com indicador verde/vermelho se "fecha".
- Tabs lado-a-lado:
  1. **Receitas (1.1)** — read-only.
  2. **Despesas (1.2)** — `<table>` editável: cada linha com inputs inline (favorecido, valor, doc, data), `<Select>` de **Tipo Documento** (1/2/3/4/6/20), `<Select>` de **Subtipo** (visível só se tipo 3 ou 4), `<Select>` de **Categoria 2.4** (30 códigos), botão remover linha + botão "+ Adicionar despesa".
  3. **Execução Orçamentária (2.4)** — recalculada ao vivo, destaca linhas estouradas em vermelho.

Antes de exportar, valida (Zod) cada linha; linhas inválidas são destacadas e o export é bloqueado com toast explicando o erro.

**Exportar .TXT**: chama `formatLinhaSIT` para cada despesa, junta com `\r\n`, converte para **ANSI/windows-1252** (via `iconv-lite` já compatível com Worker) e dispara download de `Despesa.txt`.

---

## Backend / Persistência

Ativar **Lovable Cloud**. Tabelas:
- `prestacoes` (id, user_id, mes_referencia, pdf_storage_path, resumo jsonb, created_at)
- `prestacao_despesas` (id, prestacao_id, ordem, payload jsonb, categoria_codigo, valido bool)
- `prestacao_receitas` (id, prestacao_id, payload jsonb)

RLS: cada usuário vê apenas suas prestações (`auth.uid() = user_id`). Storage bucket privado `prestacao-pdfs` para os PDFs originais.

Auth simples: email+senha (telas `/login`, `/signup` sob `_authenticated`).

---

## Detalhes Técnicos

- IA: server route com `generateText` + `Output.object({ schema })` (Vercel AI SDK + `@ai-sdk/openai-compatible`). PDF enviado como `file` part multimodal pro Gemini.
- ANSI: `iconv-lite` (`encode(texto, 'win1252')`) → `Blob` com `application/octet-stream`.
- Categorias e subtipos como `as const` enums em `lib/sit/`.
- Validação de linha (Zod): tamanhos máx (nome 100, objeto 1000, CNPJ 14, CPF 11), datas `YYYY-MM-DD`, valor decimal positivo.
- Erros do gateway (429/402) viram toasts claros.
- `formatLinha.test.ts` rodado com `bunx vitest run` antes do build.

---

## Entregas desta iteração

1. Ativar Lovable Cloud + auth + tabelas/RLS/bucket.
2. `lib/sit/formatLinha.ts` + testes Vitest (todos os casos do prompt).
3. `lib/sit/categorias.ts` (30 códigos do REO) e `tiposDocumento.ts`/`subtipos.ts`.
4. `routes/api/extract.ts` (Gemini + Zod).
5. UI: `index.tsx` (upload + lista) e `prestacao.$id.tsx` (cards + 3 tabs editáveis).
6. Exportar `Despesa.txt` ANSI.
7. SEO básico em cada rota (head meta).