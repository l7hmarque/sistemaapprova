
# Landing pages SynSIT + captação de leads + tráfego pago

Escopo grande mas coeso. Divido em 5 blocos. Tudo na mesma sessão se couber; se ficar pesado, paro depois do bloco 3 e sigo no próximo turno.

---

## Bloco 1 — Arquitetura de rotas e SEO

Hoje `/` é o admin. Vou **separar marketing de admin**:

```
/                      → home institucional (3RD TECH / SynSIT) — escolha de público
/contadores            → LP contadores e escritórios contábeis
/gestores              → LP gestores/coordenadores/financeiro de OSCs
/demonstracao          → formulário único, pré-preenche plano via ?plano=...
/obrigado              → confirmação pós-envio (página de conversão p/ pixels)
/termos                → Termos de Uso (cláusula anti-engenharia reversa)
/privacidade           → LGPD básica
/admin/*               → tudo que existe hoje, intocado
```

Cada rota com `head()` próprio: title <60, description <160, og:title, og:description, og:type, canonical no leaf, JSON-LD `Product` (planos) + `Organization` (raiz) + `FAQPage` nas LPs.

`sitemap.xml` e `robots.txt` atualizados — admin com `Disallow`.

---

## Bloco 2 — Identidade visual (eu escolho)

Como você deixou comigo, vou aplicar **dois "sotaques" sobre o mesmo design system**:

- **Tokens base** em `src/styles.css`: paleta **Navy Trust** (deep navy `#0f1b3d` + acentos `#3b6fa0` + bege quente `#f5f0e0`) — transmite confiança, compliance, terceiro setor.
- **Tipografia**: `Instrument Serif` (display, headlines) + `Inter` (body). Serif pesa "institucional/responsabilidade", sans mantém legibilidade SaaS.
- **LP contadores** (`/contadores`): tom mais sóbrio, denso em dados, tabelas, "ROI por OSC atendida". Hero com gráfico/calendário.
- **LP gestores** (`/gestores`): mesmo design system mas com mais respiro, fotos humanas, foco em "menos tempo com papelada, mais tempo com a causa". Hero com mockup de painel + depoimento.

Imagens hero geradas com imagegen (premium para hero, fast para ícones).

---

## Bloco 3 — Planos (estrutura híbrida que você aprovou)

| Plano | Preço | Para quem | O que inclui |
|---|---|---|---|
| **Essencial** | **R$ 497/mês** | OSC pequena, 1 entidade | até 100 lançamentos/mês, 2 usuários, exportação SIT, prestação mensal |
| **Profissional** | **R$ 897/mês** | OSC média ou contador com 1 cliente | até 500 lançamentos, 5 usuários, agenda fiscal, modelos personalizados, suporte prioritário |
| **Escritório** | **R$ 1.497/mês** | Escritórios contábeis, até 5 OSCs | lançamentos ilimitados, 15 usuários, multi-OSC, white-label leve, gestor de conta |

Preços terminados em 7 (psicologia de conversão B2B). Badge "Mais escolhido" no Profissional. CTA de cada plano leva a `/demonstracao?plano=profissional`.

Sem integração de pagamento. Cada plano oferece **30 dias de demonstração gratuita** (sem cartão).

---

## Bloco 4 — Formulário de demonstração + envio de lead

Página `/demonstracao` com formulário **curto e amigável** (Zod validation):

Campos obrigatórios:
- Nome
- Email
- Telefone (WhatsApp)
- Nome da OSC ou escritório
- Cargo
- Plano de interesse (radio, pré-selecionado via query)

Campos opcionais (collapse "Quer agilizar? Conta um pouco mais"):
- Quantas OSCs você atende? (só p/ contador)
- Quantos lançamentos por mês, aproximadamente?
- Principal dor hoje (textarea curto)
- Como conheceu? (select com "Google, Indicação, LinkedIn, Outro")

**UTMs capturadas automaticamente** (`utm_source/medium/campaign/term/content`) via search params, salvas junto do lead.

### Backend
- Tabela `leads` no Lovable Cloud (todos os campos + utms + user_agent + referrer + created_at). RLS: só service role escreve/lê.
- Server function `enviar-lead` (TanStack `createServerFn`, sem auth) que:
  1. Valida input com Zod (rate limit por IP via tabela `leads_rate_limit`).
  2. Insere na tabela `leads`.
  3. Dispara email para **l7hmarque@gmail.com** com assunto **`LEAD SynSIT — {nome} ({plano})`** via **Lovable Emails** (template React Email).
  4. Retorna `{ok: true}`.
- Redireciona para `/obrigado` que dispara evento de conversão nos pixels.

Email destino e assunto **nunca aparecem no HTML/JS do cliente** — só no servidor.

---

## Bloco 5 — Tráfego pago (você marcou os 4)

### 5a. Pixels + GTM
- **Google Tag Manager** container no `__root.tsx` (id como env var `VITE_GTM_ID`, vazio = desligado).
- **GA4** via GTM com eventos: `page_view`, `view_pricing`, `select_plan`, `scroll_75`, `cta_click`, `lead_submit` (conversão).
- **Meta Pixel** (`VITE_META_PIXEL_ID`) com `PageView`, `Lead`, `ViewContent`.
- **Google Ads conversion tag** (`VITE_GADS_ID` + `VITE_GADS_LABEL`) disparado em `/obrigado`.
- **LinkedIn Insight Tag** (`VITE_LINKEDIN_PARTNER_ID`) — público mais importante p/ contador e gestor.
- Hook `useTracking()` central. Todos os IDs ficam vazios até você colar — nada quebra.
- `<noscript>` fallbacks **no `<body>`** (não no head — evita crash Vite).

### 5b. UTM + lead
Já coberto no Bloco 4.

### 5c. Copy de anúncios
Vou gerar arquivo `ads-copy.md` em `/mnt/documents/` com:
- **Google Search** — 3 campanhas (contador / gestor OSC / branded) × 15 headlines + 4 descriptions + sitelinks + callouts (formato responsivo).
- **Meta** (FB/IG) — 6 variações (3 por público) com primary text + headline + description + CTA.
- **LinkedIn Sponsored Content** — 4 variações segmentadas (cargos: Contador, Sócio de escritório / Diretor financeiro OSC, Coordenador administrativo).

### 5d. Canais e palavras-chave
Mesmo arquivo, segunda parte:
- **Keywords Google Ads**: ~40 termos agrupados (ex.: "sistema contábil terceiro setor", "prestação de contas OSC", "SIT automatizado", "contador OSC", "software OSCIP").
- **Negative keywords**: "grátis", "curso", "concurso", "MEI", etc.
- **Públicos LinkedIn**: cargos + setor "Nonprofit Organization Management" + tamanho.
- **Sites/portais 3º setor para mídia display ou guest content**: ABCR, ABONG, Filantropia.org, GIFE, Instituto Phi, Comunitas.
- Orçamento sugerido inicial (R$ 30-50/dia/canal) e como ler os primeiros 14 dias.

---

## Bloco 6 — Camada técnica de ofuscação (você pediu "tudo")

Objetivo: dificultar que cliente ou IA externa entenda que tem extração automatizada por trás. Realista, não bala de prata.

### O que vou fazer
1. **Rebrand interno de termos sensíveis na UI do admin**:
   - "Capturado por IA" → "**Reconhecido automaticamente pelo SynSIT**"
   - "Extração", "parser", "AI Gateway", "Gemini", "Flash", "modelo" → removidos da UI, error messages, tooltips, console logs em prod.
   - Botão "Reprocessar com IA" → "Reanalisar documento".
2. **Limpar respostas das server functions**: payload retornado pro cliente não inclui `modelo_usado`, `tokens`, `provider`, `prompt`, `raw_response`. Tudo isso fica só em logs servidor.
3. **Headers HTTP**: remover `x-powered-by`, `server`, qualquer header revelador. Adicionar `x-app: SynSIT`.
4. **Mascarar nomes de tabelas/colunas expostos** em erros: middleware global captura erros Postgres/Supabase e devolve mensagens genéricas ("Não foi possível processar este documento") em prod.
5. **Watermark invisível em PDFs de prestação**: campo XMP metadata `Producer: SynSIT/3RD TECH` + ID único por download (rastreável se vazar).
6. **Termos de Uso** com cláusulas explícitas: proíbe engenharia reversa, scraping, exportar conteúdo para "modelos de linguagem ou serviços de IA terceiros", auditoria, NDA.
7. **Robots.txt + meta noindex** nas rotas `/admin/*` — não indexar nada interno.

### O que NÃO vou prometer
- **Não dá pra impedir** um cliente determinado de notar que o sistema "lê" boletos sozinho — o comportamento é observável (sobe PDF, sai preenchido). O que dá pra fazer é **não confirmar, não documentar, não nomear**. O discurso oficial é "tecnologia proprietária de reconhecimento de documentos fiscais".
- Se ele jogar um screenshot da tela numa IA, a IA pode chutar que tem OCR/LLM por trás. Não tem como evitar isso — só dá pra evitar que **a sua aplicação confirme isso** (textos, network tab, código fonte do front).

---

## Detalhes técnicos (pode pular se não for técnico)

- **Stack**: TanStack Start (rotas já existentes), Lovable Cloud (tabela `leads`), Lovable Emails (template `lead-notification`), Lovable AI **não** é mencionada em lugar nenhum do front.
- **Rotas marketing** todas com SSR + `head()` próprio + JSON-LD. Canonical apenas em leaves.
- **Form** com `react-hook-form` + `zod`. Submit chama server fn `enviarLead` (sem `requireSupabaseAuth` — público), com rate limit por IP.
- **Migration**:
  - `leads` (id, nome, email, telefone, osc_nome, cargo, plano, qtd_oscs, qtd_lancamentos, dor, origem, utm_*, user_agent, referrer, ip_hash, created_at). RLS bloqueia tudo exceto service role.
  - `leads_rate_limit` (ip_hash, count, window_start) — bloqueia >5 envios/hora por IP.
- **Email** via Lovable Emails (`scaffold_transactional_email`). Template recebe todos os campos do lead, formata bonito, assunto `LEAD SynSIT — {nome} ({plano})`, destinatário `l7hmarque@gmail.com` hard-coded server-side.
- **Tracking**: componente `<TrackingScripts/>` no `__root.tsx`, lê `VITE_*` vars. Hook `useTrackEvent(name, params)`.
- **Ofuscação**: middleware global de erro em `src/server.ts` + sweep de strings no admin + interceptor de headers.

---

## Ordem de execução nesta sessão

1. Tokens visuais + rotas vazias + sitemap/robots (rápido)
2. Migration `leads` + Lovable Emails setup
3. Server fn `enviarLead` + página `/demonstracao` + `/obrigado`
4. LP `/contadores` (hero, planos, FAQ, depoimentos, CTAs)
5. LP `/gestores` (mesma estrutura, copy diferente)
6. Home `/` redesenhada (escolha de público)
7. Tracking scripts + UTM capture
8. Ofuscação (sweep de termos + headers + middleware erro)
9. `ads-copy.md` + lista de canais em `/mnt/documents/`
10. Termos de Uso + Privacidade

Se a sessão saturar, paro em 6 e sigo no próximo turno. Aviso antes de parar.

---

## O que vai precisar de você depois

Pra ativar tráfego, você cola os IDs nas secrets (eu deixo pronto):
- `VITE_GTM_ID`, `VITE_GA4_ID`, `VITE_META_PIXEL_ID`, `VITE_GADS_ID`, `VITE_GADS_LABEL`, `VITE_LINKEDIN_PARTNER_ID`.

E precisa configurar:
- Domínio próprio (synsit.com.br?) — Lovable suporta custom domain.
- Email domain pra Lovable Emails enviar (subdomínio tipo `mail.synsit.com.br`).
- Contas Google Ads / Meta Business / LinkedIn Campaign Manager.

Aprova esse plano? Se sim, começo imediatamente pelo Bloco 1.
