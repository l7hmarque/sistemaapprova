## Diagnóstico

A tabela `configuracoes` tem chave primária composta `(organization_id, chave)` e `organization_id NOT NULL`. Porém, tanto em `/admin/configuracoes` quanto no wizard `/admin/setup`, o `upsert` envia só `{ chave, valor }` e usa `onConflict: "chave"`. Resultado:

- INSERT falha por violação de NOT NULL em `organization_id`.
- `onConflict` sequer bate com a PK correta, então nem sobrescreve linhas existentes.

Por isso salvar o link do TEMPLATE — Prestação de Contas dispara "Erro ao salvar".

## O que fazer

1. **Buscar organização atual no carregamento** de `/admin/configuracoes` (usando `organization_members` já filtrado por RLS via `auth.uid()`), guardar em estado.
2. **Enviar `organization_id` em todos os upserts** de `configuracoes` e usar `onConflict: "organization_id,chave"`.
3. **Filtrar o SELECT inicial por `organization_id`** para não vazar/misturar configs entre orgs.
4. Aplicar a mesma correção em:
   - `src/routes/_authenticated.admin.configuracoes.index.tsx` (template, alertas, auto-vínculo)
   - `src/routes/_authenticated.admin.setup.tsx` (helper `salvar` do wizard — mesmo bug)
5. Se algum upsert falhar, mostrar `error.message` no toast (hoje o toast diz só "Erro ao salvar", escondendo a causa).

Sem mudanças de schema, RLS, ou lógica de negócio — apenas o payload dos upserts e o filtro do select.

## Verificação

- Colar URL do Google Docs no campo Template → clicar Salvar → toast "Configurações salvas".
- Recarregar a página → o campo continua preenchido com o ID.
- Repetir para alertas e auto-vínculo.
- Repetir no wizard `/admin/setup` (passos Docs/Sheets).
