# Plano P0 — Pronto pra Lançar

Escopo fechado: itens 1–18 do diagnóstico, sem Stripe, com Resend, removendo dados hardcoded. Executo em 5 fases, cada fase é um commit testável e reversível.

---

## Fase 1 — Geração de Despesa.txt válida no TCE-PR (itens 1–6)

**Objetivo:** TXT que o SIT aceita sem rejeição.

- **1.1** Em `src/lib/sit/formatLinha.ts`: cada linha termina com `|`. Adicionar teste unitário comparando com layout oficial campo a campo. EDIT: as linhas das despesas nao terminam com `|` **, terminam sem nada fechando**
- **1.2** Confirmar separador de data (`/` ou `-`) lendo o manual SIT/TCE-PR vigente; ajustar `formatarData()` conforme; cobrir com teste.
- **1.3** Validar dígito de CNPJ/CPF em `nrCNPJConcedente`, `nr_doc_fav`, `nr_documento_pagamento`. Helper `validarCnpj()` / `validarCpf()` em `src/lib/sit/validacao.ts`. Alerta no export quando inválido e listar pendência por linha.
- **1.4** `dtDebito` só preenchido quando `tp_documento_pagamento` = débito em conta; nas demais formas vai vazio.
- **1.5** `gerarIdInterno` (em `inferCaptura.ts` e na fila de captura) deve ser único por **lote** — incluir índice + hash do arquivo. Adicionar UNIQUE parcial em `eventos_financeiros(organization_id, id_interno)` via migration.
- **1.6** UI do painel: botão "Validar antes de exportar" que mostra a lista de pendências por evento (CNPJ inválido, campo obrigatório vazio, data fora do mês, etc.) antes de baixar o TXT.

**Critério de aceite:** `formatLinha.test.ts` passa, export de uma despesa real é aceito em validador SIT offline.

---

## Fase 2 — Segurança multi-tenant e cache (itens 7–10)

**Objetivo:** Tapar vazamentos cross-org.

- **2.1** Reescrever `src/lib/orcamentos.functions.ts` para usar `context.supabase` (vindo de `requireSupabaseAuth`) em todas as queries. Remover o import do client anon. Inserts em `orcamentos_salvos` e `objetos_cotacao` recebem `organization_id` explícito a partir do contexto.
- **2.2** Defesa em camadas: todas as queries no frontend (`admin.painel.tsx`, `admin.orcamentos.tsx`, `admin.fornecedores.tsx`, etc.) ganham `.eq("organization_id", activeOrgId)` mesmo com RLS no banco.
- **2.3** Em `src/hooks/use-active-org.tsx`, no `setActiveOrgId` chamar `queryClient.invalidateQueries()` + `queryClient.removeQueries()`. Limpar também `localStorage` de rascunhos (`synsit:rascunho-auto`, fila de captura).
- **2.4** Adicionar `activeOrgId` ao queryKey de toda query que toca tabela com `organization_id` — convenção: `["cotacoes", orgId]`, `["fornecedores", orgId]`, `["eventos", orgId, mes]`.
- **2.5** Remover `activeOrg` de `useCurrentUser()`; toda chamada passa a usar `useActiveOrg()`. Fonte única.

**Critério de aceite:** trocar de org no switcher faz cards do painel zerarem e recarregarem; segunda org não vê dados da primeira nem por 1 frame.

---

## Fase 3 — Onboarding, auth e e-mails Resend (itens 11–14, 17)

**Objetivo:** Cliente novo consegue se cadastrar sozinho e operar.

- **3.1** Conectar Resend via connector (pedirei aprovação do usuário com `standard_connectors--connect`). Templates em `src/lib/email/templates/` (boas-vindas, convite, reset, aprovação).
- **3.2** Server fn `enviarEmail()` em `src/lib/email.functions.ts` usando gateway Resend descrito na knowledge.
- **3.3** Onboarding pós-signup: trigger SQL `on_auth_user_created` que cria `organizations` (tipo=osc, trial 30d), insere `organization_members` como `owner`, e roda `enviarEmail("boas-vindas")`. Ou — alternativa mais segura — fazer isso numa server fn `finalizarOnboarding()` chamada no primeiro login quando o usuário ainda não tem membership; vou usar **trigger SQL** por ser idempotente e sem race.
- **3.4** Criar rota `/esqueci-senha` chamando `supabase.auth.resetPasswordForEmail(email, { redirectTo: origin + "/atualizar-senha" })`.
- **3.5** `/atualizar-senha` valida evento `PASSWORD_RECOVERY` via `onAuthStateChange`; sem isso, redireciona pra `/login`. Página vira pública.
- **3.6** Convite de membro: tabela `convites_membro (id, organization_id, email, role, token, expira_em, aceito_em)` + server fn `convidarMembro()` que envia e-mail. Rota pública `/aceitar-convite/:token` que pede signup/login e insere `organization_members`.
- **3.7** `removerConvite` (e `removerConviteMembro`): adicionar verificação `eq("organization_id", current_user_org())` antes do delete.

**Critério de aceite:** fluxo signup → recebe e-mail → loga → vê painel da própria org com trial de 30 dias visível.

---

## Fase 4 — Portal público do fornecedor (item 15)

**Objetivo:** Link `/cotacao/:token` funcional ponta a ponta.

- **4.1** Criar server route `src/routes/api/public/cotacao.$token.ts` com handlers GET (carrega cotação + itens) e POST (salva resposta do fornecedor). Sem auth; valida `token` contra `convites_cotacao`, checa `expira_em` e `status`.
- **4.2** Usar `supabaseAdmin` no handler, com WHERE estrito por token. Nunca retornar campos sensíveis da org.
- **4.3** Atualizar `src/routes/cotacao.$token.tsx` para consumir essas rotas (hoje aponta pra endpoint inexistente).
- **4.4** Rate-limit por IP (5 req/min) via tabela `cotacao_rate_limit` igual ao padrão de `leads_rate_limit`.

**Critério de aceite:** abrir o link em aba anônima carrega o formulário, submeter grava resposta, status do convite vai pra `respondido`.

---

## Fase 5 — Limpeza e bloqueios operacionais (itens 16, 18)

- **5.1** Remover `CATEGORIA_GASTO_BASELINE` (e qualquer dado real) de `src/lib/sit/catalogos.ts`. Mover pra seed da org demo via migration (`INSERT ... WHERE nome = 'Demonstração'`) ou simplesmente apagar se não houver org demo.
- **5.2** Unificar `favorecidosPadrao.ts` e `inferCaptura.ts` — uma única tabela `favorecidos_padrao` no banco, scopada por org.
- **5.3** Guard de trial/suspenso: middleware `requireActiveOrg` que bloqueia rotas `/admin/*` quando `organizations.status = 'suspenso'` ou `trial_ate < hoje`. Mostra página "Trial expirado — fale com suporte" (cobrança manual nesta rodada).
- **5.4** Logout limpa `synsit_interno`, `approva.viewAs.*`, `activeOrgId`, rascunhos.

**Critério de aceite:** repo grep por CNPJs reais retorna zero; org com `trial_ate` no passado não consegue abrir `/admin/painel`.

---

## Migrations (resumo)

```text
1. UNIQUE INDEX eventos_financeiros (organization_id, id_interno) WHERE id_interno IS NOT NULL
2. CREATE TABLE convites_membro (...) + RLS + GRANT
3. CREATE TABLE cotacao_rate_limit (...) + policy deny-all (acessada via admin)
4. CREATE TABLE favorecidos_padrao (organization_id, cnpj, nome, tp_doc_fav, tp_documento_despesa, ...) + RLS
5. TRIGGER on_auth_user_created → cria org + membership
6. Remover/zerar seeds com dados reais
```

## Itens fora desta rodada (anotados pra próxima)

- Stripe + cobrança automática
- Dedup de docs na captura, fila de captura persistente em servidor
- Snapshot único (consolidar painel.tsx + prestacao.tsx)
- Agenda (hoje placeholder)
- Tickets de suporte com notificação
- UI de gestão de roles
- Disparo real dos alertas configurados
- Itens P1/P2 (19–43)

## Ordem de execução

Fase 1 → 2 → 3 (com aprovação do Resend connector entre 2 e 3) → 4 → 5. Cada fase é uma sequência de tool calls; paro após cada fase pra você validar antes de seguir, ou toco direto até o fim se preferir.

**Pergunta final antes de implementar:** prefere que eu execute **fase por fase com checkpoint** ou **tudo de uma vez** até a Fase 5?