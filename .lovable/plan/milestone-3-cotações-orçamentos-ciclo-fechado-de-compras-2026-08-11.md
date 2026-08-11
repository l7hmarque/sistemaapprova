## Milestone 3 — Cotações & Orçamentos (ciclo fechado de compras)

O módulo hoje cria cotações, gera Sheets por fornecedor, monta mapa comparativo manual e tem portal público — mas o ciclo não fecha: convites são só um link salvo no banco (sem e-mail), a escolha do vencedor é implícita, e não existe ponte entre o mapa aprovado e o evento financeiro (REO 3.3.90.39.99 / modalidade 101). Esta fase resolve os quatro elos que faltam.

### Escopo

1. **Envio de convites por e-mail (Resend)**
   - Ao criar convite em `/admin/cotacoes/$id`, se houver e-mail, disparar mensagem transacional com objeto, itens, prazo e link `/cotacao/{token}`.
   - Botões novos por convite: **Reenviar** (com contador de envios) e **Copiar link** (fallback quando não há e-mail).
   - Lembrete automático (server fn `enviarLembretesCotacao`) para convites `pendente` faltando ≤ 3 dias; disparo manual + hook `/api/public/hooks/cotacao-lembretes` para cron diário.
   - Template curto reutilizando o helper de e-mail já existente em `src/lib/email.functions.ts` / `email-templates.ts`.

2. **Ranking, escolha do vencedor e mapa automático**
   - Na tela da cotação, mostrar tabela ranking (menor preço total por fornecedor entre os `preenchido`) com destaque do vencedor sugerido.
   - Botão **Gerar mapa (3 melhores)**: seleciona automaticamente os 3 menores totais válidos e chama `gerarMapaDaCotacao` (mantém seleção manual como fallback).
   - Nova coluna `cotacoes.orcamento_vencedor_id` + ação **Definir vencedor** (grava vínculo; travar após `finalizado`).
   - Sinalizar convites `expirado` (batch server fn atualizando status baseado em `expira_em`).

3. **Ponte cotação → evento financeiro (fecha o ciclo REO)**
   - Nova server fn `gerarEventoDaCotacao`: cria evento em `eventos_financeiros` como `rascunho`, com:
     - `natureza_despesa_codigo = "3.3.90.39.99"` e `cd_modalidade_compra = 101` (a regra que o usuário pediu antes já se aplica);
     - `mes_referencia`, `valor_previsto` = total do vencedor, `nm_favorecido`, `fornecedor_id`, `descricao` = objeto da cotação;
     - `metadata.origem = "cotacao"`, `metadata.cotacao_id`, `metadata.mapa_file_id`.
   - Anexo automático do mapa (`documentos_anexos`) e dos 3 orçamentos ao evento, para o merge do PDF de prestação já capturar tudo.
   - Botão **Lançar no financeiro** aparece quando há vencedor definido; leva ao evento criado no Painel Financeiro.

4. **Painel do escritório contábil (visão consolidada de cotações)**
   - Card em `/admin` mostrando cotações `coletando` com < 3 orçamentos preenchidos há > 7 dias (ação: reenviar convites).
   - Filtro por mês em `/admin/orcamentos` e badge de status por cotação (nº preenchidos / 3, vencedor definido, evento gerado).

### Detalhes técnicos

- **Migração**:
  - `ALTER TABLE cotacoes ADD COLUMN orcamento_vencedor_id uuid REFERENCES orcamentos_salvos(id) ON DELETE SET NULL, ADD COLUMN evento_financeiro_id uuid REFERENCES eventos_financeiros(id) ON DELETE SET NULL;`
  - `ALTER TABLE convites_cotacao ADD COLUMN envios_count int NOT NULL DEFAULT 1, ADD COLUMN ultimo_envio_em timestamptz DEFAULT now();`
  - Índice `idx_convites_pendentes_expira` em `(organization_id, status, expira_em)` para o lembrete.
  - Sem novas policies (usa `user_orgs`), mantendo `GRANT` já existentes.

- **Server functions novas** em `src/lib/convites.functions.ts` e `src/lib/cotacoes.functions.ts`:
  - `enviarConvite({ id })`, `reenviarConvite({ id })`, `enviarLembretesCotacao({ organization_id })`
  - `definirVencedor({ cotacao_id, orcamento_id })`, `gerarEventoDaCotacao({ cotacao_id })`, `atualizarStatusConvitesExpirados({ organization_id })`

- **Rota cron**: `src/routes/api/public/hooks/cotacao-lembretes.ts` autenticado por `apikey` (anon key) — agendado depois pelo usuário via pg_cron.

- **UI**: alterações somente em `/admin/cotacoes/$id` (ranking, botões) e `/admin/orcamentos` (badges/filtro). Reuso do `AdminShell`, sem novo design.

- **E-mail**: reaproveita `RESEND_API_KEY` já presente em connectors; template mínimo com identidade Approva.

### Fora de escopo

- Portal com múltiplos itens por fornecedor sem PDF (já existe).
- Assinatura digital dos orçamentos.
- Modelo de e-mail rico com anexo PDF (link basta nesta fase).
- Automação de compras diferente de modalidade 101 (fica para M4 quando entrar dispensa/inexigibilidade).

Se aprovar, começo pela migração + envio de e-mail dos convites, depois ranking/vencedor, e por último a ponte para o evento financeiro.