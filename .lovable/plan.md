## Mudanças propostas em `src/routes/index.tsx`

### 1. Limpar dados atuais da Execução Orçamentária

- Adicionar estado `overrides` (Map por código de categoria) salvo no `localStorage` junto com receitas/despesas, contendo `{ previsto?, gasto?, saldo? }` por linha.
- Inicializar vazio (sem dados pré-carregados além do catálogo). O botão "Limpar" existente também zera os overrides.

### 2. Edição/inserção de Previsto, Gasto e Saldo

- Em `CategoriasTable`, transformar as células Previsto/Gasto/Saldo em campos editáveis usando o `NumberField` já existente.
- Comportamento:
  - **Previsto**: default = valor do catálogo; editável; salva override.
  - **Gasto**: default = somatório calculado das despesas (`gasto.get(codigo)`); editável manualmente sobrescreve.
  - **Saldo**: default = `previsto - gasto`; se editado, vira valor fixo; botão "↺" por linha para voltar ao calculado.
- Adicionar linha extra no final para **inserir nova categoria** (código + descrição + previsto), armazenada em `categoriasExtras` no estado/localStorage.
- Totais no rodapé recalculam com os valores efetivos (override quando houver).

### 3. Copiar tabela (Receitas / Despesas / Execução Orçamentária)

- Novo helper `copyTableTSV(rows: string[][])` que monta TSV (tab-separated) — formato que cola corretamente em Google Sheets e em tabelas do Google Docs.
- Botão "Copiar tabela" (ícone `Copy` do lucide) no cabeçalho de cada uma das três abas, ao lado do título da seção. Toast de confirmação.
- Conteúdo copiado por aba:
  - **Receitas**: Parcela, Data, Valor.
  - **Despesas**: Data, Favorecido, Documento, Tipo, CPF/CNPJ, Categoria (código — descrição), Valor.
  - **Execução Orçamentária**: Código, Descrição, Previsto, Gasto, Saldo (valores formatados em BRL com vírgula decimal).

### Não muda

- Pipeline de extração via IA, geração do `Despesa.txt` SIT, validações e schema permanecem intactos.
- Persistência atual em `localStorage` é estendida (mesma chave `sit-tcepr-state-v1`) com dois campos novos: `overrides` e `categoriasExtras`. Hidratação trata ausência como vazio (compatível com salvamentos antigos).

### Detalhes técnicos

- `NumberField` já aceita valor controlado e `onCommit`; reutilizado nas três colunas.
- Cópia: `navigator.clipboard.writeText(tsv)` com fallback `document.execCommand("copy")` se indisponível.
- Tipos: `type CategoriaOverride = { previsto?: number; gasto?: number; saldo?: number }`, `type CategoriaExtra = { codigo: string; nome: string; previsto: number }`.