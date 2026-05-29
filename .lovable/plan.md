## Status dos blocos P0

Já entregues nesta rodada:
1. ✅ SIT: `formatLinha` corrigido + `dtDebito` condicional
2. ✅ Multi-tenant Fase 1: `orcamentos.functions` + cache reset ao trocar org
3. ✅ Onboarding: trigger signup, índice único `id_interno`, convites de membro
4. ✅ E-mails transacionais (Resend) + UI de convites + `/convite/$token`
5. ✅ Filtros de org em `admin.painel` e `admin.prestacao`
6. ✅ Validação CNPJ/CPF + `fornecedores` com `organization_id`
7. ✅ Pendências SIT visíveis no painel (ícone + tooltip)
8. ✅ Cleanup do `useCurrentUser` (única fonte = `useActiveOrg`)
9. ✅ Logout limpo (`signOutLimpo`)
10. ✅ Org scoping em `admin.index` e `admin.modelos`
11. ✅ Org scoping nas server fns de `objetos`, `cotacoes`, `comprovantes`, `aprovacoes`

## Faltam 3 blocos para fechar o P0

### Bloco 12 — Guard de plano (trial expirado / suspenso)
Hoje `activeOrg.status` e `trial_ate` existem mas ninguém bloqueia. Adicionar:
- `src/components/admin/PlanoGuard.tsx`: se `status === "suspenso"` ou `status === "cancelado"`, ou `status === "trial"` com `trial_ate < hoje`, mostra tela bloqueante com CTA "Falar com suporte" / "Renovar". Owner ainda vê `Configurações`.
- Plugar em `src/routes/admin.tsx` (envolve o `<Outlet />`).
- Sem migration.

### Bloco 13 — Unificar `favorecidos_padrao`
Hoje DARF/GPS/Sanepar/Copel vivem hardcoded em `src/lib/extract/favorecidosPadrao.ts`. Migrar para tabela:
- Migration: `favorecidos_padrao (id, cnpj, nome, categoria, ativo, criado_em)` — global, sem `organization_id` (é catálogo público).
- `GRANT SELECT ... TO authenticated`, RLS read-only.
- Seed com os atuais hardcoded.
- `aplicarFavorecidoPadrao` passa a consultar o catálogo (cache no client).
- Tela owner-only `/owner/favorecidos` para CRUD (opcional, nice-to-have).

### Bloco 14 — Pré-validação SIT antes de exportar
- Botão "Validar antes de exportar" no header de `admin.painel`.
- Modal com tabela: evento × pendências (reusa `pendenciasSIT`).
- Permite exportar mesmo com pendências (o usuário escolhe pular os incompletos, já é o comportamento atual), mas dá visibilidade prévia.
- Sem migration, só UI.

## Itens fora do P0 (não fazer agora)
- Stripe / cobrança automática (usuário pediu cobrança manual)
- Persistent capture queue, snapshot avançado, agenda, suporte, alertas reais
- Real-time invitations, role management UI completa

## Sugestão de ordem
Bloco 12 (guard) → Bloco 14 (pré-validação SIT) → Bloco 13 (favorecidos no banco).

12 e 14 são puramente cliente, baixo risco. 13 envolve migration + seed, melhor por último.

Confirma essa ordem? Posso começar pelo Bloco 12 assim que aprovar.