## Problema

1. Após "PDF pronto" o `window.open(blobUrl)` é chamado depois de vários awaits (fetch + blob). Sem gesto do usuário no mesmo tick, o Chrome/pop-up blocker silenciosamente descarta a janela — daí "toast apareceu mas nada abriu".
2. O botão "Abrir" na lista de snapshots (`abrirSnapshot`) ainda chama `obterUrlSnapshot`, que devolve uma signed URL de `*.supabase.co` — mesmo bug de ad-blocker que já corrigimos no fluxo de geração.

## Correção

### 1. Abrir PDF sem pop-up bloqueado
Substituir `window.open(blobUrl)` por um `<a>` temporário disparado programaticamente com `download="prestacao-<mes>.pdf"`. Downloads via `<a download>` não são tratados como pop-up e não exigem gesto imediato.

Helper compartilhado em `src/routes/_authenticated.admin.prestacao.tsx`:

```ts
const baixarPdfDoStorage = async (storagePath: string, filename: string) => {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) throw new Error("Sessão expirada, faça login novamente.");
  const res = await fetch(`/api/prestacao/download?path=${encodeURIComponent(storagePath)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Falha ao baixar PDF (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;         // força download/abertura pelo visualizador nativo
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
```

Usar esse helper em `gerarOficial` (após "PDF pronto") no lugar do `window.open` atual.

### 2. Botão "Abrir" da lista de snapshots (relatório já gerado)
A lista `snapshots` já é carregada por mês em `carregar()` e renderizada com um botão "Abrir". Trocar `abrirSnapshot` para usar o mesmo proxy `/api/prestacao/download`, passando `s.pdf_path` diretamente — sem depender de `obterUrlSnapshot`/signed URL:

```ts
const abrirSnapshot = async (s: Snapshot) => {
  try {
    if (!s.pdf_path) throw new Error("Snapshot sem arquivo salvo");
    await baixarPdfDoStorage(s.pdf_path, `prestacao-${mes}.pdf`);
  } catch (e: any) {
    toast.error(e?.message || "Falha ao abrir");
  }
};
```

Atualizar a chamada `onClick={() => abrirSnapshot(s.id)}` para passar `s`.

Como o botão vive no painel de snapshots do mês selecionado, o usuário já tem "abrir relatório já gerado praquele mês". Caso o painel esteja escondido quando vazio, garantir que ele apareça sempre que houver `snapshots.length > 0` (já é o caso hoje).

### 3. Limpeza
Remover o import não usado `obterUrlSnapshot` de `src/lib/prestacao-snapshot.functions` no arquivo da rota (mantém a server fn no backend por enquanto; sem mudanças em outros arquivos).

## Fora de escopo
- Alterar `prestacao-snapshot.functions.ts` / rota `/api/prestacao/download` (já funcionam).
- Botão "Abrir no Drive".
- Preview em iframe (já removido).

## Arquivos afetados
- `src/routes/_authenticated.admin.prestacao.tsx` (frontend apenas).