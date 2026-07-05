
# Polimento pré-lançamento + reforma da landing

Dois eixos em paralelo: **reforma comercial da landing** (com
pesquisa de concorrentes e infográfico novo) e **polimento técnico**
herdado do fim do M4. Nada aqui muda funcionalidade do app — só
cópia, SEO, infográfico e infra de confiança.

Decisões do usuário incorporadas:
- Sem números públicos ("N orgs ativas" / "N docs processados"). Uso
  prova social genérica ou pulo a faixa.
- Além do TCE-PR, hoje o produto atende **prestações municipais**.
  A promessa passa a incluir isso explicitamente.
- Canonical padronizado em **`sistemaapprova.lovable.app`** em toda a
  metadata (remover `synsit.lovable.app` onde aparecer).
- Novo: **infográfico do fluxo de trabalho mensal** de um gerente de
  OSC ou contador usando o Approva.

---

## Parte A — Reforma da landing e páginas de segmento

### A.1 Diretriz editorial

- **Remover toda menção a "IA" / "Inteligência Artificial"**.
  Substituir por "reconhecimento automático", "leitura automática de
  documentos", "captura sem digitação".
- **Tirar o `Despesa.txt` / SIT do centro do palco**. Fica como
  *prova de compatibilidade* (uma linha na seção "Como funciona" e no
  FAQ), nunca como headline nem como passo 3 herói.
- **Reposicionamento**: dor → solução → lastro auditável. SIT vira
  consequência de um sistema bem operado.
- **Escopo público expandido**: "prestações de contas para o
  TCE-PR e para órgãos municipais" — sem prometer estados/federais
  que ainda não atendemos.

Superfícies impactadas:
- `src/routes/index.tsx` (landing)
- `src/routes/contadores.tsx`, `src/routes/gestores.tsx`
- `src/routes/demonstracao.tsx`
- `src/components/marketing/PlanCards.tsx`, `FaqAccordion.tsx`
- Metadata e JSON-LD reescritos para refletir a nova narrativa.

### A.2 Pesquisa de concorrentes (build mode)

Antes de escrever cópia, rodo:

1. **Direct**: `semrush--competitive_analysis` a partir de
   `sistemaapprova.lovable.app` para descobrir competidores orgânicos;
   `semrush--top_pages` + `semrush--page_analysis` nos 3 mais fortes
   para ver que conteúdo puxa tráfego deles. Candidatos iniciais
   para inspecionar: SICAP-Cidadão, Metria, e-Prestação,
   Contmatic/Domínio ONG, plataformas de convênio.
2. **Adjacent**: `semrush--keyword_research` em âncoras
   ("prestação de contas ONG", "convênio TCE-PR", "MROSC 13.019",
   "prestação de contas município"); `websearch--web_search` para as
   landings atuais desses provedores.

**Uso do resultado**: extraio padrões que aparecem em 2+ concorrentes
fortes (bandas de headline, ordem de seções, tipos de proof, formato
de pricing, âncoras de FAQ). Filtro pelo que faz sentido no Approva.
Adapto — não copio literalmente. Documento o mapa concorrente →
decisão em `.lovable/competitor-notes.md`.

### A.3 Infográfico "Fluxo mensal do gestor / contador"

Um SVG único, colocado como nova seção da landing entre "Como
funciona" e "Segmentos", contando a **rotina mensal** de quem usa o
Approva:

```text
Início do mês                Durante o mês               Fim do mês
─────────────                 ─────────────               ───────────
Recebe repasse    →   Captura documentos    →   Revisa e aprova   →   Exporta e arquiva
(convênio/termo)      (upload no Approva:        (categoria certa,     (para TCE-PR ou
                       PDF, NF-e, boletos,        comprovante anexo,    município + PDF
                       holerites, XMLs)           dupla assinatura)     do relatório)
```

Duas raias horizontais: **Gestor OSC** (upload, aprova, publica) e
**Contador** (revisa consistência, exporta, arquiva). Ícones sóbrios,
tokens do brand (`brand-cream`, `brand-navy`, `brand-blue`), zero
menção a "IA". Implementação: SVG inline em
`src/components/marketing/FluxoMensal.tsx` (responsivo, aria-label
completo, sem dependência nova). Alternativa: se ficar denso demais,
divido em 2 lanes empilhadas no mobile.

Também vira `og:image` candidata em `contadores.tsx`/`gestores.tsx`
via export estático (screenshot do SVG renderizado como PNG através
de `imagegen--edit_image` a partir do SVG — só se você aprovar; do
contrário mantenho os screenshots atuais).

### A.4 Nova estrutura da landing

1. **Hero**: dor + promessa temporal ("Feche o mês da sua OSC em
   horas, com cada real comprovado"). Sem "IA". CTA principal +
   secundário. Screenshot do painel.
2. **Dores que resolvemos** (3–4 cards): planilha paralela;
   comprovante perdido; retrabalho no fechamento; medo do
   apontamento no controle externo. Cada card fecha com o feature
   que resolve.
3. **Como funciona** (3 passos, mais funcionais): capturar
   documentos → organizar por mês/rubrica com aprovação → exportar
   para o órgão (TCE-PR ou município). SIT citado como formato
   suportado, não como herói.
4. **Infográfico "Fluxo mensal"** (A.3).
5. **Features holísticas** (grid 6): captura sem digitação,
   comprovação anexa, aprovação em duas mãos, painel financeiro por
   termo, arquivos organizados em nuvem, exportações prontas.
6. **Segmentos** (mantém 2 cards → contadores/gestores).
7. **Segurança & lastro auditável**: bloco novo curto —
   imutabilidade de período homologado, trilha de auditoria,
   criptografia, multi-cliente para escritórios. Ocupa o espaço que
   o SIT deixou no centro.
8. **Planos**.
9. **FAQ** reescrito: adiciono "É preciso ter conhecimento técnico?",
   "Funciona para prestações municipais além do TCE-PR?", "Como fica
   o histórico do mês depois de fechado?"; removo perguntas que
   dependem de "IA".
10. **CTA final**.

*Não incluo faixa de prova social com números* — o usuário confirmou
que ainda não temos volume público. Se aparecer necessidade forte na
pesquisa de concorrentes, uso alternativa qualitativa (uma linha
"feito por / para OSCs do Paraná").

### A.5 Metadata e SEO da nova narrativa

- Novos `<title>` / `<description>` em `index.tsx` sem "IA" e sem
  SIT como assunto principal. Alvo de keyword calibrado pela
  pesquisa Semrush (composição de "prestação de contas" +
  "OSC/terceiro setor" + TCE-PR/município).
- **Padronizar canonical/og:url em `sistemaapprova.lovable.app`**
  em todas as rotas públicas. Substituir `synsit.lovable.app` onde
  aparecer.
- `og:image` apenas em rotas-folha (confirmar que não vazou para
  `__root.tsx`).
- Atualizar JSON-LD `FAQPage` e `SoftwareApplication.description`.
- Atualizar `Organization` em `__root`/`index` para refletir marca
  atual sem prometer números.

### A.6 SEO técnico do resto do site

- Metadata específica em todas as rotas públicas: `contadores`,
  `gestores`, `blog.index`, `blog.painel-scfv-tcepr`, `demonstracao`,
  `orcamentos`, `privacidade`, `termos`, `obrigado`,
  `convite.$token`, `cotacao.$token` (as duas últimas com `noindex`).
- Canonical leaf-only. `og:url` self-reference.
- Atualizar `src/routes/sitemap[.]xml.ts` para refletir rotas atuais
  (após remoções de M4).
- Rodar `seo_chat--trigger_scan` no final.

---

## Parte B — Polimento técnico

### B.1 Auditoria do gate `_authenticated/`
Varrer rotas admin/owner e confirmar que sentam sob
`_authenticated`. Corrigir loaders públicos que chamem server fn
com `requireSupabaseAuth`.

### B.2 Security scan
`security--run_security_scan`; resolver críticos, principalmente
`drive_sync_queue` (RLS/GRANT do M3) e tabelas novas.

### B.3 Alertas de fila Drive em `/owner`
Hoje o badge de fila só aparece em `_authenticated.admin.arquivos`
para a org ativa. Adicionar card em
`_authenticated.owner.index.tsx` somando `falhou_definitivo` de
todas as orgs (server fn com `supabaseAdmin`, restrita a
`super_admin`).

### B.4 `errorComponent` / `notFoundComponent`
Passar em cada rota com `loader` (as do M3 em particular) e
padronizar boundaries — texto amigável, retry chamando
`router.invalidate() + reset()`.

### B.5 Cópia técnica menor
Mensagem humana no erro de reprocessamento da captura (hoje mostra
payload cru de PostgREST em alguns caminhos).

---

## Ordem de execução

1. **Pesquisa concorrentes** (Semrush + web_search).
2. **Reforma da landing** (`index.tsx` + componentes marketing +
   novo `FluxoMensal.tsx` + metadata + JSON-LD).
3. **Páginas de segmento** (`contadores`, `gestores`,
   `demonstracao`) alinhadas ao novo tom.
4. **SEO técnico** das rotas públicas + `seo_chat--trigger_scan`.
5. **Polimento técnico** (B.1 → B.5) em paralelo com o SEO scan.
6. Fecha com `security--run_security_scan`.

## Fora de escopo

- Redesign visual completo (paleta/tipografia/layout novo).
- Novas features de produto.
- Cobrança automática / autosserviço de plano.
- Prometer atendimento a estados fora do PR ou convênios federais
  antes de ter caso real.
