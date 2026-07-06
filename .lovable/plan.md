## Diagnóstico

`ERR_BLOCKED_BY_CLIENT` = **bloqueador de anúncios/privacidade do navegador** (uBlock, AdBlock, Brave Shields, Kaspersky, etc.) barrando o domínio `*.supabase.co`. Várias listas populares (EasyPrivacy, Fanboy) tratam subdomínios de PaaS como `supabase.co` como tracker de terceiros. Como agora servimos o PDF via signed URL do Storage direto em `afikxcuergsyygytmgub.supabase.co`, o clique cai nessa lista.

Não dá pra "consertar" no cliente. A saída é servir o PDF do **mesmo domínio da aplicação** (`*.lovable.app` / domínio custom), que não está nas listas.

## Solução

Criar uma rota de servidor autenticada que faz proxy do PDF a partir do Storage, e devolver essa URL como link primário no lugar do signed URL do Supabase.

### 1. Nova rota `src/routes/api/prestacao.download.ts`
- `GET /api/prestacao/download?path=<storage-path>`
- Auth: valida bearer token via `SUPABASE_URL/auth/v1/user` (mesmo padrão da rota `prestacao.preview.ts` deletada). Se não tiver sessão → 401.
- Confere que `path` começa com `${orgId}/` do usuário atual (via `current_user_org`) — impede baixar PDF de outra org.
- Faz `supabaseAdmin.storage.from('prestacoes').download(path)` e devolve os bytes com:
  - `Content-Type: application/pdf`
  - `Content-Disposition: inline; filename="Prestacao ${mes}.pdf"`
  - `Cache-Control: private, max-age=300`

### 2. Ajuste em `gerarPrestacaoContas` (`src/lib/prestacao.functions.ts`)
- Depois do upload, montar a URL primária como caminho relativo `/api/prestacao/download?path=<encoded>` em vez de `signed url` do Supabase.
- Manter `driveUrl` como secundário para o caso de o proxy falhar.
- Não precisa mais gerar signed URL do Storage (economiza chamada).

### 3. Frontend
- Como a rota exige bearer, `window.open(r.url)` numa nova aba não manda o header. Duas opções:
  - **A (escolhida):** rota autentica por bearer no header **ou** por query token de curta duração (`?t=<jwt>`). Servidor aceita ambos e valida.
  - Frontend anexa `?t=${session.access_token}` no href antes de abrir.
- Alternativa mais simples e sem token na URL: fazer `fetch` com bearer → `blob()` → `URL.createObjectURL` → `window.open`. Objeto blob é local ao navegador, ad-blocker não vê domínio externo. Vou adotar essa (evita expor JWT em query/logs).

### Fluxo final no botão "Gerar relatório"
1. `gerar()` → retorna `{ url: "/api/prestacao/download?path=...", driveUrl, nome, ... }`
2. Frontend: `fetch(url, { headers: { Authorization: Bearer <token> } })` → `blob` → `window.open(URL.createObjectURL(blob))`
3. Aba abre `blob:` — nenhum domínio externo → nenhum ad-blocker envolvido.

## Arquivos

- **Criar:** `src/routes/api/prestacao.download.ts`
- **Editar:** `src/lib/prestacao.functions.ts` (retornar path relativo)
- **Editar:** `src/routes/_authenticated.admin.prestacao.tsx` (fetch com bearer → blob → open)

## Fora de escopo

- Adicionar botão "abrir no Drive" — se quiser, faço numa próxima.
- Fila assíncrona.