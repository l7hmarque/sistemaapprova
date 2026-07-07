## 1. Excluir arquivos em `/admin/arquivos`

**Server (`src/lib/arquivos.functions.ts`)** — nova server function `excluirArquivoDaOrg({ fileId })`:

- Confirma que o arquivo pertence à org (usa a mesma checagem BFS + shortcut de `documentos_anexos`/`prestacao_documentos`).
- **Bloqueia** se o arquivo estiver vinculado a evento/documento em **prestação homologada** (snapshot não revogado) — devolve erro claro pedindo pra reabrir a prestação.
- Remove do Drive (`files.delete`) **e** limpa referências: `documentos_anexos.drive_file_id`, `prestacao_documentos.drive_file_id/arquivo_url` (marca como órfão), `drive_sync_queue` pendente.
- Registra em `audit_log`.

**UI (`src/routes/_authenticated.admin.arquivos.tsx`)**:

- Botão "Excluir" (ícone lixeira) ao lado do Download, com `AlertDialog` de confirmação mostrando nome + vínculos (badges já existentes).
- Se retornar erro de snapshot, toast com CTA "Reabrir prestação de {mes}".
- `queryClient.invalidateQueries(["arquivos"])` no sucesso.

---

## 2. REO Mensal Financeiro (itens 2.1 → 2.4)

### 2.1 Diagnóstico do que já temos vs. o que falta


| REO exige                                                                                           | Já temos                                                                                                        | Falta                                                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **2.1** Parcelas de repasse recebidas no mês (nº, valor, data)                                      | —                                                                                                               | tabela `repasses_recebidos`                                                                                                                                                                               |
| **2.2** Despesas do mês (código, favorecido, valor pago)                                            | `eventos_financeiros` já tem `id_interno`, `nm_favorecido`, `valor_efetivo`, `data_pagamento`, `mes_referencia` | ✅ direto                                                                                                                                                                                                  |
| **2.3** Saldo anterior, rendimentos, estornos, saldo próximo mês                                    | —                                                                                                               | tabela `movimento_bancario_mensal` (1 linha por mês, campos: saldo_anterior, rendimentos, estornos, observacao) — valor executado e transferido são calculados                                            |
| **2.4** Saldo por natureza da despesa (código 3.x.xx.xx.xx, previsto, gasto, estornado, disponível) | —                                                                                                               | (a) catálogo `naturezas_despesa` (código + descrição); (b) `plano_aplicacao` (por org + convênio + código = valor previsto anual/vigência); (c) coluna `natureza_despesa_codigo` em `eventos_financeiros` |


### 2.2 Schema novo (migração única)

```text
naturezas_despesa            → catálogo público (seed com os 30+ códigos do REO)
  codigo TEXT PK             ex: '3.3.90.30.07'
  descricao TEXT             ex: 'Gêneros de alimentação'
  grupo TEXT                 pessoal | material | servico | investimento

plano_aplicacao              → previsto por org/vigência
  organization_id, vigencia_inicio, vigencia_fim,
  natureza_codigo → naturezas_despesa,
  valor_previsto NUMERIC,
  UNIQUE(org, vigencia_inicio, natureza_codigo)

repasses_recebidos           → 2.1
  organization_id, mes_referencia, numero_parcela INT,
  valor NUMERIC, data_recebimento DATE, convenio TEXT NULL

movimento_bancario_mensal    → 2.3 (o que não sai de eventos)
  organization_id, mes_referencia (UNIQUE),
  saldo_anterior NUMERIC, rendimentos NUMERIC,
  estornos_extra NUMERIC,      -- estornos que não são reversão de evento
  observacao TEXT

eventos_financeiros          → +2 colunas
  natureza_despesa_codigo TEXT NULL  → FK naturezas_despesa
  valor_estornado NUMERIC DEFAULT 0  → para 2.4 coluna "estornado"
```

Regras: para cada tabela → GRANT authenticated + service_role, RLS por `organization_id` via `user_orgs(auth.uid())`, `touch_atualizado_em`. `naturezas_despesa` fica com GRANT SELECT anon (catálogo público read-only).

### 2.3 Enriquecimento automático de eventos

- Estender `regras_despesa` com um novo campo `set_natureza_codigo` para que a inferência já existente (favorecido/regex/tp_despesa) atribua a natureza correta na captura.
- Fallback manual: campo select no modal de edição de despesa em `/admin/prestacao` e `/admin/aprovacoes`.
- Job de retro-classificação (server fn `reclassificarEventosSemNatureza`) para eventos antigos.

### 2.4 Nova página `/admin/reo`

Rota `src/routes/_authenticated.admin.reo.tsx`:

- Seletor de mês (default = mês corrente da prestação).
- **Card 2.1** — tabela editável de parcelas recebidas no mês (add/remove).
- **Card 2.2** — tabela read-only de despesas do mês (link p/ evento).
- **Card 2.3** — form: saldo_anterior (auto-preenchido do mês anterior = saldo_anterior + transferido + rendimentos − executado − estornos), rendimentos, estornos, observação. Saldo do próximo mês calculado.
- **Card 2.4** — pivô por `natureza_despesa_codigo`: Previsto (do plano_aplicacao vigente) | Gasto (soma acumulada no ano) | Estornado | Disponível. Alerta amarelo em códigos com < 5% de saldo, vermelho se estourou.
- Botão **"Gerar REO em PDF"** — reusa a infra atual de `prestacao.functions.ts` (jsPDF/pdf-lib) com layout idêntico ao exemplo enviado (cabeçalho da OSC, seções 2.1–2.4, assinatura do gestor).
- Snapshot do REO salvo em `prestacoes_snapshot.manifest` (nova chave `reo`) para versionamento junto da prestação.

### 2.5 Configuração inicial (setup wizard)

Nova aba no `/admin/configuracoes` → **"Plano de Aplicação"**:

- Import via planilha (colunas: código, descrição, previsto) — usa `modelos_planilha` existente.
- Vigência (ex.: 01/2026 → 12/2026).
- Convênio/parceria vinculada (texto livre por ora).

Seed das `naturezas_despesa` (migração) com os códigos do PDF de exemplo (3.1.90.11.01 … 4.4.90.52.99).

---

## Ordem de execução

1. Migração (schema + seed naturezas).
2. Server fn `excluirArquivoDaOrg` + UI botão excluir.
3. Coluna `natureza_despesa_codigo` no formulário de despesa + regra `set_natureza_codigo`.
4. Página `/admin/configuracoes/plano-aplicacao`.
5. Página `/admin/reo` (cards 2.1–2.4 + PDF).
6. Item no sidebar admin: "REO Mensal" (abaixo de Prestação).

## Fora de escopo (proponho pra depois)

- Seção 1 do REO (execução do objeto, metas físicas) — o PDF mostra que existe, mas você pediu "item 2.0 em diante".
- Assinatura digital do PDF final.
- Integração com sistemas municipais (SIT-Confaz/SIM-AM) — só exportar o PDF já resolve a entrega.

## Perguntas rápidas antes de codar

1. **Plano de aplicação** já vem pronto do convênio (você tem uma planilha modelo?) ou o usuário digita manualmente na primeira vez? Uusario digita manualmente
2. **Rendimentos** e **saldo anterior** entram manualmente (mensal) ou você quer suporte a import de extrato bancário OFX/CSV? Ambos
3. Para o **2.4**, os totais são **acumulados no ano/vigência** (é o padrão do exemplo) ou você quer também uma visão "só do mês"? Nao entendi essa pergunta