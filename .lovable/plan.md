## Diagnóstico

O SIT não rejeitou mais o **layout** do arquivo (não há mais "número de campos inválidos") — agora ele rejeita a **chave da transferência**:

```
Tomador: 1788362000151 · Concedente: 76206481000158
Número Interno: 001/2022 · Ano: 2026 · Tipo: 1
```

As 4 primeiras colunas de cada linha do `Despesa.txt` atual são:

```
76206481000158 | 1 | 001/2022 | 2026
```

O **Número Interno é 001/2022**, mas o **Ano da Transferência** está sendo enviado como `2026` (ano do exercício/competência da despesa). Pelo padrão SIT/TCE-PR, o campo `anoTransferencia` é parte da **chave primária** da transferência e precisa ser o **ano de celebração do termo**, que é **2022** (mesmo ano do número interno). Daí a mensagem "Não existe Transferência associada às chaves informadas".

Observação: o "Tomador" não vem do `.txt` (o arquivo só tem CNPJ do Concedente) — o SIT deriva o Tomador do usuário/contexto do upload, então não há nada a corrigir ali pelo nosso lado.

## Correção

1. Em `src/routes/index.tsx`, alterar o default do termo:
   - `TERMO_DEFAULT.anoTransferencia: 2026` → **`2022`**
2. Em `src/lib/sit/formatLinha.test.ts`, ajustar `anoTransferencia: 2022` para refletir a chave correta.
3. **Manter intactos** os 38 lançamentos salvos (nada na tabela de despesas muda — o ano da transferência é constante do termo, não da despesa).
4. Como o valor fica em `localStorage` (`sit-tcepr-termo-v1`) e o navegador do usuário já tem `2026` salvo, a UI do "Dados do Termo" precisa refletir o novo valor:
   - Adicionar uma migração leve no `useEffect` de hidratação: se `anoTransferencia === 2026` **e** `nrInternoConcedente === "001/2022"`, sobrescrever para `2022` (uma única vez, segura). Isso evita pedir para o usuário limpar o storage manualmente.
5. Regenerar o `Despesa.txt` corrigido a partir do conteúdo atual (mesmas 38 linhas, trocando apenas a 4ª coluna `2026` → `2022`) e entregar como artefato `Despesa_v2.txt` em `/mnt/documents/`.

## Validação

- Rodar `formatLinha.test.ts` (Vitest) para confirmar que o novo default de ano não quebra nada.
- Inspecionar as 3 primeiras e 3 últimas linhas do novo `.txt` para garantir que apenas o 4º campo mudou e que o total continua 24 colunas por linha.
- Conferir que o arquivo segue em ANSI (Windows-1252) e com `\r\n`.

## Se ainda assim o SIT rejeitar

Se o ano de celebração do termo **não for 2022** (por exemplo, o termo foi assinado em outro ano e só o número interno reaproveita "2022"), o usuário precisa abrir no SIT a tela de **Transferências cadastradas** e copiar exatamente os 4 valores da chave (CNPJ Concedente, Tipo, Nº Interno, Ano). O card "Dados do Termo (constantes do arquivo SIT)" no app já permite ajustar todos eles e regerar o `.txt` sem mexer nas despesas.

## Arquivos afetados

- `src/routes/index.tsx` (default do termo + migração de localStorage)
- `src/lib/sit/formatLinha.test.ts` (atualizar fixture)
- `/mnt/documents/Despesa_v2.txt` (artefato regenerado)
