# Milestone 4 — Fechamento do plano original (implementado)

## Entregas

### 4.1 Categorias financeiras unificadas — reavaliado, sem mudança
Ao mapear o código descobrimos que **não existe a duplicação assumida**:

- `_authenticated.admin.orcamentos.tsx` é o módulo de **cotações** (RFQ),
  não uma lista de rubricas orçamentárias — não tem categorias próprias.
- `eventos_financeiros.categoria` é sempre um código de **natureza
  econômica SIT/TCE** vindo do catálogo único em `src/lib/sit/catalogos.ts`
  (`CATEGORIAS`), consumido por captura, prestação, snapshot e
  `inferCaptura`.
- Portanto não há duas listas para unificar. A "categoria por org" só faz
  sentido se um dia quisermos rótulos internos além do código SIT — fica
  como M5 sob demanda real.

Nenhuma migração criada aqui.

### 4.2 Captura resiliente client-side
- `comRetry()` em `_authenticated.admin.captura.tsx`: backoff 2s → 10s → 30s
  apenas para erros de rede reconhecíveis (`network`, `failed to fetch`,
  `timeout`, `fetch failed`, `load failed`, `econn`, `temporar`). Erros
  4xx (validação/RLS) não sofrem retry.
- Upload no Supabase Storage passa a usar `comRetry`; a mensagem do item
  vira `"rede instável — tentativa N/4"` durante o retry.
- Novo botão **"Reprocessar N erro(s)"** no cartão de ações — só aparece
  quando há itens em `status = "erro"`. Ele re-envia sem pedir para o
  usuário selecionar os arquivos de novo (o `File` fica em memória).
- Persistência entre reloads (localStorage/IndexedDB) foi deliberadamente
  omitida: `File` bruto não sobrevive a reload sem re-serializar em base64,
  o que estoura quota rápido e ainda perde metadados. Se virar dor real,
  retomamos com IndexedDB.

### 4.3 Cobrança automática
Mantida fora, conforme decidido. Texto do `PlanoGuard` ajustado para
não prometer autosserviço:
- "Regularize o pagamento…" → "Fale com nossa equipe para regularizar…"
- "Escolha um plano…" → "Fale com nossa equipe para contratar um plano…"

### 4.4 Remoções e limpeza
Removidos (confirmados como não usados em produção):
- `src/routes/showcase.$screen.tsx`
- `src/routes/ferramenta.tsx`
- `src/lib/extracoes-online.ts`
- `src/lib/regrasUsuario.ts`
- `Disallow: /ferramenta` de `public/robots.txt`

Escondidos do menu (rota permanece):
- Item "Agenda" em `src/components/admin/sidebar.tsx` — ficou comentado
  junto com o import `CalendarDays`. A rota
  `_authenticated.admin.agenda.tsx` e o `PlaceholderPage` seguem para
  quando entregarmos a Fase 4.

## Fora de escopo (polimento pós-M4)

- Metadata SEO por rota pública (título/description/og reais).
- Auditoria rota-a-rota do gate `_authenticated/`.
- Scan de segurança + revisão de RLS/GRANT das tabelas novas do M3.
- Alertas de fila Drive no painel `/owner` (hoje só na tela de arquivos).
- Padronização de `errorComponent`/`notFoundComponent` em rotas com loader.
