## Diagnóstico

O erro acontece no início do OAuth, antes de abrir o consentimento do Google:

```text
App User OAuth start failed (404): {"type":"app-user connector client_not_found"}
```

No código atual, a função `startGoogleDriveOAuth` envia apenas `GOOGLE_APP_USER_CONNECTOR_CLIENT_ID` para a gateway. O projeto já tem estes secrets salvos:

- `GOOGLE_APP_USER_CONNECTOR_CLIENT_ID`
- `GOOGLE_APP_USER_CONNECTOR_CLIENT_SECRET`

Mas o helper `authorizeAppUserOAuth` não está enviando o `client_secret` no payload. Por isso a gateway não consegue encontrar/validar o cliente OAuth app-user e retorna `client_not_found`.

## Plano de correção

1. **Atualizar o helper App User OAuth**
   - Adicionar suporte opcional a `connectorClientSecret` em `src/integrations/lovable/appUserConnector.ts`.
   - Enviar `connector_client_secret` no corpo da chamada para `/api/v1/app-users/oauth2/authorize` quando disponível.

2. **Ler o secret no server function**
   - Em `src/lib/google-oauth.functions.ts`, criar uma função `requireClientSecret()` lendo `process.env.GOOGLE_APP_USER_CONNECTOR_CLIENT_SECRET`.
   - Passar esse valor junto com o Client ID ao chamar `authorizeAppUserOAuth`.
   - Melhorar a mensagem de erro caso Client ID ou Client Secret estejam ausentes.

3. **Preservar o fluxo atual do wizard**
   - Manter popup `web_message`.
   - Manter os scopes atuais de Drive, Docs, Sheets e userinfo.
   - Manter o salvamento do `connectionAPIKey` por organização em `google_connections`.

4. **Validar depois da implementação**
   - Verificar que os secrets existem, sem expor valores.
   - Conferir que não há import server-only em componente cliente.
   - Reiniciar/validar o preview se necessário e orientar novo teste no botão “Conectar Google Drive”.

## Observação externa obrigatória

Além do código, o OAuth Client no Google Cloud precisa ter o redirect URI:

```text
https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/callback
```

Se isso não estiver no Google Cloud, o erro seguinte pode mudar para `redirect_uri_mismatch`.