# Plano

## O que vou corrigir
A falha agora não está mais no ano. Pelas evidências do CSV e das prints, a transferência cadastrada no SIT é:

- Número SIT: `51530`
- Instrumento: `Termo de Colaboração - 001/2022`
- Concedente: `MUNICÍPIO DE MEDIANEIRA`
- Tomador: `SOCIEDADE CIVIL NOSSA SENHORA APARECIDA DE FOZ DO IGUAÇU`

No app, o arquivo está sendo gerado com:
- `tipo da transferência = 1` (`Termo de Convênio`)

Mas para `Termo de Colaboração`, o catálogo do próprio projeto indica:
- `tipo da transferência = 8`

Então a chave enviada hoje é incompatível com a transferência real do SIT.

## Implementação
1. Ajustar o default do termo em `src/routes/index.tsx` para usar `tpTransferencia: 8`.
2. Adicionar migração no carregamento do `localStorage` para corrigir automaticamente casos já salvos com:
   - `nrInternoConcedente = "001/2022"`
   - `nrCNPJConcedente = "76206481000158"`
   - `anoTransferencia = 2022`
   - `tpTransferencia = 1`
   para `tpTransferencia = 8`.
3. Atualizar os testes de `src/lib/sit/formatLinha.test.ts` para refletir a chave correta.
4. Regenerar o `.txt` mantendo os 38 lançamentos atuais e alterando apenas a 2ª coluna de `1` para `8`.
5. Entregar um novo arquivo versionado em `/mnt/documents/` para comparação e importação.

## Validação
- Verificar que cada linha segue com 24 campos.
- Conferir as primeiras e últimas linhas do novo arquivo para confirmar a chave:
  - CNPJ concedente `76206481000158`
  - tipo `8`
  - número interno `001/2022`
  - ano `2022`
- Rodar o teste focado do formatador SIT.

## Detalhes técnicos
- Evidência no CSV enviado:
  - linha `42`: `51530;Termo de Colaboração - 001/2022;MUNICÍPIO DE MEDIANEIRA;SOCIEDADE CIVIL NOSSA SENHORA APARECIDA DE FOZ DO IGUAÇU;...`
- Evidência no catálogo do projeto:
  - `TIPOS_TRANSFERENCIA`: `8 = Termo de Colaboração`
- Evidência no arquivo atual:
  - `Despesa_v2.txt` ainda começa com `76206481000158|1|001/2022|2022|...`

## Resultado esperado
O novo arquivo passará a usar a chave compatível com a transferência 51530 cadastrada no SIT, sem alterar os lançamentos de despesa.