## Causa raiz

Na última passada de segurança, as policies amplas do bucket `documentos` foram removidas. Agora **só permitem upload se o caminho começar com o UUID da organização** do usuário (ex: `<org_id>/arquivo.pdf`).

Em `src/routes/admin.captura.tsx`, o upload é feito assim:

```ts
const path = `${hash}-${arquivo.name}`.slice(0, 200);
await supabase.storage.from("documentos").upload(path, arquivo, {...});
```

→ não tem prefixo de organização → RLS bloqueia → `up.error` é lançado.

Como `up.error` é um `StorageError` (objeto plano, não instância de `Error`), o `catch` cai em:
```ts
mensagem: e instanceof Error ? e.message : "Falha"
```
Resultado: badge "erro" sem mensagem útil. Não é cota de IA.

Bônus: `getPublicUrl` num bucket privado retorna URL que não funciona — depois é melhor usar signed URL.

## Plano de correção

**1. `src/routes/admin.captura.tsx` — prefixar caminho com `organization_id`**

- Obter o `organization_id` ativo do usuário no início do componente (via `useActiveOrg` ou consulta a `organization_members`).
- Trocar:
  ```ts
  const path = `${hash}-${arquivo.name}`.slice(0, 200);
  ```
  por:
  ```ts
  const safeName = arquivo.name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
  const path = `${orgId}/${hash.slice(0, 16)}-${safeName}`;
  ```
- Bloquear `processar()` se `orgId` ainda não carregou (toast "carregando organização").

**2. URL do arquivo — usar signed URL (bucket é privado)**

Trocar `getPublicUrl` por `createSignedUrl(path, 60 * 60 * 24 * 7)` e armazenar o `path` no `metadata` para regenerar quando o link expirar. Alternativa mínima: salvar só o `path` em `arquivo_url` e gerar signed URL on-demand na listagem. Vou pelo segundo caminho (mais simples e correto).

**3. Mensagem de erro real no catch**

Trocar:
```ts
mensagem: e instanceof Error ? e.message : "Falha"
```
por um helper que extrai `message` de `Error`, `StorageError`, `PostgrestError` ou objeto qualquer:
```ts
function msgErro(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as {message: unknown}).message);
  try { return JSON.stringify(e); } catch { return "Falha desconhecida"; }
}
```
E `console.error` continua para inspeção futura.

**4. Validação rápida**

Reprocessar o PDF de teste após o deploy e confirmar que o item vai para `vinculado` ou `orfao` em vez de `erro`.

## Fora do escopo

- Reprocessar registros antigos com path sem organização (não há histórico relevante ainda).
- Mover `extrairDocumento` para outro modelo — gateway respondeu 200, sem indício de cota.