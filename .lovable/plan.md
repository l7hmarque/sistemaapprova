
## Objetivo

Ao clicar em **"Gerar relatório"** em `/admin/prestacao`, o sistema deve produzir **um único PDF** contendo, na ordem:

1. **Capa/Template** — o Google Docs configurado em `configuracoes.prestacao_template`, exportado para PDF.
2. **Sumário/Relação de documentos** — página gerada automaticamente listando tudo que vem em seguida (nº, nome, data, origem).
3. **Documentos cadastrados** em `prestacao_documentos` do mês, na ordem definida, cada um na íntegra.
4. **Comprovantes das despesas** do mês — anexos de `documentos_anexos` vinculados a `eventos_financeiros` cuja `mes_referencia = mesReferencia`, agrupados por evento (ID interno + favorecido + valor).

O PDF final é salvo no Drive (pasta da org → `Prestações/{mes}`) **e** anexado ao snapshot no bucket `prestacoes` para download imutável.

## Como funciona

### 1. Coleta das fontes
- Buscar `configuracoes.prestacao_template` → exportar Google Docs como PDF via Drive API: `GET /files/{id}/export?mimeType=application/pdf`.
- Buscar `prestacao_documentos` do mês (já existe).
- Buscar `eventos_financeiros` do mês + `documentos_anexos` associados (com `storage_bucket`, `storage_path`, `nome`, `mime_type`).

### 2. Download dos anexos
Para cada anexo:
- **Drive** (URL `drive.google.com/file/d/...`): `GET /files/{id}?alt=media`.
- **Storage interno** (`documentos` bucket): `supabaseAdmin.storage.from(...).download(path)` — só invocado do servidor após auth.
- **URL externa**: `fetch()` direto.

### 3. Normalização para PDF
- **PDF**: usa como está.
- **Imagem** (jpg/png/webp): embute como página PDF única usando `pdf-lib` (`embedJpg` / `embedPng`).
- **DOCX/outros**: exporta via Google Drive (upload temporário → export PDF → apaga) **ou** marca como "não convertível" com uma página de aviso. **Decisão:** MVP converte apenas PDF+imagem; para DOCX gera página de aviso com link do original. (Simples e suficiente — usuário indicou que anexos hoje são PDF.)

### 4. Geração do sumário
Página PDF gerada com `pdf-lib` listando: `#`, nome do documento, data, e nº da página onde começa dentro do PDF final.

### 5. Merge final
`pdf-lib`: `PDFDocument.create()` + `copyPages()` de cada fonte na ordem: template → sumário → docs cadastrados → comprovantes agrupados por evento (com página separadora por evento contendo ID interno, favorecido, valor, data).

### 6. Persistência
- Upload no Storage `prestacoes/{org_id}/{mes}/{timestamp}-prestacao.pdf`.
- Upload cópia no Drive via `drive.files.create` (multipart) na pasta `Prestações/{mes}`.
- Retorna `{ driveUrl, storageSignedUrl, fileName, totalPaginas }` para o front abrir em nova aba.

### 7. UI
- Botão "Gerar relatório" mantém comportamento; toast passa a mostrar "Montando PDF (X documentos, Y comprovantes)…".
- Adiciona indicador de progresso simples (spinner + texto).

## Arquivos

**Novos:**
- `src/lib/prestacao-pdf.server.ts` — funções server-only: `exportarDocsComoPdf(fileId)`, `baixarDrivePdf(url)`, `imagemParaPdf(bytes, mime)`, `montarSumario(items)`, `paginaSeparadora(evento)`.
- Nova server function `gerarPrestacaoPdfUnico` em `src/lib/prestacao.functions.ts` (ou substitui a atual `gerarPrestacaoContas` — **substitui**, pois a saída antiga não é mais desejada).

**Editados:**
- `src/lib/prestacao.functions.ts` — reescrever handler para produzir PDF único.
- `src/routes/_authenticated.admin.prestacao.tsx` — ajustar toast/texto do botão; a chamada permanece.
- `package.json` — adicionar `pdf-lib`.

**Migração:** nenhuma (bucket `prestacoes` já existe; snapshot já tem campo `pdf_path`).

## Detalhes técnicos

- **Runtime:** Cloudflare Workers via nodejs_compat. `pdf-lib` é pure-JS e funciona no Worker.
- **Tamanho:** um mês típico com 20 comprovantes de 200 KB gera ~5 MB — dentro do limite do Worker (128 MB memory).
- **Auth Drive:** usa gateway `google_drive` já configurado (`GOOGLE_DRIVE_API_KEY` + `LOVABLE_API_KEY`).
- **Ordem dos comprovantes:** por `data_pagamento` asc, depois `id_interno`.
- **Anexos de despesas excluídas** (`excluido_em IS NOT NULL`): ignorados.
- **Falha em um anexo específico:** insere página de erro (nome + motivo) e segue — não aborta o PDF inteiro.

## Fora de escopo (não faremos agora)

- Conversão automática de DOCX/XLSX (fica página de aviso com link).
- Assinatura digital do PDF (ICP-Brasil).
- Marca d'água ou numeração global "página X de Y" — pode entrar depois.
