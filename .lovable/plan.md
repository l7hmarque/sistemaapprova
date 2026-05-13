## Problema
A tabela de Despesas tem 10 colunas — mesmo com inputs maiores, "Doc nº", "Favorecido", "Categoria 2.4" continuam apertados/cortados.

## Solução
Substituir a `<Table>` por uma **lista de cards**, um card por despesa, com campos organizados em grid de 2 linhas. Assim cada campo ocupa largura adequada e nada fica cortado.

## Layout do card (cada despesa)

```text
┌──────────────────────────────────────────────────────────────────┐
│ [ID]   [Data pgto]                                       [🗑]    │
│                                                                   │
│ Favorecido (full width) ─────────────────────────────────────     │
│ Descrição (full width) ──────────────────────────────────────     │
│                                                                   │
│ [Tp][CPF/CNPJ        ]  [Tipo doc        ]  [Subtipo      ]      │
│ [Doc nº            ]  [Categoria 2.4 (wide) ──────] [Valor R$]   │
└──────────────────────────────────────────────────────────────────┘
```

- Grid responsivo: `grid grid-cols-12 gap-3`.
- Favorecido e Descrição: `col-span-12` (linha cheia, nome completo visível).
- CPF/CNPJ: `col-span-4`; Tipo: `col-span-4`; Subtipo: `col-span-4`.
- Doc nº: `col-span-3`; Categoria: `col-span-6` (com nome em até 2 linhas, fonte `text-sm`); Valor: `col-span-3`.
- Cada campo com `<Label>` pequeno acima do input.
- Inputs: `h-10 text-sm`. Categoria: `min-h-12` com nome `text-sm line-clamp-2`.
- Header de cada card: ID compacto + Data pgto + botão remover.

## Mudanças
- `src/routes/index.tsx` — reescrever apenas o `return` do `DespesasTable` (e o estado vazio) para renderizar `<div className="space-y-3">` com cards `<Card>`/`<CardContent>` em vez de `<Table>`.
- Remover imports não usados (`Table*`) **somente** se não forem usados em outras tabelas — verificar antes (Receitas e Categorias ainda usam `Table`, então manter).

## Fora do escopo
- Aba Receitas, aba Categorias, header, upload, regras de holerite, schema, backend.
