# Plano consolidado — próximas frentes

## 1. Orçamentos — robustez

- **Rascunho automático** no `localStorage` (debounce 500ms) do formulário de orçamento. Restaura ao montar, limpa só após sucesso.
- **"Deixar em aberto":** nova coluna `orcamentos_salvos.status` (`aberto` | `gerado`). Lista de abertos em `/admin/orcamentos`, permite reabrir, editar e regerar planilha.
- **Renomear "despesa" → "despesa prevista"** em rótulos e payload (orçamento ≠ pagamento efetivado). Ajustar mapa/controle bancário.
- **Presets flexíveis:** aceitar preset "livre" (apenas nome + itens), sem forçar formato SIT. Editor com preview.

## 2. Login

- Email/senha + Google. Conta inicial: `l7hmarque@gmail.com`.
- Tabelas `profiles` + `user_roles` (enum `app_role`: admin, user) — padrão seguro.
- Migrar RLS atual (hoje liberada para `anon`) para `authenticated` + checagem por role.
- Rotas `/login`, `/reset-password`, layout `_authenticated`.

## 3. Cofre de Documentos Fiscais (nova frente — núcleo da nova prestação)

Tabela central que unifica documentos vindos do **Gmail** e de **uploads manuais**, com identificação consistente.

### 3.1 Modelo de dados

```text
documentos_fiscais
  id, mes_referencia
  tipo_documento      (boleto | nota_fiscal | fatura | holerite | comprovante_pgto)
  fornecedor_id (fk), fornecedor_nome_extraido
  cnpj_extraido
  numero_documento    (NF, linha digitável boleto)
  data_emissao, data_vencimento, data_pagamento
  valor
  arquivo_url         (Drive)
  arquivo_hash        (sha256 do PDF — chave de deduplicação)
  origem              (gmail | upload | bancario_manual)
  gmail_message_id    (nullable)
  despesa_id (fk)     (vínculo opcional com a despesa)
  status              (pendente_revisao | vinculado | orfão | ignorado)
  criado_em
```

### 3.2 Nomeação padronizada (no Drive)

Ao salvar/renomear: `{tipoDocumento}_{fornecedorSlug}_{dd-mm-aa}_{valor}.pdf`  
ex.: `boleto_sanepar_15-03-26_348,72.pdf  ---nao pode ter virgula no nome`

### 3.3 Deduplicação

- Hash SHA-256 do arquivo bloqueia duplicata exata.
- Match fuzzy (mesmo CNPJ + mesmo valor + mesma data ±2 dias + mesmo tipo) marca como "possível duplicata" para revisão.

## 4. Inbox Gmail

```text
Gmail → cron 15min → filtra anexos PDF → pipeline extract (já existe)
   → cria linha em documentos_fiscais (status: pendente_revisao)
   → UI /admin/inbox: revisar, vincular a despesa, lançar em lote
```

- Connector Gmail (decidir: conta única da OSC ou per-user OAuth). - per user
- Reusa `src/lib/extract/` para extrair tipo, valor, CNPJ, datas.
- Badge de pendentes no header.

## 5. Painel de Despesas — tabela de acompanhamento

Visão central por mês, formato tabela:


| Despesa               | Fornecedor | Valor  | Vencimento | Boleto | NF  | Comprov. pgto | Status            |
| --------------------- | ---------- | ------ | ---------- | ------ | --- | ------------- | ----------------- |
| Energia 03/26         | Copel      | R$ 412 | 10/03      | ✅      | n/a | ❌             | falta comprovante |
| Mat. limpeza          | Acme       | R$ 188 | 15/03      | ✅      | ✅   | ✅             | completa          |
| ⚠️ Possível duplicata | Sanepar    | R$ 348 | 15/03      | 2x     | —   | —             | revisar           |


- Cada linha = despesa; ícones mostram quais documentos do cofre estão vinculados.
- Alerta visual quando falta documento esperado para o tipo da despesa.
- Detecção de duplicidades aproveita o mesmo cruzamento (CNPJ + valor + data).
- Ações: anexar manualmente, abrir PDF, marcar "sem NF" (justificativa), agrupar duplicatas.
  &nbsp;
  --> LEMBRE-SE QUE PODE SER FATURA TAMBEM NO LUGAR DA NF! BEM COMO ALGUMAS DESPESAS  PODEM EXIGIR CERTIDOES NEGATIVAS, ORCAMENTOS E MAPA COMPARATIVO -> PRINCIPALMENTE COMPRAS FEITAS A PARTIR DE PESQUISA DE PRECO.

**Resposta direta:** sim, essa estrutura sustenta deteção de duplicidades — basta indexar por `(cnpj, valor, data, tipo)` e flagar conflitos no momento da inserção.

## 6. Comprovantes de pagamento bancários (impressos do financeiro)

**Problema:** chegam em papel, sem PDF nativo.

**Estratégia em camadas, do mais simples ao mais automático:**

### 6.1 MVP — digitalização em lote

- Tela "Importar comprovantes" aceita 1 PDF multipágina (scanner do financeiro escaneia tudo de uma vez) **ou foto pelo celular** (PWA, `<input capture>`).
- Sistema **divide automaticamente** em 1 comprovante por página.
- Para cada página: OCR (pdfjs se digital, Tesseract.js no browser ou pipeline IA atual se imagem) → extrai valor, data, favorecido, banco.
- Cria entradas em `documentos_fiscais` (tipo `comprovante_pgto`) e **tenta auto-vincular** à despesa correspondente (match por valor + data ±3 dias + nome favorecido).
- Não casou → fica órfão na tela para vínculo manual.

### 6.2 Médio prazo — captura por foto avulsa

- App PWA: financeiro tira foto do comprovante na hora do pagamento → upload direto → mesmo pipeline.

### 6.3 Futuro (não agora)

- Integração com Open Finance / extrato bancário (CNAB, OFX) para conciliar pagamentos sem precisar do papel. Fica para depois.

**Recomendação:** começar com 6.1 (scanner em lote + split automático + OCR + auto-vínculo). Resolve hoje sem mudar processo do financeiro.

## 7. Prestação de Contas modular

Mantida do plano anterior, agora alimentada pelo Cofre (3) e Painel (5):

- `prestacao_modelos`: estrutura configurável em seções ordenáveis (cada OSC tem o seu).
- Tipos de seção: documento_fixo, documento_recorrente, certidoes_institucionais, **comprovantes_fiscais** (gera automaticamente A4 com [comprovante + boleto + NF] por despesa, puxando do cofre), orcamentos_mapas, upload_livre.
- Documentos institucionais com validade extraída por IA + alerta de renovação.
- Geração final = merge de PDFs (pdf-lib) seguindo a ordem do modelo.
- **Certidões automáticas por CNPJ: adiadas** (você vai pensar em outra estratégia).

## 8. Ordem sugerida

1. Correções rápidas: rascunho + "deixar em aberto" + renomear "despesa prevista" + presets flexíveis.
2. Login + roles + RLS.
3. **Cofre de documentos fiscais** (3) — base de tudo que vem.
4. **Painel de Despesas** (5) — visão e deduplicação.
5. **Inbox Gmail** (4) — alimenta o cofre.
6. **Comprovantes em lote** (6.1) — fecha o ciclo de captura.
7. Prestação modular (7) — consome cofre + painel.

## Perguntas para destravar implementação

1. **Gmail:** 1 conta única da OSC (mais simples) ou cada usuário conecta a sua? -- CADA USUARIO CONECTA A SUA
2. **Drive:** pode reaproveitar a estrutura atual de pastas para o cofre, ou criar pasta nova `Cofre Fiscal / {ano} / {mês}`? NOVA
3. **Comprovantes bancários:** o financeiro topa escanear em lote no fim do dia/semana, ou a foto pelo celular é mais realista? TOPA ESCANEAR
4. **Login:** Google + email/senha está OK, ou só Google? ESTA OK

Por qual frente começamos?  
- ANALISE ESSAS IDEIAS, AVALIE E ME SUGIRA ALGO QUE POSSA SER MELHOR DO QUE ESTOU FALANDO, SEM ELEVAO DE CUSTOS E QUE SEJA BEM OTIMIZADO. ME ENTREGUE EM NOVO PLANO MAS SALVE ESSE COMO PLANO B SE EU NAO GOSTAR DO SEU