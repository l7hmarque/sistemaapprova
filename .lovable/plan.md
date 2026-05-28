# Bloco 6 — Pendências SIT visíveis no painel

Apenas UI/cliente. Sem migrations, sem alterar captura, sem bloquear fechamento.

## 1. Helper de pendências reutilizável

Hoje `pendenciasSIT` vive em `src/lib/sit/inferCaptura.ts` e roda só na geração do TXT. Vamos expô-lo também para o painel.

- Já existe e funciona — só importar.
- Recebe: `{ tp_despesa, tp_documento_despesa, tp_doc_fav, nr_doc_fav, nm_favorecido, tp_documento_pagamento, data_pagamento, valor_efetivo }`.
- Retorna: `string[]` de campos faltantes (ex: `["tp despesa (REO)", "doc favorecido inválido: dígito verificador"]`).

## 2. Painel — `src/routes/admin.painel.tsx`

Na linha de cada evento, ao lado do `Badge` de `status_documental`:

- Calcular `pend = pendenciasSIT(e)` (memoizado por linha).
- Se `pend.length === 0` → nada extra (silêncio = ok).
- Se `pend.length > 0` → ícone `AlertCircle` (amber-500, h-3.5) dentro de um `Tooltip` do shadcn com a lista:
  ```
  Pendências SIT:
  • tp despesa (REO)
  • doc favorecido inválido
  • tp doc pagamento
  ```
- Contador no header da seção: `X de N prontos para SIT` (apenas informativo, ao lado de "Incompletos: …" que já existe).

## 3. Coerência com captura

Nada muda no `admin.captura.tsx`: o PDF único continua marcando `status_documental = "completo"`. O ícone de pendência SIT é independente do status documental — um evento pode estar "completo" (PDF anexado) e ainda ter pendências SIT (ex: `tp_despesa` não classificado), e o usuário vê isso explicitamente.

## 4. Fechamento

Sem alteração. O dialog de gerar prestação continua só avisando.

## Arquivos

- `src/lib/sit/inferCaptura.ts` — garantir `export` nomeado de `pendenciasSIT` (já existe).
- `src/routes/admin.painel.tsx` — importar `pendenciasSIT`, adicionar ícone+tooltip na lista de eventos, contador "prontos para SIT" no header.

Sem migration, sem novas dependências (Tooltip e lucide-react já em uso).
