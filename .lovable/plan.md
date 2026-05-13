## Mudanças

### 1. Bordas dos cards (1px)
- No `<Card>` de cada despesa em `DespesasTable`: trocar `border-border/60` por `border-[1px] border-border` para obter a borda explícita de 1px solicitada.

### 2. Bordas dos campos (0.5px)
- Adicionar classe utilitária `border-[0.5px] border-border` em todos os campos editáveis dentro do card:
  - Inputs (ID, Data pgto, Favorecido, Descrição, CPF/CNPJ nº, Doc nº)
  - SelectTrigger (Tp doc, Tipo, Subtipo, Categoria 2.4)
  - NumberField (Valor) — adicionado via `className`
- Como o estilo padrão do shadcn já aplica `border` (1px), as classes acima sobrescrevem para 0.5px sem alterar o componente base.

### 3. Verificação dos campos (apenas leitura/diagnóstico)
Revisei os handlers — **estão íntegros e editáveis**:
- `Input` texto/data: `value` controlado, `onChange` chama `onUpdate(uid, { campo })`. OK.
- `Select` (Tp, Tipo, Subtipo, Categoria): `value` controlado, `onValueChange` atualiza estado. Tipo aciona reset coerente do subtipo. OK.
- `NumberField` (Valor): mantém `draft` em string para permitir apagar zero, vírgula intermediária e ponto. Comita ao blur. OK — sem bug conhecido.
- `onUpdate` mapeia por `uid` (não índice), seguro contra reordenação/remoção.
- Persistência via `localStorage` re-hidrata corretamente.

Nenhuma alteração de lógica é necessária. Apenas as classes de borda nos elementos da `DespesasTable` em `src/routes/index.tsx`.

## Fora do escopo
- Receitas, Categorias, header, upload, regras de holerite, schema, backend.
