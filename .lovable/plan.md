## Visão geral

Quatro frentes, todas viáveis em sequência:

1. **Publicar o post isca** no site, com download direto da planilha e captação leve de lead.
2. **Tornar o post encontrável** (SEO técnico + cadastros nas ferramentas certas — eu listo os links, você executa o cadastro).
3. **Transformar o painel `/admin` em SaaS multi-tenant** (cada OSC/escritório vê só os próprios dados) + criar um painel `/owner` só seu (Leonardo) para acompanhar todos os clientes, dar suporte, configurar planos. **Sem Stripe agora** — apenas marcação manual de plano/status.
4. **Higienização pré-clientes-teste**: lista do que precisa ser corrigido, melhorado e otimizado antes do primeiro acesso real.

Landing pages (`/`, `/contadores`, `/gestores`, `/demonstracao`, `/ferramenta`, `/orcamentos`, `/privacidade`, `/termos`) e blog **continuam públicos** e fora do SaaS.

---

## 1) Publicar o post isca

**Estrutura nova:**

```
src/routes/blog.index.tsx                       → /blog (lista)
src/routes/blog.painel-scfv-tcepr.tsx           → /blog/painel-scfv-tcepr
src/routes/api/public/download.painel-scfv.ts   → /api/public/download/painel-scfv
                                                   (registra lead leve + redireciona p/ Storage)
```

**O que cada rota faz:**

- `/blog/painel-scfv-tcepr`: post em React (conteúdo do `post-blog-dor-scfv.md` já elaborado), com `head()` SEO completo (title, description, og:title/description/image, JSON-LD `BlogPosting`), formulário de 2 campos (email + nome da OSC) que ao enviar libera o link de download.
- Planilha `painel-scfv-tcepr-synsit.xlsx` vai para o bucket `documentos` (privado) → URL assinada gerada por server function quando o lead se cadastra.
- Lead salvo na tabela `leads` (já existe), com `origem_descoberta = "blog-painel-scfv"`.
- `/blog` lista posts (por enquanto, só este).
- Adicionar entrada no `sitemap.xml` (rota `sitemap[.]xml.ts` já existe — só incluir a URL nova).
- Adicionar link "Blog" no `SiteHeader` e `SiteFooter`.

---

## 2) Tornar o site encontrável (SEO + ferramentas)

**O que eu faço no código:**

- Verificar e completar `robots.txt`, `sitemap.xml`, JSON-LD `Organization` em `__root.tsx`, e `BlogPosting` no post.
- Adicionar `<link rel="canonical">` por rota.
- Acionar uma **revisão SEO automática** (`seo--trigger_scan`) ao final, para listar pendências e corrigir.

**O que VOCÊ precisa fazer (eu te mando o passo a passo com links após a publicação):**


| Ferramenta                   | Para quê                                                      | Link de cadastro                           |
| ---------------------------- | ------------------------------------------------------------- | ------------------------------------------ |
| **Google Search Console**    | Indexar no Google, ver quais buscas trazem visitas            | `https://search.google.com/search-console` |
| **Google Analytics 4 (GA4)** | Métrica de tráfego oficial (complementa seu /admin/analytics) | `https://analytics.google.com/`            |
| **Bing Webmaster Tools**     | Indexar no Bing/ChatGPT-search/DuckDuckGo                     | `https://www.bing.com/webmasters`          |
| **Google Business Profile**  | Aparecer no mapa/buscas locais "SCFV Medianeira"              | `https://www.google.com/business/`         |
| **IndexNow** (Bing)          | Notificar buscadores instantaneamente quando publicar         | configurado via Bing Webmaster             |


Eu te mando os passos detalhados pt-BR (menus, botões) **depois** que o post estiver publicado, porque alguns cadastros pedem verificar a URL ativa.

> **Sobre "já estou aparecendo?"**: respondo em uma seção curta no chat depois da publicação, usando `semrush--domain_analysis` no `synsit.lovable.app` — assim você vê dados reais de tráfego/indexação, não chute.

---

## 3) Transformar `/admin` em SaaS multi-tenant + painel `/owner`

### 3.1 Arquitetura

Hoje o sistema é **single-tenant**: todas as tabelas (`cotacoes`, `fornecedores`, `eventos_financeiros`, `prestacoes_snapshot`, etc.) têm RLS `USING (true)` — qualquer usuário autenticado vê tudo. Para SaaS, precisamos isolar por **organização (OSC ou escritório)**.

**Novas tabelas:**

```
organizations            (id, nome, cnpj, tipo: 'osc'|'escritorio', plano, status, trial_ate, criado_em)
organization_members     (organization_id, user_id, role: 'owner'|'admin'|'membro', criado_em)
app_role                 ENUM ('super_admin', 'org_owner', 'org_admin', 'org_member')
user_roles               (user_id, role)  — para super_admin (você)
support_tickets          (id, organization_id, criado_por, assunto, mensagem, status, criado_em)
audit_log                (id, organization_id, user_id, acao, payload, criado_em)
```

**Coluna `organization_id` (UUID) adicionada em todas as tabelas operacionais existentes**:
`cotacoes`, `convites_cotacao`, `cotacao_presets`, `orcamentos_salvos`, `orcamento_presets`, `objetos_cotacao`, `fornecedores`, `eventos_agenda`, `eventos_financeiros`, `documentos_anexos`, `extracoes_salvas`, `modelos_planilha`, `prestacoes_snapshot`, `prestacao_documentos`, `configuracoes`.

**RLS reescrita** com função `SECURITY DEFINER`:

- `public.user_orgs(user_id)` → retorna `organization_id[]` do usuário.
- `public.has_role(user_id, role)` → para super_admin.
- Todas as tabelas: `USING (organization_id = ANY (public.user_orgs(auth.uid())) OR public.has_role(auth.uid(), 'super_admin'))`.

**Storage** (`documentos`, `prestacoes`): paths prefixados com `{organization_id}/...` e policy igual.

### 3.2 Fluxo de onboarding (cliente teste fechado)

```
1. Você (super_admin) acessa /owner/clientes → "Convidar OSC"
2. Preenche: nome OSC, CNPJ, email do responsável, plano, trial até DD/MM
3. Sistema cria organization + envia magic-link via Supabase Auth
4. Responsável aceita → vira org_owner da organization
5. Responsável pode convidar mais membros em /admin/configuracoes/equipe
```

### 3.3 Painel `/owner` (só seu)

```
/owner                  → dashboard: receita projetada, clientes ativos, em trial, churn
/owner/clientes         → lista todas as OSCs, status, plano, último acesso, MRR
/owner/clientes/$id     → drill-down: uso, lançamentos/mês, último login, prestações geradas
/owner/clientes/$id/impersonate  → "entrar como" (com banner vermelho persistente)
/owner/suporte          → tickets de todas as orgs, responder por aqui
/owner/financeiro       → MRR, pagamentos manuais (campo "marcar como pago"), trials vencendo
/owner/planos           → CRUD dos planos (limites de lançamentos, usuários, OSCs)
/owner/feature-flags    → ligar/desligar features por org
```

Acesso protegido por `_owner` layout que checa `has_role(auth.uid(), 'super_admin')`.

### 3.4 Ajustes no `/admin` existente

- Adicionar **seletor de OSC ativa** no topo (relevante para escritórios contábeis com múltiplas OSCs).
- Página nova `/admin/configuracoes/equipe` (convidar membros, alterar role).
- Página nova `/admin/configuracoes/organizacao` (dados da OSC, plano atual, uso vs. limite).
- Substituir o `useAuth` atual pelo padrão TanStack recomendado (`_authenticated` layout com `beforeLoad` + context) — corrige o "flash de conteúdo" antes do redirect.
- Limites do plano aplicados em server functions (ex: criar lançamento checa se `count(mês) < plano.limite_lancamentos`).

### 3.5 Stripe — adiado

Marcado no plano de planos com `cobranca_externa = true` e `status = 'manual'`. Estrutura pronta para plugar depois (campo `stripe_customer_id` já existe na `organizations`, `stripe_subscription_id` no plano).

---

## 4) Higienização pré-clientes-teste

Lista do que vou auditar e corrigir antes de liberar:

**Segurança (crítico):**

- Rodar `security--run_security_scan` e corrigir tudo que sair.
- Conferir RLS de todas as tabelas após a migração multi-tenant.
- Conferir que `supabaseAdmin` não vaza para o client (a chave de serviço é apenas server-side).
- Habilitar HIBP (proteção contra senhas vazadas) no Auth.

**Auth/UX:**

- Substituir `useAuth + useEffect + nav` por `_authenticated` layout route (sem flash).
- Página de "esqueci minha senha".
- Confirmação por email **obrigatória** (não auto-confirm).
- Google sign-in (você pediu antes — adiciono `supabase--configure_social_auth` providers: ["google"]).

**Funcional / correções:**

- Revisar todas as `server functions` em `src/lib/*.functions.ts` para passarem a filtrar por `organization_id` (não confiar só em RLS — defesa em profundidade).
- Validar que upload no Storage usa prefixo `{organization_id}/`.
- Testar fluxo completo: convidar → onboarding → criar fornecedor → lançamento → gerar SIT.
- Adicionar empty states amigáveis em todas as listas (`/admin/fornecedores`, `/admin/orcamentos`, etc.) — hoje quem entra em uma conta vazia vê tabela em branco.
- Loading skeletons em todas as queries pesadas.
- Mensagens de erro humanas (não jogar erro técnico na tela).

**Performance/SEO/PWA:**

- Lazy-load de rotas pesadas (`/admin/captura`, `/admin/prestacao`).
- Pré-carregar fonte e imagem hero do `/`.
- Resolver findings do `seo--list_findings` que sobrarem.

**Higiene de código:**

- Remover route `/ferramenta` se não for mais usada, ou esconder do menu.
- Documentar variáveis de ambiente em um README curto (`docs/setup.md`).
- Sanity-check de console errors no preview.

---

## Estratégia de entrega (3 PRs lógicos)

**PR 1 — Post isca + SEO (rápido, ~1 build):**

- Rotas `/blog` e `/blog/painel-scfv-tcepr`.
- Endpoint `/api/public/download/painel-scfv`.
- Upload da planilha para o Storage.
- Atualização de `sitemap.xml`, `robots.txt`, `__root.tsx` JSON-LD.
- Link "Blog" no header/footer.
- Scan SEO + correção de pendências.
- **Eu te entrego os links de cadastro GA4/Search Console/Bing/Business depois desse PR ir ao ar.**

**PR 2 — Multi-tenant + RLS (a parte densa):**

- Migração: novas tabelas, ENUMs, `organization_id` em tabelas existentes, RLS reescrita, função `has_role`.
- `_authenticated` layout corrigindo o flash.
- Seletor de OSC ativa no `/admin`.
- `/admin/configuracoes/equipe` e `/configuracoes/organizacao`.
- Adaptação das server functions para escopar por `organization_id`.

**PR 3 — Painel `/owner` + higienização:**

- Layout `_owner` com guard `super_admin`.
- Páginas: clientes, suporte, financeiro manual, planos, feature-flags, impersonate.
- Empty states, loading skeletons, mensagens de erro humanas.
- Google sign-in + HIBP + esqueci-senha.
- Security scan final + correções.

---

## Decisões que preciso confirmar antes de começar

1. **Modelo de organização**: uma OSC = uma `organization`. Um **escritório contábil** que atende N OSCs é uma `organization` do tipo `escritorio` que tem N `organizations` filhas (`parent_organization_id`) — você concorda com essa hierarquia, ou prefere que o escritório só seja "membro" das organizations das OSCs clientes? -> Quero que o escritorio contabil possa gerenciar N organizations. Bem como tive a ideia agora de os proprios escritorios poderem utilizar a ferramenta e captar suas OSCS clientes: faca um plano com metricas financeiras.
2. **Trial padrão**: 30 dias (como já está nas landing pages) — confirma? - trial padrao de 30 dias via requisicao. 
3. **Seu email de `super_admin**`: confirmo `l7hmarque@gmail.com` (já está hard-coded como destino de notificações de lead) — esse vira o primeiro `super_admin` na migração? Sim.
4. **"Impersonate"** (entrar como cliente para dar suporte): topa? É a forma mais rápida de resolver dúvidas, mas alguns clientes acham invasivo. Alternativa: modo "somente leitura" da org do cliente, sem editar nada. topo! 

Responde essas 4 e eu mando o PR 1 já implementado, com o post no ar e o passo-a-passo dos cadastros (Search Console, GA4, Bing, Business) com prints dos menus pt-BR.