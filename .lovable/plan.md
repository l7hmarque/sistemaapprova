# Plano: Documento técnico Approva → Manus

## Entrega
Um único arquivo **`MANUS.md`** (PT-BR, ~15-25 páginas), gerado em `/mnt/documents/MANUS.md` para download direto no chat. Nenhum arquivo do projeto será alterado.

## Método de construção
1. Coletar dados reais via `supabase--read_query` (colunas, policies, foreign keys de todas as 26 tabelas) e leitura direta dos arquivos-chave (`*.functions.ts`, `*.server.ts`, rotas admin/owner, hooks de auth/org, integrações Supabase e Drive).
2. Cruzar com o `.lovable/plan.md` já existente (diagnóstico) para consistência.
3. Escrever o `.md` incluindo IDs internos (project ref Supabase, template IDs do Drive, nomes de secrets, gateway URLs) conforme autorizado.

## Estrutura do MANUS.md

1. **Contexto e propósito**
   - O que é o Approva, público-alvo (OSCs SCFV e escritórios contábeis do TCE-PR), problema resolvido (prestação de contas SIT-TCE/PR), proposta de valor.

2. **Stack e arquitetura de alto nível**
   - TanStack Start v1 + React 19 + Vite 7 em Cloudflare Workers
   - Supabase (Lovable Cloud): Auth, Postgres, Storage (`documentos`, `prestacoes`), RLS
   - Google Drive/Sheets via connector gateway (master account multi-tenant)
   - Resend para e-mails, Lovable AI Gateway para extração
   - Diagrama textual: browser ↔ serverFn ↔ Supabase / Drive gateway / AI gateway

3. **Mapa de rotas (função por função)**
   - Marketing público: `/`, `/contadores`, `/gestores`, `/demonstracao`, `/ferramenta`, `/orcamentos`, `/blog/*`, `/cotacao/$token`, `/convite/$token`, `/privacidade`, `/termos`, `/obrigado`, `/login`, `/esqueci-senha`, `/atualizar-senha`
   - Admin (`/admin/*`): dashboard, captura, painel, fornecedores, objetos, modelos, orçamentos, prestação, aprovações, agenda, arquivos, analytics, configurações (organização/equipe), setup wizard
   - Owner (`/owner/*`): visão geral, clientes, suporte, financeiro
   - APIs: `/api/extract`, `/api/files/$id/preview`, `/api/public/cotacao/$token[.pdf]`, `sitemap.xml`
   - Para cada rota: objetivo, quem acessa, principais serverFns consumidas.

4. **Fluxos de usuário detalhados (passo a passo)**
   - Onboarding OSC (signup → trigger `handle_new_user` cria org+owner → setup wizard Drive)
   - Ciclo mensal completo (captura → painel → validação SIT → export `Despesa.txt` Win-1252 → fechar mês → snapshot)
   - Fluxo Escritório contábil (OrgSwitcher, orgs-filhas via `parent_organization_id`)
   - Fluxo Cotação (criar cotação → convidar fornecedor por token público → fornecedor preenche → mapa comparativo em Google Sheets)
   - Convites de membro (token → e-mail Resend → aceite)
   - Recuperação de senha

5. **Modelo de dados (26 tabelas)**
   - Para cada tabela: propósito, colunas de domínio, FKs, índices relevantes, relacionamento com outras
   - Agrupadas por domínio:
     - Multi-tenant: `organizations`, `organization_members`, `user_roles`, `convites_membro`, `organization_drive_folders`
     - Financeiro/SIT: `eventos_financeiros`, `favorecidos_padrao`, `fornecedores`, `configuracoes`
     - Documentos: `documentos_anexos`, `prestacao_documentos`, `prestacoes_snapshot`
     - Cotações/Orçamentos: `cotacoes`, `convites_cotacao`, `objetos_cotacao`, `cotacao_presets`, `orcamentos_salvos`, `orcamento_presets`, `modelos_planilha`, `extracoes_salvas`
     - Agenda/CRM: `eventos_agenda`, `eventos_visita`, `leads`, `leads_rate_limit`, `support_tickets`
     - Auditoria: `audit_log`
   - Diagrama ER textual mostrando fluxo `organizations → organization_members → user_id (auth.users)` e cascatas por `organization_id`.

6. **RLS: arquitetura de policies**
   - Funções SECURITY DEFINER: `user_orgs(_user_id)`, `is_org_owner`, `current_user_org()`, `has_role(_user_id,_role)` — código completo e quando usar cada uma
   - Padrão de policy por tabela (SELECT/INSERT/UPDATE/DELETE via `organization_id IN (SELECT user_orgs(auth.uid()))`)
   - Casos especiais: `leads` (INSERT anon com rate limit), `convites_membro`/`convites_cotacao` (leitura por token), `user_roles` (só leitura própria + super_admin)
   - Regra de GRANTs (authenticated + service_role; anon apenas nos casos explícitos)
   - Trigger `handle_new_user` (auto-cria org + membership owner no signup)
   - Trigger `validar_evento_financeiro` (regras de valor/data/mes_referencia)

7. **Server Functions & integrações**
   - Padrão `createServerFn().middleware([requireSupabaseAuth]).inputValidator().handler()`
   - Middleware de bearer em `src/start.ts`
   - Inventário resumido de cada `*.functions.ts` (captura, comprovantes, prestação, cotações, orçamentos, convites, arquivos, fornecedores, objetos, analytics, leads, blog-leads, email, setup-wizard)
   - Módulos `.server.ts` (Drive/Sheets gateway, email templates, drive-org multi-tenant)
   - Pipeline de extração (`src/lib/extract/*`, parsers NF-e/boleto/guia, `pdfText`, schema, catálogos SIT)
   - Formatador SIT (`formatLinha`, `ansiEncode` Win-1252, `cnpjValidator`, `inferCaptura`, `regrasHolerite`)

8. **Modelo SaaS e operação pelo dono**
   - Área `/owner` (super_admin via `user_roles`): listar clientes, ver detalhes, suporte (tickets), financeiro (visão geral de planos)
   - Cobrança: **manual** no MVP (boleto/PIX fora do app); campos `plano`, `status`, `trial_ate`, `PlanoGuard`
   - Lançamento beta: **convites manuais** — owner cria orgs no `/owner/clientes`
   - Suporte: `support_tickets` (usuário abre no admin, owner responde em `/owner/suporte`)
   - Analytics interno (`analytics.functions.ts`, marcação `synsit_interno` no localStorage para excluir tráfego staff)
   - Multi-tenant Drive: uma conta master Google, cada org tem subpasta `Approva/<org>/` provisionada pelo setup wizard

9. **Segurança e limites conhecidos**
   - Secrets em `process.env` (server-only): `SUPABASE_*`, `RESEND_API_KEY`, `LOVABLE_API_KEY`, `GOOGLE_*_API_KEY`
   - Nunca expor `SUPABASE_SERVICE_ROLE_KEY` ao browser; uso restrito a `client.server.ts`
   - Riscos conhecidos e mitigações (referencia o `.lovable/plan.md`): `current_user_org()` fallback vs `activeOrgId`, "fechar mês" sem trava, audit_log subutilizado, captura sem fila de erro
   - Rate limit em `leads` via `leads_rate_limit`

10. **Como a Manus deve operar neste projeto**
    - Nunca chamar Supabase Edge Functions para lógica interna (usar `createServerFn`)
    - Passar sempre `activeOrgId` do front em vez de confiar em `current_user_org()`
    - Não editar `src/integrations/supabase/*` (auto-gerados) nem `routeTree.gen.ts`
    - Migrations sempre com bloco GRANT + ENABLE RLS + POLICY
    - Fluxo de sign-in Google via `lovable.auth.signInWithOAuth`
    - Placeholders/IDs relevantes: project ref `afikxcuergsyygytmgub`, templates Drive `TEMPLATE_ORCAMENTO_ID`, `TEMPLATE_MAPA_ID`

11. **Apêndices**
    - A. Enum `app_role` e roles atuais (`owner`, `admin`, `membro`, `super_admin`)
    - B. Categorias SIT (`CATEGORIAS_REO`) e mapeamento
    - C. Layout do `Despesa.txt` (encoding Win-1252, colunas, regras de CNPJ/CPF)
    - D. Lista completa de secrets configurados
    - E. Referências: `.lovable/plan.md`, rotas principais, arquivos-chave

## Detalhes técnicos de execução
- Passo 1: `supabase--read_query` para (a) `information_schema.columns` das 26 tabelas, (b) `pg_policies` (nome, cmd, roles, using/with_check), (c) `pg_indexes`, (d) FKs via `information_schema.table_constraints`
- Passo 2: leitura em paralelo de `src/lib/*.functions.ts`, `src/lib/*.server.ts`, `src/lib/sit/*`, `src/lib/extract/*`, rotas `/admin`, `/owner`, `/api`
- Passo 3: montar `/mnt/documents/MANUS.md` com todo o conteúdo acima
- Passo 4: informar o link de download ao usuário

## Fora do escopo
- Nenhuma alteração de código, migration ou configuração do projeto
- Nenhum novo secret, connector ou dependência
- Não implementa nada do roadmap A-E — apenas documenta o estado atual