# Plano: Drive multi-tenant com conta master única

## Contexto da sua escolha

- **Conta master**: Gmail comum (a que já está conectada como `google_drive` no connector do Leonardo). Não há "Shared Drive" — tudo fica no "Meu Drive" dessa conta.
- **Acesso dos clientes**: 100% dentro do Approva. Cliente não loga no Google, não enxerga a pasta no Drive dele, não recebe e-mail de compartilhamento. O Approva é o front; o Drive é só storage.
- **Multi-tenant hoje**: já está pronto. Existem as tabelas `organizations` + `organization_members` (+ `parent_organization_id` para escritório → clientes). Hoje só há 1 OSC cadastrada ("CAIA Medianeira"), mas o modelo já suporta N.

## Como o Approva fica multi-tenant no Drive

```text
Drive da conta master (Leonardo)
└── Approva/
    ├── org-7dd6.../              ← CAIA Medianeira (id da organization)
    │   ├── Orçamentos/
    │   ├── Cotações/
    │   ├── Prestações/
    │   └── Documentos/
    ├── org-abcd.../              ← próxima OSC
    │   └── ...
    └── _internal/                 ← templates compartilhados (já existem)
```

**Isolamento**: cada server function que cria/lista arquivos descobre a `organization_id` atual do usuário (via `current_user_org()` que já existe), resolve o `root_folder_id` daquela OSC e força `parents: [folderIdDaOrg]`. Cliente da OSC A nunca recebe um `fileId` da OSC B porque o backend só lista o que está dentro da pasta da OSC dele. RLS do Supabase já bloqueia ler `organization_id` de outro tenant.

## O que muda no código

### 1. Remover fluxo OAuth por usuário (caminho abandonado)

- Excluir `src/lib/google-oauth.functions.ts` (start/save/get/disconnect/setupDriveStructure).
- Excluir `src/integrations/lovable/appUserConnector*.ts` se não tiver outro uso.
- Excluir os secrets `GOOGLE_APP_USER_CONNECTOR_CLIENT_ID` e `..._SECRET`.
- Migration: `drop table public.google_connections`.
- Remover botão "Conectar Google Drive" da tela de configurações/wizard e qualquer rota que dependa dele.

### 2. Nova tabela `organization_drive_folders`

```sql
create table public.organization_drive_folders (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  root_folder_id text not null,
  subfolders jsonb not null default '{}'::jsonb,  -- {"Orçamentos":"id","Cotações":"id",...}
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);
-- + GRANTs, RLS (select para membros da org via has_role/user_orgs), trigger touch
```

### 3. Helper `ensureOrgFolders(orgId)` em `src/lib/drive-org.server.ts`

Idempotente. Se a row existir, devolve. Se não:

- procura/cria `Approva/` no root da conta master;
- procura/cria subpasta `{orgId}` dentro de `Approva/`;
- cria as 4 subpastas padrão;
- grava em `organization_drive_folders` e retorna os ids.

Chamado on-demand pela primeira ação que precisar (gerar orçamento, subir documento, etc). Sem wizard.

### 4. Adaptar geradores existentes

- `src/lib/orcamentos.server.ts` e `src/lib/cotacoes.server.ts`: trocar `ensureFolderPath(["Orcamentos SIT", mesRef])` por `ensureOrgFolders(orgId).subfolders["Orçamentos"]` ou `["Cotações"]`. Mês vira subpasta filha dessa: `Orçamentos/{AAAA-MM}/`.
- Toda chamada que hoje usa `parents: undefined` passa a usar a pasta da org. Garante isolamento mesmo se um bug listar do Drive — não há nada "solto" no root.

### 5. Visualização dos arquivos dentro do Approva

Novo módulo `/admin/arquivos` (e seções equivalentes em Orçamentos/Cotações/Prestações):

- Server function `listarArquivosDaOrg({ subpasta?, mes? })` → chama `GET /drive/v3/files?q='{folderId}' in parents and trashed=false`.
- Server route público autenticado `/api/files/$id/preview` que faz proxy do `GET /drive/v3/files/{id}?alt=media` (ou `export?mimeType=application/pdf` para Google Docs/Sheets) usando a connection key da conta master. Verifica primeiro que o `fileId` pertence a uma pasta da org do usuário antes de devolver bytes.
- UI: lista com nome/tipo/data + preview embedado (iframe servindo o proxy, ou `<embed>` para PDF).

Cliente nunca recebe `webViewLink` direto do Drive → não há vazamento de URL pública.

### 6. Aviso de quota

Banner em Configurações: "Storage: X de 15 GB usados". Server function chama `GET /drive/v3/about?fields=storageQuota`. Se passar de 12 GB, alerta. Documentar que upgrade para Workspace é recomendado quando passar de ~5 OSCs ativas.

## Riscos que você precisa saber

1. **Quota 15 GB é compartilhada com o Gmail/Fotos do Leonardo.** Recomendo dedicar uma conta Google nova só para o Approva (`approva.storage@gmail.com`) e reconectar o connector com ela. Faço a troca como primeira etapa se você concordar.
2. **Conta master é ponto único de falha.** Se a senha for comprometida, todos os clientes vazam. Ativar 2FA obrigatório e nunca usar essa conta para mais nada.
3. **Sem audit trail do Google por cliente.** O Drive vê tudo como "Leonardo modificou". O audit por cliente fica só no `audit_log` do Supabase — já existe a tabela, vamos passar a gravar nela toda ação de arquivo.
4. **Limite de 750 GB/dia de upload** por conta (Google). Improvável atingir, mas existe.
5. `**drive.file` scope vs `drive` scope**: o connector atual usa `drive.file` (só vê o que ele mesmo criou). Isso é bom para isolamento, mas se algum dia precisar enxergar arquivos pré-existentes no Drive, precisa reconectar com escopo `drive`.

## Ordem de implementação

1. (Opcional, recomendado) Você cria conta Google nova dedicada → me avisa → reconecto o connector `google_drive` com ela.
2. Migration: tabela `organization_drive_folders` + drop `google_connections`.
3. Helper `drive-org.server.ts` + `ensureOrgFolders`.
4. Refatorar `orcamentos.server.ts` / `cotacoes.server.ts` para usar pasta da org.
5. Remover código OAuth por usuário e secrets.
6. Módulo `/admin/arquivos` + server route de proxy.
7. Banner de quota.

## Decisões pendentes antes de implementar

- (a) Usa conta Google nova dedicada ou mantém o Gmail atual do Leonardo? Mantem por enquanto
- (b) Subpastas por mês dentro de Orçamentos/Cotações/Prestações (recomendado) ou tudo direto na raiz da seção? Subpastas
- (c) Quer já implementar o módulo `/admin/arquivos` com preview no app nesta leva, ou só a parte de isolamento + geração (mais rápido) e o visualizador fica em uma segunda etapa? Implementa ja