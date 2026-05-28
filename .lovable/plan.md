## Plano

Vou ajustar a página **Captura de documentos** para que cada PDF processado gere um lançamento real em `eventos_financeiros`, em vez de apenas tentar anexar o documento a um evento que já exista.

### O que será alterado

1. **Criar evento financeiro automaticamente**
   - Depois da IA extrair valor, data, CNPJ e descrição, a captura vai criar um registro em `eventos_financeiros` quando não encontrar um evento compatível.
   - O evento será criado com:
     - `organization_id` da organização ativa
     - `mes_referencia` baseado na data extraída ou no mês selecionado
     - `valor_previsto` e `valor_efetivo` com o valor extraído
     - `data_vencimento` e `data_pagamento` com a data extraída, quando existir
     - `categoria` inferida pelo tipo/descrição, com fallback seguro
     - `origem: "captura"`
     - `status_documental: "completo"`
     - `metadata` com os dados brutos da extração

2. **Vincular o anexo ao evento criado**
   - O upload continuará salvando o arquivo no bucket privado `documentos`.
   - O registro em `documentos_anexos` será criado com `evento_id` apontando para o evento novo ou para o evento já encontrado.

3. **Evitar dependência de evento pré-existente**
   - O status visual deixará de tratar documentos sem evento como “órfãos” quando a extração tiver dados mínimos para lançar.
   - Se a IA não encontrar valor/data/descrição suficientes, aí sim ficará como órfão para revisão manual.

4. **Corrigir rastreabilidade e recarregamento**
   - Após criar um evento novo, a lista local de eventos será atualizada para permitir vínculo/revisão na própria tela.
   - A mensagem da fila passará a indicar se o item foi “lançado automaticamente” ou “vinculado a evento existente”.

### Detalhes técnicos

- A mudança principal será em `src/routes/admin.captura.tsx`.
- Não será necessário mudar o schema do banco: a tabela `eventos_financeiros` já tem os campos necessários e RLS por organização.
- A inserção enviará `organization_id: activeOrgId` explicitamente para satisfazer a política RLS.
- Vou manter a tentativa de vínculo automático existente antes de criar um novo evento, para evitar duplicatas quando já houver um lançamento equivalente.