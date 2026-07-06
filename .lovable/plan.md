## Problema

Depois da padronização das boundaries, todas as navegações internas caíram em 404 (a nova `RouteNotFound`). Causa: os `<Link to="...">` estão usando o **ID do arquivo de rota** (`/_authenticated/admin/...`) em vez do **caminho URL** (`/admin/...`). No TanStack Router, segmentos prefixados com `_` são apenas de layout e são removidos da URL — logo `/_authenticated/admin` não corresponde a rota nenhuma no navegador.

Servidor responde 200 em `/`, `/contadores` etc.; o 404 só aparece quando o usuário clica em algo no menu lateral ou em CTAs internos.

## Correção

Substituir, em todos os arquivos abaixo, o prefixo `"/_authenticated"` por `""` no atributo `to` de `<Link>` e nas chamadas `navigate({ to: "..." })` / `redirect({ to: "..." })`. Nenhum outro comportamento muda — os arquivos de rota continuam com o mesmo nome, o gate `_authenticated` continua ativo, apenas as URLs voltam a ser as reais (`/admin`, `/admin/arquivos`, `/owner`, `/owner/clientes/$id`, etc.).

Arquivos a ajustar:

- `src/components/admin/sidebar.tsx` — link para `/owner`
- `src/components/admin/EscritorioDashboard.tsx` — link para `/admin`
- `src/components/admin/PlanoGuard.tsx` — link para `/admin/configuracoes/organizacao`
- `src/components/owner/OwnerSidebar.tsx` — link para `/admin`
- `src/routes/_authenticated.admin.configuracoes.index.tsx` — `/admin/setup`
- `src/routes/_authenticated.admin.cotacoes.$id.tsx` — 2 links para `/admin/fornecedores`
- `src/routes/_authenticated.admin.orcamentos.tsx` — `/admin/cotacoes/$id`
- `src/routes/_authenticated.admin.modelos.tsx` — `/admin/modelos/ajuda`
- `src/routes/_authenticated.admin.modelos.ajuda.tsx` — `/admin/modelos`
- `src/routes/_authenticated.admin.setup.tsx` — 4 links (`/admin/configuracoes`, `/admin/arquivos` x2, `/admin`)
- `src/routes/_authenticated.owner.clientes.tsx` — `/owner/clientes/$id`
- `src/routes/_authenticated.owner.clientes.$id.tsx` — `/owner/clientes`
- `src/routes/convite.$token.tsx` — `/admin`
- `src/routes/_authenticated.owner.tsx` — `navigate({ to: "/_authenticated/admin" })` → `/admin`

Também varrer `navigate({ to: "/_authenticated/...` e `redirect({ to: "/_authenticated/...` em todo `src/` (rg) para pegar qualquer chamada equivalente escondida em handlers.

## Verificação

1. `curl` em `/`, `/contadores`, `/login` — devem seguir retornando 200 (sanity).
2. Playwright headless: fazer login com sessão injetada, clicar em cada item do menu lateral admin e do menu owner, checar que a URL final é `/admin/...` / `/owner/...` e que `<h1>` da página carrega (não o "404 Página não encontrada").
3. Rodar build para garantir que o typecheck de rotas do TanStack aceita os novos `to` (ele valida contra `routeTree.gen.ts`).

## Fora de escopo

- Redesign das páginas.
- Mudanças no gate `_authenticated` ou em RLS.
- Alterações em rotas públicas (`/`, `/contadores`, `/gestores`, `/blog`, etc.) — elas já respondem 200.
