# Frentes B + C, sem multi-OSC

## 1. Limpar landing (remover multi-OSC)

**Problema**: hero e passo 2 mostram `preview-dashboard.png` com "4 projetos ativos / R$ 312.450 executado / próximos prazos", coisa que o produto atual não entrega. Copy também fala em "vários projetos / por rubrica e termo" como se já existisse painel multi-projeto.

**Mudanças em `src/routes/index.tsx`**:
- Hero: trocar imagem por uma nova `preview-revisao.png` (gerada agora) — mostra a tela de revisão da prestação **de um único termo** com a coluna nova de Comprovante (Frente B).
- Seção "Como funciona", passo 2: substituir `preview-dashboard.png` pela mesma nova `preview-revisao.png` com caption **"Revise, aprove e anexe comprovantes"** (em vez de "Acompanhe execução e prazos").
- Reescrever copy do hero e do passo 1 para falar em **uma prestação por vez** ("prestação de contas mensal do seu termo"), não "execução por projeto".
- Cards "Para contadores / Para gestores": tirar "várias entidades" → "padronize prestações mensais".
- `og:image` e `twitter:image`: apontar para `preview-revisao.png`.
- Deletar `src/assets/preview-dashboard.png`.

**Nova imagem `src/assets/preview-revisao.png`** (gerada com `imagegen` premium, 1600×900, mesma paleta corporativa azul/cinza):
- Tabela de despesas do termo de fomento mostrando colunas Data / Favorecido / Documento / Valor / Categoria / **Comprovante** (badge verde "Anexado") / **Status** (badge "Aprovado" ou "Aguardando").
- Header com KPIs do termo único: Total executado, Documentos com lastro, Aguardando aprovação.
- Sem menção a múltiplos projetos.

## 2. Frente B — Comprovante + aprovação no `/ferramenta`

### Migration
Reaproveitar `prestacao_documentos` adicionando vínculo direto a uma despesa:
```sql
alter table public.prestacao_documentos
  add column extracao_id uuid references public.extracoes_salvas(id) on delete cascade,
  add column despesa_uid text,
  add column status_aprovacao text not null default 'pendente'
    check (status_aprovacao in ('pendente','aprovado','rejeitado')),
  add column aprovado_por uuid,
  add column aprovado_em timestamptz,
  add column observacao_aprovacao text;

create index on public.prestacao_documentos (extracao_id, despesa_uid);
```
Bucket `documentos` (já existe, privado). Path: `comprovantes/{extracao_id}/{despesa_uid}-{hash8}.{ext}`.

### Server functions novas em `src/lib/comprovantes.functions.ts`
- `anexarComprovante({ extracaoId, despesaUid, file })` — upload no bucket via signed URL + insert no `prestacao_documentos`.
- `removerComprovante({ id })` — delete row + objeto.
- `listarComprovantes({ extracaoId })` — devolve mapa `{ [despesaUid]: comprovante[] }`.
- `aprovarDespesa({ comprovanteId, status, observacao })` — requer auth; grava `aprovado_por = userId`, `aprovado_em = now()`.

### UI em `/ferramenta`
- Nova coluna **Comprovante** na tabela de despesas: botão "Anexar" (input file), thumbnail/ícone quando anexado, link "Ver" (signed URL).
- Nova coluna **Status**: badge `pendente/aprovado/rejeitado` + botão "Aprovar" (visível só se o user atual ≠ quem lançou — política de quatro olhos via comparação de `auth.uid`).
- Banner de conformidade no topo: `47/60 despesas com comprovante` + `12 aguardando aprovação`.
- Salvar extração online (já existe) passa a guardar o `extracao_id` que liga aos comprovantes.

### Nova rota `/admin/aprovacoes`
- Lista cross-extrações de despesas pendentes (`status_aprovacao = 'pendente'`).
- Filtros: mês, termo, fornecedor. Ações: aprovar/rejeitar em lote.

## 3. Frente C — Robustez da extração

### Cache por hash em `/api/extract`
- Calcular `sha256(pdfBytes ?? pdfText)` no servidor.
- Adicionar coluna `hash_arquivo text unique` em `extracoes_salvas` + index.
- Antes de chamar IA: `select dados from extracoes_salvas where hash_arquivo = ?` — hit retorna direto com header `X-Cache: hit`.
- Miss: chama IA normalmente e na resposta grava o hash (upsert).

### Retry no Pro quando Flash entrega vazio
Replicar a lógica que já existe em `src/lib/captura.functions.ts`:
- Se `validated.despesas.length === 0` e (`pdfText.length > 500` ou `pdfBytes`), refazer chamada com `google/gemini-2.5-pro`.
- Se ainda vier vazio, devolver erro 422 com mensagem clara.

### Chunking client-side para PDFs grandes sem texto
Em `src/routes/ferramenta.tsx` (`uploadComProgresso`):
- Quando texto extraído < 500 chars **e** `file.size > 8 MB`:
  1. Importar `pdf-lib` (já está na árvore via dependências do projeto — confirmar; se não, `bun add pdf-lib`).
  2. Dividir em chunks de ~6 MB por número de páginas.
  3. Enviar chunks sequencialmente para `/api/extract` (FormData binário).
  4. Mesclar: `despesas = concat`, `receitas = concat`, `resumo` = soma campo a campo, `mesReferencia` do primeiro chunk não-vazio.
  5. UI mostra progresso `Chunk 2 de 4`.
- Quando `file.size > 8 MB` mas tem texto: já funciona (envia JSON com texto).

## 4. Alinhamento visual (design das mockups → produto real)

Sem refazer telas. Aplicar tokens e ritmo visual da landing ao `/ferramenta` e `/admin/*`:
- Confirmar tokens `brand-cream / brand-navy / brand-blue / brand-line / brand-muted` no `src/styles.css` e usar nas tabelas/cards do admin (hoje boa parte usa cores neutras do shadcn).
- Cards de KPI no topo do `/ferramenta` (Conformidade, Aguardando aprovação, Total executado) com a mesma sombra suave/cantos arredondados das mockups.
- Headers de seção em `font-serif text-brand-navy` (já existe na landing).
- Botões primários `bg-brand-navy text-white`, secundários `border-brand-navy text-brand-navy`.
- Tabela de despesas: header em `bg-brand-cream`, badges com cores semânticas (verde aprovado, âmbar pendente, vermelho rejeitado).

## Ordem de execução proposta

1. Limpar landing + gerar `preview-revisao.png` (rápido, desbloqueia o erro de promessa).
2. Migration + server functions de comprovante/aprovação.
3. UI do `/ferramenta` (colunas novas + banner).
4. Cache por hash + retry no Pro (mudanças isoladas em `/api/extract`).
5. Chunking client-side.
6. Pass de design tokens no `/ferramenta` e `/admin/*`.
7. Nova rota `/admin/aprovacoes`.

## Fora de escopo
- Multi-OSC / multi-termo simultâneo (Frente A, fica para depois).
- Conciliação bancária.
- Workflow de notificação por email da aprovação (manda em outra rodada se quiser).
- Mudanças funcionais no `/admin/painel`, `/admin/orcamentos` etc. — só recebem o pass de design tokens.

## Arquivos tocados (estimativa)
- novos: `src/lib/comprovantes.functions.ts`, `src/routes/admin.aprovacoes.tsx`, `src/assets/preview-revisao.png`, migration.
- editados: `src/routes/index.tsx`, `src/routes/ferramenta.tsx`, `src/routes/api/extract.ts`, `src/lib/extract/pipeline.ts` (se preciso), `src/components/admin/sidebar.tsx`, `src/styles.css` (se faltar token).
- removidos: `src/assets/preview-dashboard.png`.
