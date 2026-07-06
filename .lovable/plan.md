## Problema 1 — páginas duplicadas no PDF de prestação

Investigação no banco: um mesmo arquivo de comprovante (`testeDespesas.pdf`) está anexado como `documentos_anexos` a 12 eventos diferentes (outra versão do mesmo arquivo, a 7). Como o pipeline em `montarPdfBytes` (`src/lib/prestacao.functions.ts`) cria um job por `(evento, anexo)` e mescla cada um sequencialmente, aquele PDF de várias páginas é copiado inteiro **12 vezes** no relatório final — daí a percepção de "várias páginas duplicadas das despesas capturadas".

## Correção 1 — deduplicar comprovantes por conteúdo no merge

Trocar o loop de anexos por uma estratégia com chave de conteúdo estável:

- `fileKey = drive_file_id ?? normalizar(arquivo_url)` (para signed URLs do Storage, extrair só o path interno — sem o query string do token — para que dois signed URLs do mesmo objeto colidam).
- Manter um `Map<fileKey, { primeiroEventoIdInterno, eventos: string[] }>` percorrendo `eventos` na ordem.
- Anexar o arquivo **uma única vez** no PDF, associado ao primeiro evento que o referencia. Os eventos subsequentes que compartilham o mesmo arquivo aparecem no sumário com a nota `"comprovante compartilhado com #NNN"` e **não geram novo download nem novas páginas**.
- Ajustar `totalComprovantes` para contar arquivos distintos anexados (não relações evento×anexo), refletindo o que o PDF realmente contém.
- Log server-side quando um comprovante é compartilhado (útil para auditoria futura), sem alterar o comportamento em caso de anexos únicos.

Ganho colateral: menos downloads paralelos → geração mais rápida.

Fora de escopo: alterar a UI de anexos ou impedir que o mesmo arquivo seja anexado a múltiplos eventos (isso é comportamento válido; a correção é só no relatório).

## Problema 2 — botão "Visualizar" em Arquivos

Em `src/routes/_authenticated.admin.arquivos.tsx` o botão do ícone `Eye` abre um `<Dialog>` com `<iframe src="/api/files/{id}/preview?t=…">`. O usuário pediu para trocar por download direto.

## Correção 2 — download direto em Arquivos

- Remover: estado `previewFile`, `previewUrl`, o `useEffect` que constrói a URL, o `<Dialog>` inteiro e o import do `Eye`.
- Trocar o botão por um `FileDown` (ou `Download`) que chama um helper novo:

```ts
const baixarArquivo = async (id: string, name: string, mimeType: string) => {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) return toast.error("Sessão expirada, faça login novamente.");
  const res = await fetch(`/api/files/${id}/preview?t=${encodeURIComponent(token)}`);
  if (!res.ok) return toast.error(`Falha ao baixar (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name || `arquivo-${id}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
```

O endpoint `src/routes/api/files/$id/preview.ts` **não muda** — continua servindo os bytes, e o `<a download>` no cliente força o download com o nome correto sem depender de `Content-Disposition`.

## Fora de escopo
- Alterar migration / regras de duplicidade em `documentos_anexos`.
- Alterar o endpoint `/api/files/$id/preview` ou renomeá-lo.
- Mexer no botão "Abrir PDF" da lista de snapshots (já usa download proxy).

## Arquivos afetados
- `src/lib/prestacao.functions.ts` — dedup por `fileKey` no merge/sumário/contadores.
- `src/routes/_authenticated.admin.arquivos.tsx` — trocar botão Visualizar por download direto e remover o modal.