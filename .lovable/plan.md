## Objetivos

1. **Remover a feature de Pré-visualização** (era lenta demais e agrega pouco valor)
2. **Acelerar a geração do PDF de Prestação de Contas** (hoje sequencial)
3. **Mitigar o erro `ERR_BLOCKED_BY_RESPONSE` ao abrir o PDF gerado** (`drive.usercontent.google.com`)

---

## 1. Remover Pré-visualização

- Deletar `src/routes/api/prestacao.preview.ts`
- Em `src/routes/_authenticated.admin.prestacao.tsx`: remover estado `previewUrl / previewMeta / previewLoading`, função `abrirPreview / fecharPreview`, botão "Pré-visualizar" e o `<Dialog>` do iframe (linhas ~65-67, 207-230, 273, 370-390)
- Manter apenas o botão "Gerar relatório"

## 2. Otimizar geração do PDF

**Diagnóstico da lentidão** em `montarPdfBytes` (`src/lib/prestacao.functions.ts`):
- Todo download do Drive (template + cada documento + cada anexo) é feito **um por vez** dentro de `for...of` — se há 20 arquivos, são 20 round-trips sequenciais ao Google.
- Para cada arquivo faz 2 requests: `files.get` (metadata) + `?alt=media` (bytes). Dá pra fazer só 1 com `alt=media` + header e ler `Content-Type` da resposta.
- `PDFDocument.load` + `copyPages` é feito estritamente em ordem, bloqueando o merge enquanto espera IO.

**Mudanças:**
- Introduzir helper `mapPool(items, concurrency, fn)` (concorrência ~6) e baixar **todos os bytes em paralelo** antes do merge (uma "fase de download", outra "fase de merge").
- Encurtar `downloadDriveMedia`: fazer só `?alt=media&fields=...` numa chamada; pegar `content-type` e `content-disposition` do header de resposta; fallback para `files.get` só se der 4xx específico de Google Doc nativo.
- Fazer download do template em paralelo com a query de documentos/anexos (já disparado com `Promise.all`).
- Log de timing por fase (download vs merge vs upload) via `console.time` para futura observabilidade.

Expectativa: reduções de 5-10× em relatórios com >10 anexos.

## 3. Mitigar `ERR_BLOCKED_BY_RESPONSE`

**Causa provável:** hoje devolvemos `webViewLink` do Drive, e o navegador é redirecionado para `drive.usercontent.google.com` para servir o binário. Esse subdomínio frequentemente é bloqueado por extensões, políticas COOP/COEP ou pelo próprio Google quando a sessão do usuário no Drive não corresponde.

**Solução:** subir o PDF final **também no bucket `prestacoes` do Lovable Cloud** e devolver uma **signed URL** dessa cópia como link primário. O upload no Drive continua para o arquivo institucional/backup.

Detalhes:
- Em `gerarPrestacaoContas`, após `montarPdfBytes`:
  - Upload para bucket `prestacoes` em `${orgId}/${mes}/${timestamp}.pdf` via `sb.storage.from('prestacoes').upload(...)` (RLS já limitada por org).
  - `createSignedUrl(path, 60*60*24*7)` (7 dias).
  - Upload no Drive **em paralelo** (`Promise.all`), tolerante a falha (se Drive falhar, o link do Storage ainda funciona).
- Retornar: `{ url (signed URL do Storage), driveUrl (webViewLink, opcional), fileId, nome, totalPaginas, totalDocs, totalComprovantes }`.
- Frontend abre `url` (Storage) em nova aba — link direto ao PDF, sem redirect para `drive.usercontent.google.com`.
- Se o botão "Abrir no Drive" fizer sentido, mostrar como secundário quando `driveUrl` existir.

## Arquivos afetados

- **Deletar:** `src/routes/api/prestacao.preview.ts`
- **Editar:** `src/lib/prestacao.functions.ts` (paralelização, download simplificado, dupla persistência)
- **Editar:** `src/routes/_authenticated.admin.prestacao.tsx` (remover preview, ajustar handler ao novo retorno)
- **Sem migração:** bucket `prestacoes` já existe.

## Fora de escopo

- Fila assíncrona / background worker (só entra se, mesmo paralelizado, estourar o timeout do runtime).
- Cache de PDFs já gerados por (org, mês).
- Watermark/assinatura no PDF final.