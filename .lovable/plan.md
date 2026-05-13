## Diagnóstico

Validei o checksum dos dois CNPJs do `Despesa_v4.txt`:


| Linha | Favorecido                       | CNPJ no arquivo      | Checksum                                                                                                                                                                                                                       |
| ----- | -------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 30    | MITRA DIOCESANA DE FOZ DO IGUACU | `77.945.152/0001-91` | ✅ válido (formato), mas o **/0001-91 não corresponde a nenhuma filial registrada** dessa razão social — as filiais conhecidas são `/0002-72`, `/0023-05`, `/0032-98` etc. O SIT consulta a Receita e rejeita CNPJ inexistente. |
| 34    | SANEPAR                          | `76.484.013/0001-46` | ❌ **checksum inválido**. O CNPJ correto da Sanepar é `76.484.013/0001-45`.                                                                                                                                                     |


Ou seja: a IA de extração inventou/leu errado os dois CNPJs. O Sanepar é correção determinística (`...46` → `...45`). O da Mitra precisa do número da paróquia certa do recibo de aluguel (qual paróquia recebeu o aluguel?), porque "Mitra Diocesana" tem várias filiais e a matriz `/0001-91` aparentemente não existe.

## Pergunta antes de gerar v5

Preciso confirmar o CNPJ correto da Mitra (linha 30, Recibo 17 - Aluguel R$ 2.500). Algumas possibilidades comuns em Foz:

- Paróquia São João Batista — `77.945.152/0002-72`
- Paróquia Catedral N. Sra. de Guadalupe — `77.945.152/0023-05`
- Paróquia N. Sra. do Perpétuo Socorro — `77.945.152/0032-98`
- Outra (informar) = 77945152000191

## Plano de correção (após confirmação)

1. **Gerar `/mnt/documents/Despesa_v5.txt**` com Python, mantendo as 38 linhas e ANSI/Win-1252:
  - Linha 30: trocar coluna 7 do CNPJ da Mitra para o correto.
  - Linha 34: trocar `76484013000146` → `76484013000145` (Sanepar).
2. **Hardening no app** (`src/lib/sit/`):
  - Criar `src/lib/sit/cnpjValidator.ts` com a função `isValidCNPJ` (algoritmo oficial dos 2 dígitos verificadores) — testada em `cnpjValidator.test.ts`.
  - Em `formatLinhaSIT`, quando `tpDocumentoFavorecido === "CNPJ"` e o CNPJ falhar no checksum, **lançar erro** com a linha/favorecido para impedir gerar arquivo inválido.
  - Adicionar override fixo da Sanepar em `catalogos.ts` (igual aos overrides DARF/GPS/GFIP) para o caso `nmFavorecido` contendo "SANEPAR" → CNPJ `76484013000145`. Evita repetir o erro em meses futuros.
3. **Validação na UI** (`src/routes/index.tsx`): ao salvar/editar despesa com tipo CNPJ, marcar campo inválido em vermelho e bloquear o botão "Gerar Despesa.txt" enquanto houver CNPJ inválido. Toast lista as linhas problemáticas.
4. **Teste** (`formatLinha.test.ts`): novo caso garantindo que CNPJ com checksum quebrado dispara erro.
5. **Verificar** com `vitest`.

Posso seguir com esse plano assim que você me disser qual paróquia da Mitra usar na linha 30.