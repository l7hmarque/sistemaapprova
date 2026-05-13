## Mudanças (apenas em `DespesasTable`, `src/routes/index.tsx`)

### 1. Validação por card
Função local `isCompleta(d, precisaSub)` retorna `true` se TODOS os campos abaixo estão preenchidos:
- `idInterno` não vazio
- `data` (AAAA-MM-DD) preenchida
- `favorecido` não vazio
- `descricao` não vazia
- `nrDocFav` não vazio
- `documento` não vazio (e diferente de `"0"` opcional? — manter "preenchido" = não vazio)
- `valor > 0`
- `tipoDocumento` definido
- `subtipoDocumento` definido **somente se** `precisaSub`
- `categoria` não vazia

### 2. Borda do `<Card>` por status
- Completa: `border-[1px] border-emerald-500`
- Incompleta: `border-[1px] border-amber-500`

### 3. Bordas dos campos: preto sólido
- Substituir `border-[0.5px] border-border` por `border-[0.5px] border-black` em todos os Inputs, SelectTriggers e NumberField dentro do card.

## Fora do escopo
- Lógica de extração, regras de holerite, schema, exportação, demais abas. Apenas estilo/validação visual no card de despesa.
