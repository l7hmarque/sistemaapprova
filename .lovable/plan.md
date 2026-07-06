
## Problema

Hoje a página **Captura** (`/admin/captura`) roda todo o pipeline no navegador:
1. lê o arquivo, calcula hash, sobe para o Storage
2. chama a server function `extrairDocumento` (IA)
3. cria/atualiza fornecedor + evento financeiro + anexo

Se o usuário troca de página, o React desmonta o componente, os `await` são abandonados e o arquivo fica "no meio do caminho". Além disso, tudo é serial no cliente, o que faz cada arquivo demorar bastante (upload → texto → IA → dedup → evento).

## Objetivo

- O upload dispara um **job no servidor**. Depois disso, sair da página **não cancela** nada.
- Ao voltar para Captura, a UI mostra o estado atual (fila / processando / concluído / erro) lido do banco.
- Processamento em paralelo (várias jobs simultâneas) para reduzir o tempo total.

## Escopo desta entrega

Somente a página `/admin/captura` e seu backend. Não altero extração de prestação (`/api/extract`), nem RLS de outras tabelas, nem o layout visual da página — só troco a origem dos itens (localStorage → tabela) e adiciono indicadores de progresso.

## Arquitetura

```text
[Browser]
  1. resize/hash (rápido) → upload direto ao Storage (bucket documentos)
  2. POST server fn  enfileirarCaptura({ storage_path, hash, file_name, mime })
                       └─ INSERT em public.captura_jobs (status='pendente')
                       └─ dispara processarCapturaJob(jobId) via ctx.waitUntil
  3. subscribe realtime em captura_jobs WHERE organization_id=? AND criado_em>hoje
     → UI reflete status/mensagem/resultado em tempo real

[Worker background — processarCapturaJob]
  status='processando'  → baixa do Storage, extrai texto (unpdf), chama IA,
                          dedup, cria/atualiza fornecedor, cria evento,
                          insere documentos_anexos, tenta vínculo automático
  status='concluido' | 'erro'  → grava mensagem + evento_id + doc_id
```

Assim o pipeline vive no Worker; a aba do usuário é só observador. Fechar a aba não interrompe: `ctx.waitUntil` mantém a invocação viva até terminar. Se o Worker for reciclado antes do fim, uma job pendente/travada é reprocessada pelo mesmo endpoint (pooling ao reabrir Captura + botão "reprocessar").

## Mudanças

### 1. Banco (migration)

Nova tabela `public.captura_jobs`:

- `id uuid pk`, `organization_id uuid`, `criado_por uuid`
- `storage_path text`, `arquivo_hash text`, `nome_arquivo text`, `mime_type text`, `tamanho_bytes int`
- `status text check in ('pendente','processando','concluido','erro','cancelado')`
- `mensagem text`, `tentativas int default 0`, `iniciado_em timestamptz`, `finalizado_em timestamptz`
- `evento_id uuid null`, `documento_id uuid null`, `dados jsonb`
- `mes_referencia text` (AAAA-MM, para filtrar UI)
- `criado_em`, `atualizado_em`
- índices: `(organization_id, status)`, `(organization_id, criado_em desc)`

`GRANT SELECT, INSERT, UPDATE ON public.captura_jobs TO authenticated;`
`GRANT ALL ... TO service_role;`
RLS: só membros da org (`organization_id IN user_orgs(auth.uid())`). INSERT/UPDATE conferindo `organization_id`.

Publica na `supabase_realtime` para o cliente assinar mudanças.

### 2. Servidor — nova função `src/lib/captura-jobs.functions.ts`

- `enfileirarCaptura({ storage_path, hash, nome, mime, tamanho, mes_referencia })`
  - autentica via `requireSupabaseAuth`
  - INSERT job pendente
  - dispara `processarCapturaJob(jobId)` sem await, envolto em `getEvent().context.cloudflare.ctx.waitUntil(...)` (via `getRequestEvent`)
  - retorna `{ jobId }`
- `processarCapturaJob(jobId)` (interna, service role)
  - marca `processando`, incrementa tentativas
  - baixa do Storage, roda a mesma lógica que hoje está no cliente (hash já veio, extração texto/imagem/pdf, chamada à IA em `extrairDocumento`, dedup, fornecedor, evento, anexo, vínculo automático)
  - grava `concluido` + payload em `dados`
  - em erro, grava `erro` + `mensagem` amigável (usa a mesma `msgErro`)
- `listarJobsRecentes({ mes })` — usado pelo cliente para hidratar a lista ao entrar na página.
- `reprocessarJob(jobId)` — reabre `pendente` e re-dispara.
- `removerJob(jobId)` — apaga job (não apaga arquivo do Storage se já virou anexo).

### 3. Página `src/routes/_authenticated.admin.captura.tsx`

- Remove persistência em `localStorage` de `itens` (fica só como fallback antigo, migração silenciosa).
- Ao entrar: `listarJobsRecentes({ mes })` popula a lista.
- Subscribe realtime `captura_jobs` filtrado por org + mês → atualiza os cards.
- Upload passa a ser só:
  1. `resizeImage` + `sha256` (client)
  2. `supabase.storage.upload` (client)
  3. `enfileirarCaptura(...)` (server) — devolve `jobId`
  4. adiciona linha "pendente" na UI (a realtime cuida do resto)
- Botões: **Reprocessar** (chama `reprocessarJob`), **Remover** (`removerJob`). "Vincular manualmente" continua igual, atuando sobre `evento_id` do job.
- Adiciona badge com contador "N processando em segundo plano — pode sair da página".

### 4. Detalhes técnicos importantes

- Reaproveita `src/lib/captura.functions.ts` (`extrairDocumento`) — o worker chama diretamente o helper server-only por trás, sem passar pelo RPC.
- Nada é executado no cliente após o `POST /enfileirar`. Fechar/trocar página não cancela porque a promise está em `ctx.waitUntil` do Worker.
- Concorrência: cada arquivo vira uma job; o Worker processa em paralelo naturalmente (chamadas independentes). Para não estourar cota da IA, limito a 3 chamadas simultâneas por org com um semáforo simples em memória do módulo.
- Timeouts: mantenho o timeout de 10s no unpdf; se IA falhar, marca `erro` com mensagem, não trava a job.
- Reentrância: `processarCapturaJob` verifica `status='pendente'` antes de rodar (evita duplicar se realtime + waitUntil concorrerem).
- Migração de dados antigos do `localStorage`: no primeiro carregamento, se houver `captura.itens.<org>` e nenhum job no mês, apenas descarta silenciosamente (não vale re-tentar sem o `File`).

## Fora de escopo

- Retry automático agendado por cron (fica manual via botão Reprocessar por enquanto).
- Notificação por e-mail quando terminar.
- Mudanças na tela de Prestação / extractor de PDF grande.
