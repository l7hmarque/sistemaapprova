## Objetivo

1. Remover o tour guiado de todas as páginas.
2. Refazer o wizard de configuração inicial: cada cliente conecta o **próprio** Google Drive via OAuth, e o sistema cria automaticamente a estrutura de pastas raiz + subpastas. Mesmo fluxo serve para Docs/Sheets (mesma família `google_*`).

## Boa notícia técnica

O Lovable já oferece o **App User Connector** — fluxo OAuth por usuário final via gateway, usando o `connector_id: "google"` com scopes customizados. Isso significa que **não precisamos** criar projeto próprio no Google Cloud Console, nem gerenciar `client_id/secret`, nem refresh tokens manuais. O gateway cuida de tudo. A mesma `connection_id` da família `google` funciona para `google_drive`, `google_docs` e `google_sheets`.

## Etapa 1 — Remover tour (rápido)

- Deletar `src/components/tour/AdminTour.tsx`.
- Remover `<AdminTour />` do `AdminShell` (e qualquer outro lugar onde for renderizado).
- Remover botões/links "Reiniciar tour" e chamadas a `startAdminTour(...)` espalhadas (provavelmente em sidebar / configurações).
- Remover dependência `react-joyride` do `package.json`.
- Limpar chaves `synsit:tour:v2:*` do localStorage não é necessário — viram inertes.

## Etapa 2 — Infra OAuth por cliente

**Helpers Lovable** (criar os 2 arquivos exatos do contrato do framework):
- `src/integrations/lovable/appUserConnector.ts` (server-only — workspace key)
- `src/integrations/lovable/appUserConnectorClient.ts` (browser-safe — popup + postMessage)

**Tabela nova** `org_google_connections`:
- `organization_id uuid PK FK → organizations.id`
- `connection_id text NOT NULL` (handle do gateway)
- `email text` (e-mail da conta Google conectada, retornado via `/oauth2/v3/userinfo`)
- `scopes text[]`
- `drive_root_id text` (preenchido após wizard criar a estrutura)
- `drive_root_url text`
- `subpastas jsonb` (`{ "Orçamentos": {id,url}, "Cotações": {...}, ... }`)
- `conectado_em`, `atualizado_em`
- RLS: SELECT/UPDATE/DELETE só para `is_org_owner(auth.uid(), organization_id)`; super_admin com bypass.
- GRANTs para `authenticated` + `service_role`.

**Secret novo**: `GOOGLE_APP_USER_CONNECTOR_CLIENT_ID` (vou pedir via `add_secret`; é o client-id que o Lovable usa para identificar a aplicação dentro do connector gateway — pode ser preenchido com um identificador estável do projeto, conforme orientação da Lovable; valor não é segredo crítico mas precisa existir).

## Etapa 3 — Server fns (`src/lib/google-oauth.functions.ts`)

- `startGoogleConnect(targetOrigin)` → chama `authorizeAppUserOAuth` com:
  - `connectorId: "google"`
  - `responseMode: "web_message"`
  - `credentialsConfiguration.scopes`: `drive.file`, `documents`, `spreadsheets`, `userinfo.email`, `userinfo.profile`
- `salvarConexaoGoogle({ connectionId })` → busca e-mail via `callAsAppUser` em `/oauth2/v3/userinfo`, salva linha em `org_google_connections` para a org ativa do usuário, valida que ele é owner/admin.
- `desconectarGoogle()` → deleta linha (token revogation opcional).
- `criarEstruturaPastas()` → usa `callAsAppUser` com `connector_id: "google_drive"` para:
  1. Criar pasta raiz `Approva – {nome da OSC}` na raiz do Drive do cliente.
  2. Criar subpastas `Orçamentos`, `Cotações`, `Prestações`, `Documentos`.
  3. Persistir `drive_root_id/url` + `subpastas` na tabela.
- `getMinhaConexaoGoogle()` → leitura para a UI do wizard.

## Etapa 4 — Substituir helpers antigos

`src/lib/setup-wizard.functions.ts` hoje usa o conector **workspace-scoped** (`GOOGLE_DRIVE_API_KEY` direto). Vou:
- Manter o arquivo para retrocompatibilidade temporária, mas os novos fluxos passam por `callAsAppUser` com a `connection_id` do cliente.
- Onde quer que outras server fns acessem Drive/Docs/Sheets em nome da org (ex.: `prestacao.functions.ts`, `cotacoes.functions.ts`, `orcamentos.functions.ts`), criar helper `callGoogleAsOrg(orgId, connector, path, init)` que busca a `connection_id` da org no banco e chama `callAsAppUser`. Erro claro se a org ainda não conectou.

(Migração completa de todos os call-sites é trabalho derivado — nesta entrega, troco apenas o wizard + deixo o helper pronto + ajusto os 2-3 call-sites mais críticos. Os demais ficam com erro guiado "Conecte o Google Drive em /admin/setup" até a rodada seguinte.)

## Etapa 5 — Wizard novo (`src/routes/admin.setup.tsx`)

Reescrever do zero (mais simples que o atual):

1. **Step 1 — Conectar Google** — botão único "Conectar minha conta Google". Usa `connectAppUser` (popup). Ao retornar, salva `connectionId` + e-mail.
2. **Step 2 — Confirmar conta** — mostra o e-mail conectado, oferece "Trocar conta".
3. **Step 3 — Criar estrutura** — botão "Criar pastas no meu Drive". Mostra progresso e abre o link da pasta raiz ao terminar. Idempotente (se já criou, mostra o que existe + opção de "Criar novamente em outro lugar").
4. **Step 4 — Pronto!** — resumo + CTA "Ir para o painel".

Wizard antigo (validação manual de URLs) sai da árvore.

## Etapa 6 — Onde o user "vê" a conexão

- `admin/configuracoes` → seção nova "Integrações Google" com e-mail conectado, status, botão "Desconectar/Reconectar".
- `PlanoGuard` continua igual.

## Detalhes técnicos

- Escopos solicitados: `https://www.googleapis.com/auth/drive.file` (acessa só o que o app cria — recomendado), `https://www.googleapis.com/auth/documents`, `https://www.googleapis.com/auth/spreadsheets`, `https://www.googleapis.com/auth/userinfo.email`, `https://www.googleapis.com/auth/userinfo.profile`.
- Por que `drive.file` e não `drive`: o cliente vê só "Permitir que Approva acesse arquivos que ele criar" — muito mais aceitável que "ver e gerenciar todos os arquivos do Drive". Suficiente porque criamos as pastas/arquivos nós mesmos.
- Popup-based flow (`responseMode: "web_message"`) é obrigatório para funcionar dentro do preview do Lovable e também é o padrão recomendado em produção.
- `connection_id` por org (não por usuário). Se a org tem múltiplos owners, todos compartilham a mesma conta Google conectada (faz sentido — a pasta é da OSC, não pessoal).

```text
Cliente              App                  Connector Gateway        Google
  |  click conectar    |                          |                    |
  |------------------->|  startGoogleConnect()    |                    |
  |                    |------------------------->|                    |
  |                    |    authorizationUrl      |                    |
  |                    |<-------------------------|                    |
  |  popup abre        |                          |                    |
  |--------------------+-------------------------------------->consent |
  |                    |                          |<-------------------|
  |  postMessage       |                          |                    |
  |<-------------------+------ connection_id -----|                    |
  |                    |  salvarConexaoGoogle()   |                    |
  |                    |------> insere linha em org_google_connections |
  |                    |  criarEstruturaPastas()  |                    |
  |                    |---- callAsAppUser ------>| Drive API          |
  |                    |   pastas criadas         |                    |
```

## Arquivos tocados (resumo)

**Novos**: `src/integrations/lovable/appUserConnector.ts`, `src/integrations/lovable/appUserConnectorClient.ts`, `src/lib/google-oauth.functions.ts`, `src/lib/google-oauth.server.ts` (helper `callGoogleAsOrg`), migration nova.

**Reescritos**: `src/routes/admin.setup.tsx`.

**Editados**: `src/components/admin/AdminShell.tsx` (remove `<AdminTour />`), `src/components/admin/sidebar.tsx` (remove botão de tour se houver), `src/routes/admin.configuracoes.index.tsx` (nova seção Integrações Google), `package.json` (remove `react-joyride`).

**Deletados**: `src/components/tour/AdminTour.tsx`.

## Fora do escopo desta rodada

- Migrar todas as server fns existentes (prestação, cotações, orçamentos, modelos) do conector workspace para o per-user — feito incrementalmente; nesta entrega só o wizard e 2-3 pontos críticos. Resto mostra mensagem clara.
- Refresh-token rotation / revogação manual (gateway já cuida).
- UI para múltiplas contas Google por org.

## Pergunta antes de executar

Confirma que posso pedir o secret `GOOGLE_APP_USER_CONNECTOR_CLIENT_ID` quando entrarmos em build mode? Sem ele o fluxo OAuth não inicia.