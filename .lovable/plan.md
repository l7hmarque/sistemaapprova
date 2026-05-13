## Aplicar regras de Holerite (aba `regrasHolerite`) antes das tabelas e do `.txt`

### Onde aplicar

Em `src/routes/api/extract.ts`, **logo após** o `extracaoSchema.parse(parsed)` e **antes** do `return Response.json(...)`. A regra incide uma única vez, central, e tudo que vem depois (tabela 1.2 Despesas, Execução Orçamentária, geração do `Despesa.txt`) já recebe os dados corrigidos.

### Quais despesas são afetadas

Toda despesa em que `sugestaoCategoria === "3.1.90.11.01"` (Vencimentos e salários — holerites/folha).

### Regra 1 — `documento` (Nº NF/Doc Fiscal)

Padrão fixo `MM/AA`, **idêntico** para todos os holerites do mês:

- **MM** = mês de referência − 1, com zero-padding (2 dígitos). Se ref. = `01`, MM = `12`.
- **AA** = últimos 2 dígitos do ano de referência (com zero-padding).
- Exemplo: prestação de `03/2026` → `02/26` para **todos** os holerites.

### Regra 2 — `dataEmissao` (`AAAA-MM-DD`)

- **MM** = `(mesReferencia − 2)` com wrap para o ano anterior se necessário.
- **DD** = último dia desse mês (cobre fev/bissexto via `new Date(y, m, 0).getDate()`).
- **AAAA** = ano resultante após o wrap.
- Exemplo: prestação de `03/2026` → `2026-01-31`. Prestação de `02/2026` → `2025-12-31`.

A `data` (data de pagamento) **não é alterada** — fica como a IA extraiu do comprovante de pagamento.

### Implementação

Novo arquivo `src/lib/sit/regrasHolerite.ts`:

```ts
import type { ExtracaoResultado } from "@/lib/extract/schema";

export function aplicarRegrasHolerite(extracao: ExtracaoResultado): ExtracaoResultado {
  const m = extracao.mesReferencia.match(/(\d{1,2})\/(\d{4})/);
  if (!m) return extracao;
  const mm = Number(m[1]);
  const aaaa = Number(m[2]);

  // Documento: MM = mês anterior, AA = últimos 2 dígitos do ano (mesmo valor para todos)
  let mDoc = mm - 1;
  let yDoc = aaaa;
  if (mDoc <= 0) { mDoc += 12; yDoc -= 1; }
  const documento = `${String(mDoc).padStart(2, "0")}/${String(yDoc % 100).padStart(2, "0")}`;

  // dataEmissao: MM = ref - 2, DD = último dia, AAAA = ano correspondente
  let mEm = mm - 2;
  let yEm = aaaa;
  if (mEm <= 0) { mEm += 12; yEm -= 1; }
  const ultimoDia = new Date(yEm, mEm, 0).getDate();
  const dataEmissao =
    `${yEm}-${String(mEm).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;

  const despesas = extracao.despesas.map((d) =>
    d.sugestaoCategoria === "3.1.90.11.01"
      ? { ...d, documento, dataEmissao }
      : d,
  );
  return { ...extracao, despesas };
}
```

Em `src/routes/api/extract.ts`:

```ts
import { aplicarRegrasHolerite } from "@/lib/sit/regrasHolerite";
// ...
const validated = extracaoSchema.parse(parsed);
return Response.json(aplicarRegrasHolerite(validated));
```

### O que NÃO muda

- Schema Zod, prompt da IA, layout das abas, `formatLinhaSIT`, persistência no `localStorage`, baseline de Execução Orçamentária.
- Despesas que não são salário passam intactas.
- Edição manual posterior em Despesas continua prevalecendo (regra só roda no momento da extração).

### Edge cases

- Ref. `01/AAAA` → documento `12/(AA-1)`, data emissão `(AAAA-1)-11-30`.
- Ref. `02/AAAA` → documento `01/AA`, data emissão `(AAAA-1)-12-31`.
- Anos bissextos cobertos automaticamente.