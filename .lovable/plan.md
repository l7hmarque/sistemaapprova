Três frentes independentes no fluxo financeiro / SIT.

## 1) Simplificar o ID interno (0001, 0002…)

Hoje o trigger `fn_eventos_financeiros_set_id_interno` gera `AAAAMM-NNNN` (ex.: `202607-0009`). Passa a gerar só o sequencial de 4 dígitos por org+mês (`0001`, `0002`, …).

- **Migration**: alterar a função para `NEW.id_interno := lpad(v_seq::text, 4, '0')`. Tabela `contadores_periodo` continua igual (chave org+mês). Registros existentes ficam como estão — nada é reescrito.
- **Formulário** (`_authenticated.admin.painel.tsx`): campo "ID interno" vira **read-only** com hint "gerado automaticamente (0001, 0002…)". Continua editável só via import histórico direto no banco.

> *Sobre o layout SIT:* o `nrDocumentoDespesa` (≤10 chars) exige um identificador único fornecido pela entidade — não é gerado pelo TCE. O sequencial mensal atende a essa regra de unicidade. Se dois eventos de meses diferentes tiverem o mesmo `0001`, ainda são únicos porque o TXT inclui `anoTransferencia` + `mês` no cabeçalho.

## 2) Ajustes de campos que você já pediu

- **Nº doc pagamento espelha Nº do documento**: no form, ao digitar `documento`, copia para `nr_documento_pagamento` enquanto o usuário não editou manualmente esse último. Mesmo default no `captura-processor.server.ts` ao criar o evento.
- **Modalidade default por REO**: quando `tp_despesa === 271` (REO 3.3.90.39.99) e `cd_modalidade_compra` estiver vazio → `101` (Pesquisa de Preços). Aplica no form e no captura-processor.

## 3) Tela de configuração de regras por despesa

Nova área em **Configurações → Regras de despesa** onde a organização cadastra automações que rodam quando um evento é criado/editado.

### Modelo de dados

Tabela `regras_despesa` (org-scoped, RLS por `organization_id`, GRANT authenticated + service_role):

| campo | tipo | uso |
|---|---|---|
| `nome` | text | rótulo livre ("DARF de INSS", "Holerite mensal") |
| `prioridade` | int | ordem de aplicação (menor = primeiro) |
| `ativo` | boolean | liga/desliga sem apagar |
| **Match (qualquer combinação)** |||
| `match_tp_despesa` | int? | REO específico |
| `match_tp_documento` | int? | tipo doc despesa (NF, DARF, GPS, holerite…) |
| `match_favorecido_regex` | text? | regex sobre o nome do favorecido |
| **Defaults aplicados quando bate o match (só preenche o que estiver vazio)** |||
| `set_cd_modalidade` | int? | modalidade compra |
| `set_tp_documento_pagamento` | int? | forma de pagamento |
| `set_tp_documento_favorecido` | text? | CPF / CNPJ / EXT |
| `set_nr_documento_favorecido` | text? | override fixo (DARF etc.) |
| `set_nm_favorecido` | text? | override fixo |
| `set_tp_despesa` | int? | força um REO |

### UI (`/admin/configuracoes/regras`)

- Tabela listando regras da org: nome · match (chips) · defaults (chips) · prioridade · ativo · editar/excluir.
- Botão "Nova regra" abre modal com:
  - Nome, prioridade, ativo.
  - Bloco "Quando…" (três selects opcionais + input regex).
  - Bloco "Aplicar…" (selects opcionais para cada default, usando os mesmos catálogos do form de edição).
- Botão "Testar" (opcional, fora do escopo desta entrega).
- Seed inicial da org já traz as três regras federais que hoje são hard-coded (`FAVORECIDO_OVERRIDES` do `catalogos.ts`): DARF, GPS, GFIP. A tabela `favorecidos_padrao` global continua funcionando como fallback do sistema.

### Aplicação das regras

- Helper `aplicarRegrasDespesa(evento, regras)` (`src/lib/sit/regrasDespesa.ts`) — itera as regras ativas em ordem de prioridade e preenche só os campos vazios; regras posteriores não sobrescrevem valor já definido.
- **Captura** (`captura-processor.server.ts`): depois da IA + favorecidos padrão, roda `aplicarRegrasDespesa`.
- **Form de edição** (`_authenticated.admin.painel.tsx`): ao mudar `tp_despesa` / `tp_documento_despesa` / `favorecido`, roda o mesmo helper no cliente (regras carregadas via server fn `listarRegrasDespesa`) — sugerindo os defaults sem sobrescrever o que o usuário já preencheu.

## Arquivos afetados

Novos:
- `src/lib/regras-despesa.functions.ts` — CRUD com `requireSupabaseAuth`.
- `src/lib/sit/regrasDespesa.ts` — matcher/aplicador puro (testável).
- `src/routes/_authenticated.admin.configuracoes.regras.tsx` — tela.
- Migration da tabela `regras_despesa` + alteração da função do ID interno + seed das 3 regras federais para orgs existentes.

Editados:
- `src/routes/_authenticated.admin.painel.tsx` — espelho de nº pagamento, default modalidade 101, ID interno read-only, aplicar regras.
- `src/lib/captura-processor.server.ts` — mesmos defaults + aplicar regras.
- `src/routes/_authenticated.admin.configuracoes.tsx` — link para a nova aba "Regras".

Sem mexer em: `favorecidos_padrao` global, snapshots, geração do TXT (o helper `formatLinhaSIT` já consome os campos do evento — as regras só mudam **o que** chega até ele).