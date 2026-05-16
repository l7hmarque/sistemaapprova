# Upload em lote + análise sob demanda + progresso real + regras

## Objetivo
Substituir o fluxo atual "arrasta 1 PDF → IA dispara automaticamente → texto 'analisando'" por um fluxo controlado:

1. Usuário carrega **vários PDFs** (drag/drop ou seletor).
2. Sistema apenas **lista os arquivos confirmados** (nome, tamanho, status: "pronto").
3. Usuário pode abrir um painel **opcional** de "Pré-definições / Regras" (mês de referência, favorecido padrão extra, categoria padrão, prefixo idInterno etc.). Se não mexer, usa padrão.
4. Usuário clica **"Iniciar análise com IA"**.
5. Cada PDF é processado **sequencialmente** com **barra de progresso real** (status por arquivo: aguardando / lendo PDF / IA / pipeline / concluído / erro) e barra global (X de N).
6. Despesas extraídas de todos os PDFs são **mescladas** na tabela de revisão.

## Plano em 4 partes

### Parte 1 — UI de upload em lote (`src/routes/index.tsx`)

- Substituir `UploadCard` por `BatchUploadCard`:
  - Aceita múltiplos PDFs (`<input multiple>`, drop de N arquivos).
  - Mantém estado local `arquivos: PdfJob[]` com `{ id, file, status, etapa, progresso, erro, resultado }`.
  - Lista cada arquivo com nome, tamanho, ícone de status e botão "remover" (enquanto não estiver processando).
  - Botão **"Iniciar análise (N arquivos)"** desabilitado se lista vazia ou já processando.
  - Botão "Limpar lista".
- Manter compatibilidade: se usuário soltar 1 PDF, mesmo fluxo (lista de 1 + botão).

### Parte 2 — Progresso real

Como o endpoint `/api/extract` é síncrono (responde só no fim), o progresso "real" vem de **etapas observáveis no cliente** + **progresso por arquivo no lote**:

- Etapas exibidas por arquivo (cada uma com %):
  - `upload` 0–20% (XHR `upload.onprogress` em vez de `fetch`, para ter bytes enviados).
  - `analisando` 20–90% (timer com curva assintótica, capado em 90% até resposta — comum quando backend é caixa-preta; honesto desde que rotulado "estimado").
  - `concluido` 100% ao receber JSON.
- Barra **global**: `(arquivos_concluídos / total) * 100`, atualizada a cada arquivo.
- Componente `JobProgress` com `<Progress />` (shadcn) + label da etapa atual ("Enviando PDF…", "IA extraindo… (~Xs)", "Mesclando…").
- Tempo decorrido por arquivo (cronômetro mm:ss) para dar sensação de avanço.

> Observação: progresso 100% real do lado IA exigiria streaming SSE no `/api/extract`. Fica fora do escopo desta iteração; rotularemos a fase de IA como "estimada" para ser honesto.

### Parte 3 — Pré-definições opcionais (painel colapsável)

Painel `<details>` ou `Accordion` acima do botão "Iniciar análise", **fechado por padrão**:

- **Mês de referência forçado** (sobrescreve o detectado pela IA). Default: vazio (usa IA).
- **Categoria padrão** quando IA não sugerir (default: primeira de `CATEGORIAS`).
- **Tipo de documento padrão** (default: 1 = NF).
- **Prefixo de idInterno** para despesas sem código (default: `ext-`).
- **Modalidade de compra padrão** (default: lógica atual `modalidadePadrao`).
- **Favorecidos padrão extras** (textarea: `texto-chave => CNPJ;Nome`, uma por linha) — alimenta `aplicarFavorecidoPadrao` em runtime.

Estado salvo em `localStorage` (`sit-regras-v1`) para reutilizar entre sessões. Botão "Restaurar padrão".

Aplicação dessas regras acontece **no cliente**, dentro de `aplicarExtracao`, depois da resposta da IA — não muda o backend nem quebra o pipeline determinístico atual.

### Parte 4 — Orquestrador de lote

Nova função `processarLote(jobs)`:

```text
for (job of jobs) {
  job.status = 'enviando';   render
  const data = await uploadComProgresso(job, onProgress);
  job.status = 'mesclando';  render
  aplicarRegrasOpcionais(data, regras);
  acumular(data);            // mescla com despesas existentes
  job.status = 'concluido';  render
}
```

- `uploadComProgresso` usa `XMLHttpRequest` para ter `upload.onprogress` real.
- Erros por arquivo não abortam o lote — marca aquele job como `erro` e segue.
- Toast final: "X de N PDFs processados, Y despesas adicionadas".

## Arquivos afetados

- `src/routes/index.tsx` — substituir `UploadCard`, adicionar `BatchUploadCard`, `JobProgress`, painel `RegrasOpcionaisCard`, orquestrador.
- `src/lib/regrasUsuario.ts` (novo) — tipo `RegrasUsuario`, defaults, load/save no localStorage, função `aplicarRegrasUsuario(extracao, regras)`.
- Nada muda em `/api/extract`, `pipeline.ts`, parsers, schema — o fluxo de geração de `.txt` continua idêntico.

## O que NÃO muda

- Endpoint, schema, pipeline determinístico, regras de holerite, geração de `Despesa.txt` — tudo intocado.
- Comportamento de 1 PDF continua funcionando (lote de 1).
- Layout geral da página e demais cards permanecem.

## Riscos / mitigação

- **Worker timeout (30s CPU)**: processar sequencialmente evita várias chamadas concorrentes saturando o Worker; cada PDF mantém o mesmo limite atual.
- **Memória do cliente** com muitos PDFs grandes: limitamos a 10 arquivos por lote (avisa se exceder).
- **Progresso "estimado" durante IA**: rotulado claramente, sem mentir 100%.
