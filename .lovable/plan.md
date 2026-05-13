## Problema
Após extração do PDF, os campos de revisão/edição na aba Despesas estão muito apertados (h-8/h-7, text-xs, text-[11px]), dificultando ver o conteúdo extraído (favorecido, descrição, categoria, doc, etc.).

## Mudanças (apenas UI em `src/routes/index.tsx`, função `DespesasTable`)

1. **Inputs de texto/data/número/select**: subir altura de `h-8` para `h-10` e usar `text-sm` (padrão), removendo o aperto visual.
2. **Campo Descrição** (sub-input do Favorecido): de `h-7 text-xs` para `h-9 text-sm` (cor levemente atenuada mantida).
3. **Coluna Categoria 2.4**: aumentar `text-[11px]` para `text-xs`/`text-sm` no código e nome, permitir até 3 linhas no nome (line-clamp-3) e aumentar largura da coluna de `w-[280px]` para `w-[320px]`.
4. **Larguras das colunas**: ajustar para acomodar conteúdo sem truncar:
   - Favorecido: garantir `min-w-[260px]`
   - CPF/CNPJ: `w-[180px]`
   - Doc nº: `w-[130px]`
   - Data pgto: `w-[150px]`
5. **Espaçamento das linhas**: adicionar `py-2` nas células para respirar.
6. **Scroll horizontal**: envolver `<Table>` em `<div className="overflow-x-auto">` para evitar quebra em telas menores agora que as colunas são mais largas.
7. **Botão remover**: subir de `h-7 w-7` para `h-9 w-9` para alinhar com a nova altura das linhas.

## Fora do escopo
- Lógica de extração, schema, regras de holerite, `formatLinhaSIT`, persistência — sem alterações.
- Aba Receitas e Categorias mantidas como estão (a queixa é específica de Despesas após upload do PDF).
