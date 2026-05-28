## 1. Substituição do termo "Termo de Fomento" → "Repasses públicos"

Aplicar substituição contextual (não literal cega) nos arquivos:

- **src/routes/index.tsx**
  - Title SEO: `"Approva — Prestação de contas de repasses públicos (TCE-PR)"`
  - Hero copy linha 85: `"Prestação de contas dos seus repasses públicos sem fricção."`
  - Alt do screenshot linha 118: trocar "Termo de Fomento 042/2025" por "Repasse público — Convênio 042/2025" (mantém número fictício para parecer real).
- **src/routes/contadores.tsx** e **src/routes/gestores.tsx**: rg confirmou que não há ocorrência hoje, mas vou reler para garantir coerência de tom.
- **src/routes/showcase.$screen.tsx** linha 122: subtitle vira `"Visão geral · Convênio 042/2025"`.
- **src/lib/sit/catalogos.ts** linha 43: **mantenho** "Termo de Fomento" — é o catálogo oficial SIT/TCE-PR (código 9 da tabela), não pode mudar senão quebra a integração. Adiciono comentário explicando.
- **src/routes/api/extract.ts** linha 11: mantenho menção técnica no system prompt da IA (`"Termos de Fomento (TCE-PR / padrão SIT)"`) porque guia a extração — é instrução interna, não copy visível.

Também vou varrer outras menções a "Fomento" sozinho na pasta `src/routes/` e ajustar onde for copy de marketing.

## 2. Limpeza de dados da CAIA Medianeira

Org `7dd64567-d248-4feb-9cdb-c38efc9be901`. Opção escolhida: **apagar tudo exceto a organização, membros e configurações**.

Tabelas a esvaziar (apenas registros dessa org):
- eventos_financeiros (3)
- prestacao_documentos (0)
- documentos_anexos (0)
- prestacoes_snapshot (2)
- extracoes_salvas (0)
- orcamentos_salvos (11)
- cotacoes (1)
- convites_cotacao (2)
- eventos_agenda (0)
- audit_log (0)
- fornecedores (5)
- objetos_cotacao (3)
- modelos_planilha (0)
- cotacao_presets (0)
- orcamento_presets (0)

Tabelas/registros **preservados**:
- `organizations` (a OSC em si: nome, CNPJ, tipo, plano, status, trial)
- `organization_members` (vínculos de usuários)
- `user_roles` (papéis super_admin etc.)
- `configuracoes` da org
- Arquivos no bucket `documentos` / `prestacoes` — **não toco** (sem registro no DB ficam órfãos, mas não atrapalham; se quiser limpar storage também, me avise).

Ordem de execução: deletar primeiro filhos lógicos (convites_cotacao → cotacoes; prestacao_documentos → prestacoes_snapshot) para evitar qualquer constraint, depois o resto. Executo via `supabase--insert` (que aceita DELETE) com WHERE `organization_id = '7dd64567-...'` em cada tabela.

## Ordem sugerida

1. Substituições de copy (item 1) — edição direta dos arquivos.
2. DELETEs da CAIA (item 2) — uma chamada agrupada.

Após executar, confirmo contagens zeradas e mostro as telas de copy ajustadas.
