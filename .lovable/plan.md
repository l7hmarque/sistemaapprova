
# Rodar só com SEO + monitoramento próprio (sem tráfego pago)

Sim, dá pra deixar tudo no ar sem GTM, sem Meta Pixel e sem LinkedIn. As tags só são úteis quando há **anúncio pago** rodando (pra otimização de campanha e remarketing). Sem ads, você não perde nada relevante removendo/desligando.

A estratégia é trocar pixels de terceiros por **telemetria 1st-party** (dados que ficam no seu próprio banco). Isso tem 3 vantagens:
1. Funciona mesmo com bloqueador de anúncios
2. Não precisa de banner de cookies (LGPD fica trivial)
3. Os dados são seus, não do Google/Meta

---

## O que entra no lugar dos pixels

### 1. Google Search Console (gratuito, indispensável)
- Mostra **quais buscas trouxeram visita** ("contabilidade terceiro setor", "prestação contas TCE-PR", etc.), posição média, CTR e impressões.
- É a única forma de saber **se o SEO está funcionando**.
- Setup: verificação por meta tag (a gente já tem o mecanismo no `__root.tsx`) + envio do `sitemap.xml`.

### 2. Sitemap.xml + robots.txt
- Hoje o projeto **não tem** `sitemap.xml` nem `robots.txt`. Sem isso, o Google demora muito mais pra indexar `/contadores`, `/gestores`, etc.
- Criar `src/routes/sitemap[.]xml.ts` listando: `/`, `/contadores`, `/gestores`, `/demonstracao`, `/termos`, `/privacidade`.
- Criar `public/robots.txt` permitindo crawl e apontando pro sitemap. **Bloquear** `/admin`, `/login`, `/obrigado`.

### 3. Telemetria própria (tabela `eventos_visita`)
Tabela nova no banco que registra, sem cookies de terceiros:
- **page_view**: rota, referrer, UTM (se vier), user-agent reduzido, país (via header do Cloudflare), timestamp, session_id (cookie 1st-party httpOnly)
- **cta_click**: qual botão (`plano-essencial`, `plano-profissional`, `demo-hero`, etc.)
- **scroll_depth**: 25/50/75/100% — mostra se a página engaja
- **form_start**: usuário começou a digitar no formulário
- **form_submit**: lead criado (já temos via `leads`)
- **time_on_page**: tempo até sair

Implementação: um `serverFn` `registrarEvento` chamado por um hook leve no client. Sem libs externas.

### 4. Painel admin `/admin/analytics`
Página simples lendo da tabela:
- Visitas/dia por rota (gráfico de linha)
- Top referrers (Google, direto, LinkedIn orgânico…)
- Funil: visita → scroll 50% → CTA clicado → form iniciado → lead enviado
- Taxa de conversão por landing (`/contadores` vs `/gestores`)
- Origem dos leads (UTM/referrer)
- Tempo médio até conversão

### 5. SEO on-page das landings (já temos parcialmente)
Revisar cada rota e garantir:
- `<title>` único e com keyword (ex: "Software de prestação de contas para OSC — SynSIT")
- `meta description` específica
- H1 único por página
- JSON-LD `Organization` no root + `Service` em `/contadores` e `/gestores` + `FAQPage` nas FAQs
- `og:image` específica de cada landing (gerar 2 imagens 1200x630)
- Canonical em cada rota

---

## O que você vai conseguir monitorar

| Pergunta de negócio | Onde responder |
|---|---|
| Quantas pessoas visitam por dia? | `/admin/analytics` |
| Qual landing converte mais (contadores vs gestores)? | `/admin/analytics` (funil) |
| Que palavras-chave trazem gente? | Google Search Console |
| Os visitantes leem a página ou saem rápido? | scroll_depth + time_on_page |
| Qual plano chama mais atenção? | cta_click por `plano-*` |
| Quem abandonou o formulário? | form_start sem form_submit |
| De onde vêm os leads? | referrer + UTM no `leads` |

---

## O que NÃO funciona sem pixel pago
- Remarketing (impactar visitante de novo no Instagram/LinkedIn) — só com Meta/LinkedIn Pixel
- Otimização automática de campanha — só com GTM + GA4 ligados aos ads
- "Audiências semelhantes" do Meta — precisa do Pixel

Nada disso importa enquanto você **não** está pagando por anúncio. No dia que ligar tráfego pago, é só você criar as contas (instrução já te passei) e adicionar os IDs como secrets — o código dos pixels já está condicionado a `if (GTM)`, então acende sozinho.

---

## Etapas de implementação

1. **Migration**: tabela `eventos_visita` (id, session_id, rota, evento, payload jsonb, referrer, utm_*, user_agent, country, created_at) + RLS (só admin lê; insert público anônimo).
2. **ServerFn** `registrarEvento` em `src/lib/analytics.functions.ts` (rate-limited por session_id).
3. **Hook** `useAnalytics` em `src/hooks/use-analytics.ts`: dispara page_view no mount, scroll_depth no scroll, registra cta_click via `data-track-cta` (atributo já existe nos botões!).
4. **Sitemap** `src/routes/sitemap[.]xml.ts` + **robots** `public/robots.txt`.
5. **SEO**: revisar `head()` de `/`, `/contadores`, `/gestores`, gerar 2 OG images (1200x630).
6. **JSON-LD**: Organization no root, Service nas landings, FAQPage nas FAQs.
7. **Painel** `src/routes/admin.analytics.tsx`: gráficos com `recharts` (já instalado, presumo) + tabela de leads enriquecida.
8. **Search Console**: rodar fluxo de verificação por meta tag pra `https://synsit.lovable.app` e submeter sitemap.

---

## Detalhes técnicos (você pode pular)

- `session_id` via cookie 1st-party `synsit_sid` (httpOnly, SameSite=Lax, 30 dias). Gerado server-side no primeiro request.
- País via header `cf-ipcountry` do Cloudflare Worker (zero custo, sem geo-IP lib).
- Anti-bot leve: ignorar user-agents com `bot|crawler|spider`.
- LGPD: como não há cookie de terceiros e o `session_id` é puramente técnico (não identifica pessoa), **não precisa de banner**. Só uma linha na `/privacidade` mencionando "registramos navegação anônima para melhorar o serviço".
- Custo: tudo dentro do Lovable Cloud, zero adicional.

Quer que eu siga com tudo isso, ou prefere começar só com **sitemap + Search Console + telemetria básica** e o painel `/admin/analytics` fica pra próxima rodada?
