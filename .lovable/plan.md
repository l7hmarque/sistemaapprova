# Reescrita do `Despesa.txt` para o layout SIT (24 campos)

Com o Apêndice A em mãos, todos os domínios necessários estão resolvidos. Falta só você confirmar 4 valores do termo (que não vivem no PDF do extrato) antes de eu codar.

## O que muda

### 1. `src/lib/sit/formatLinha.ts` — reescrita completa

Saída passa de 12 para **24 campos**, separados por `|`, terminando em `|`, conforme layout oficial:

```
nrCNPJConcedente | tpTransferencia | nrInternoConcedente | anoTransferencia |
tpDespesa | tpDocumentoFavorecido | nrDocumentoFavorecido | nmFavorecido |
tpDocumentoDespesa | nrDocumentoDespesa | vlDocumentoDespesa | dtDocumentoDespesa |
dsPlacaVeiculo | nrQuilometragemVeiculo | nrEmpenho | dtEmpenho |
cdModalidadeCompra | nrProcessoCompra | dtProcessoCompra |
tpDocumentoPagamento | nrDocumentoPagamento | dtEmissaoPagamento |
dtDebito | dsItemDespesa |
```

Regras de formatação (do PDF de layout):

- Datas → `DD-MM-AAAA` (não mais ISO).
- Valores → `0.00` (mantém).
- `dsPlacaVeiculo` e `nrQuilometragemVeiculo` → vazios (não é veículo).
- `dsItemDespesa` ≤ 2000 chars, sem acentos/pipes (regra atual reaproveitada).
- `nmFavorecido` ≤ 250.
- `nrDocumentoDespesa` ≤ 10 e `nrDocumentoPagamento` ≤ 15.
- Overrides de favorecido para tipos 6/7/9/10/20/23 (Apêndice A item 16 — ampliado: GR/PR=SEFA-PR, GRRF e GFD=Caixa).

### 2. `src/lib/sit/catalogos.ts` — novas tabelas auxiliares

Adicionar, extraídas direto do Apêndice A:

- `MODALIDADES_COMPRA` (10 códigos: 1,2,3,6,7,8,9,11,100,101).
- `TIPOS_DOC_PAGAMENTO` (7 códigos: Cheque, OB, Depósito, DOC, TED, Débito, PIX).
- `TIPOS_TRANSFERENCIA` (1, 5, 7, 8, 9).
- `TIPOS_DOC_DESPESA` ampliada (substitui `TIPOS_DOCUMENTO` atual de 8 itens pelos 23 oficiais), com CNPJ/nome de override embutidos.
- Mapa `CATEGORIA_TO_TPDESPESA: Record<string, number>` derivado da tabela tpDespesa do Apêndice A (ex.: `"3.3.90.30.07" → 60`, `"3.1.90.11.01" → 5` etc.). Cobre todas as ~30 categorias do app.

### 3. `src/routes/index.tsx` — UI mínima de termo

Adicionar 4 campos no topo da tela de revisão (persistidos em `localStorage`), preenchidos uma vez por usuário:

- CNPJ do concedente (com máscara)
- Tipo de transferência (select dos 5 do Apêndice A)
- Nº interno do termo
- Ano da transferência

Adicionar nas linhas de despesa 3 selects novos (com defaults sensatos):

- Modalidade de compra (default = `100` Tributos/Pessoal para holerite/guias, `8` Dispensa para o resto).
- Tipo de documento de pagamento (default = `7` PIX).
- Tipo de despesa derivado automaticamente da `categoriaCodigo` via `CATEGORIA_TO_TPDESPESA`; se faltar mapeamento, mostrar aviso vermelho na linha.

`dtEmissaoPagamento` e `nrDocumentoPagamento` reaproveitam por padrão a data e número do documento da despesa (editáveis).

### 4. `src/lib/sit/formatLinha.test.ts` — atualizar

Reescrever os 8 testes para o novo shape (24 campos, datas DD-MM-AAAA, novos overrides).

## Fora do escopo

Extração de PDF, regras de holerite, persistência online, autenticação, outras abas, layout SIM-AM.

## Preciso de você antes de começar

4 valores do **termo de transferência** (são constantes do convênio, não saem do extrato):

1. **CNPJ do concedente** (14 dígitos, ex.: município que repassou). = **76.206.481/0001-58**
2. **Tipo de transferência** — `1` Convênio · `5` Parceria · `7` Contrato de Gestão · `8` Colaboração · `9` Fomento. = 1 Convenio
3. **Nº interno do termo** no concedente (até 20 chars, ex.: "001/2026"). = 001/2022
4. **Ano da transferência** (4 dígitos, ex.: 2026). = 2026

Defaults que vou assumir (me corrija se quiser outro):

- Separador `|`, encoding ANSI (Windows-1252), quebra CRLF — iguais aos atuais.
- Modalidade default `100` (Tributos/Pessoal) para holerite/guias e `8` (Dispensa) para o resto.
- Pagamento default  6 debito em conta.