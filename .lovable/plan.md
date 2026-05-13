## Atualizar Execução Orçamentária com a planilha de saldoCategoriaEcon (03/26)

### O que muda

1. **`src/lib/sit/catalogos.ts`** — atualizar `previsto` de todas as 30 categorias com os valores da planilha enviada e adicionar uma nova exportação `CATEGORIA_GASTO_BASELINE` (mapa `codigo → valor já gasto até 03/2026`).

   Exemplos da atualização:
   - `3.1.90.11.01` previsto 1.802.789,73 → **2.048.283,54**, baseline gasto **1.599.241,59**
   - `3.3.90.39.99` previsto 514.659,87 → **613.811,68**, baseline gasto **367.525,82**
   - (e assim para as 30 linhas; coluna "Valor Estornado" é % de execução, será ignorada)

2. **`src/routes/index.tsx` — `CategoriasTable`**: o cálculo do **Gasto** efetivo passa a ser `baseline + soma das despesas lançadas no app`, em vez de só a soma das despesas. Saldo continua `previsto − gasto`. Overrides manuais existentes (Previsto/Gasto/Saldo + botão ↺) continuam funcionando por cima desse novo default.

3. **Persistência**: nada novo a salvar — os valores ficam no código (commitados). As despesas que você lançar continuam somando em cima do baseline automaticamente. O botão "Limpar" segue limpando apenas receitas/despesas/overrides do usuário, **sem mexer no baseline**.

### Não muda

- Pipeline de IA, geração do `Despesa.txt` SIT, schema, layout das abas Receitas/Despesas, botões "Copiar tabela", localStorage atual.
- Aba "Execução Orçamentária" continua editável célula a célula como já está.

### Detalhe técnico

```ts
// catalogos.ts
export const CATEGORIA_GASTO_BASELINE: Record<string, number> = {
  "3.1.90.11.01": 1599241.59,
  // ...
};
```

```ts
// CategoriasTable
const gastoCalc = (CATEGORIA_GASTO_BASELINE[c.codigo] ?? 0) + (gastoDespesas.get(c.codigo) ?? 0);
const gastoEfetivo = override?.gasto ?? gastoCalc;
```
