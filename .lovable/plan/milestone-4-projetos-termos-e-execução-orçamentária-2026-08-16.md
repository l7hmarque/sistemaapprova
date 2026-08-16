## Milestone 4 — Projetos/Termos e Execução Orçamentária

Hoje o campo `termo` existe como texto solto em `eventos_financeiros`, `cotacoes`, `orcamentos_salvos`, `repasses_recebidos` e `plano_aplicacao`. Isso impede saldo por projeto, relatórios filtrados por termo de fomento/convenio e a visão consolidada que escritórios contábeis precisam. Este milestone transforma o termo em uma entidade real com execução orçamentária.

### Escopo

1. **Entidade Projeto/Termo**
   - Nova tabela `projetos` com: nome, número do termo/convenio, órgão concedente, objeto, valor total aprovado, vigência (início/fim), status (ativo/encerrado/cancelado).
   - Backfill automático: cada valor distinto do campo `termo` nas tabelas existentes vira um projeto ativo.
   - Adicionar `projeto_id` em `eventos_financeiros`, `cotacoes`, `orcamentos_salvos`, `repasses_recebidos` e `plano_aplicacao`.
   - Migrar os vínculos do texto para a nova FK via backfill.

2. **CRUD e seleção de projeto**
   - Tela `/admin/projetos` para listar, criar, editar e encerrar projetos.
   - Seletor de projeto nos formulários de evento financeiro, cotação, orçamento, repasse e plano de aplicação.
   - Sugestão automática de projeto baseada no termo digitado (autocomplete).

3. **Execução orçamentária por projeto**
   - Card/página de detalhe do projeto mostrando:
     - Total aprovado vs repassado vs executado vs saldo.
     - Gasto por natureza de despesa (REO).
     - Próximos repasses esperados.
   - Server fn `resumoExecucaoProjeto({ projeto_id })`.

4. **Filtros nos relatórios existentes**
   - REO Mensal: filtro por projeto.
   - Painel financeiro: filtro por projeto.
   - Prestação de contas: opcionalmente filtrar documentos e eventos por projeto.

5. **Visão do escritório contábil**
   - No `EscritorioDashboard`, adicionar card "Projetos sem execução recente" e "Projetos com saldo crítico".
   - Permite trocar de contexto para a OSC e projeto diretamente.

### Fora de escopo

- Controle físico de metas/projeto (indicadores, beneficiários).
- Assinatura digital de termos.
- Integração com sistemas de repasse externos (ex.: SICONV).

### Detalhes técnicos

- **Migração**: criação de `projetos`, colunas `projeto_id`, backfill e políticas RLS.
- **Server functions**: `src/lib/projetos.functions.ts` com CRUD e resumo.
- **UI**: nova rota `/admin/projetos` e alterações em `/admin/painel`, `/admin/reo`, `/admin/prestacao`, `/admin/cotacoes/$id`.
- **Escritório**: ajuste em `src/components/admin/EscritorioDashboard.tsx`.

Se aprovar, começo pela migração + backfill, depois CRUD e seleção, e por último os dashboards de execução.