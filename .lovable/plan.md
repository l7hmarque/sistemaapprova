# Plano A (revisado) — mais simples, mais barato, mesmo resultado

Avaliei o plano anterior (mantido como **Plano B**) e identifiquei 4 oportunidades de otimização sem perder funcionalidade:


| Problema no Plano B                                                                | Solução no Plano A revisado                                                              |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 3 entidades separadas (despesa, documento_fiscal, comprovante) com joins complexos | **1 entidade única: "Evento Financeiro" com anexos 1:N**                                 |
| Toda extração via IA → custo cresce linear                                         | **Pipeline em camadas: hash → OCR local → IA leve → IA pro** (90% nunca chega na IA pro) |
| Prestação modular configurável já no MVP                                           | **1 modelo bem feito agora, modular fica para V2**                                       |
| Comprovantes só por scanner em lote                                                | **Scanner em lote + foto pelo celular** (mesmo pipeline, custo zero a mais)              |


---

## 1. Núcleo: Evento Financeiro (unifica Cofre + Painel + Despesa)

Em vez de 3 tabelas, **uma só** com anexos:

```text
eventos_financeiros
  id, mes_referencia
  fornecedor_id, categoria (energia | agua | salario | compra_eventual | servico ...)
  descricao
  valor_previsto, valor_efetivo
  data_vencimento, data_pagamento
  origem (orcamento | manual | gmail | foto)
  status_documental  -- CALCULADO: completo | faltando | divergente | duplicata_suspeita
  prestacao_snapshot_id  -- nullable; preenchido quando mês é fechado

documentos_anexos
  id, evento_id (fk), tipo (boleto | nf | fatura | holerite | comprovante_pgto | orcamento | mapa | certidao)
  arquivo_url, arquivo_hash (sha256)
  cnpj_extraido, valor_extraido, data_extraida, numero_extraido
  origem, gmail_message_id (nullable)
  criado_em
```

**Ganho:** o Painel é só `SELECT * FROM eventos_financeiros`. O Cofre é só `SELECT * FROM documentos_anexos`. Mesma fonte de verdade. Detecção de duplicata vira `UNIQUE(cnpj, valor, data, tipo)` parcial + alerta.

### Status documental automático por categoria

Configurável por OSC, mas com defaults inteligentes:


| Categoria                           | Docs esperados                                |
| ----------------------------------- | --------------------------------------------- |
| Energia / água / internet           | boleto + comprovante                          |
| Salário                             | holerite + comprovante                        |
| Serviço recorrente                  | NF + comprovante                              |
| Compra eventual / pesquisa de preço | 3 orçamentos + mapa + NF/fatura + comprovante |


O sistema avisa o que falta sem o usuário decorar.

---

## 2. Captura unificada (3 origens, 1 pipeline)

```text
[Gmail OAuth user]   [Upload manual]   [Foto celular / Scanner lote]
         \                |                       /
          \               v                      /
           →→→  fila: documentos_pendentes  ←←←
                          ↓
              pipeline extração em camadas
                          ↓
               auto-vínculo a evento
                          ↓
              [vinculado | duplicata | órfão]
```

### Pipeline de extração em camadas (otimização principal de custo)

```text
1. hash SHA-256       → já existe? reusa metadados      (grátis, instantâneo)
2. OCR cliente        → pdf.js text extract             (grátis, ~80% dos PDFs digitais)
3. IA Flash Lite      → classifica + estrutura JSON     (~R$ 0,003/doc, padrão)
4. IA Pro             → só se Flash falha               (~R$ 0,05/doc, raro)
```

Cache por hash bloqueia reprocessamento. **OSC pequena (~50 docs/mês) ≈ R$ 1–3 de IA por mês.**

### Auto-vínculo (regra simples, sem ML)

```sql
match WHERE evento.fornecedor_cnpj = doc.cnpj_extraido
  AND ABS(evento.valor_previsto - doc.valor_extraido) <= 0.50
  AND doc.data_extraida BETWEEN evento.vencimento - 3d AND evento.vencimento + 3d
```

Casou → vincula. Não casou → fica órfão na fila para revisão. Mais de um match → marca duplicata.

---

## 3. Gmail (otimização: filtro por label, sem polling pesado)

Em vez de cron lendo a caixa inteira:

- Usuário cria label no Gmail (ex: `OSC/contas`)
- Cria filtro: "anexo PDF + remetente conhecido" → aplica label
- Nosso cron lê **só mensagens com aquela label** (`q=label:OSC/contas is:unread`)
- Marca como lida após processar

**Resultado:** poucas chamadas à API, respeita privacidade, e o usuário escolhe o que entra. Per-user OAuth confirmado.

---

## 4. Captura por foto (PWA)

Para comprovantes impressos:

- Componente câmera com `<input capture="environment">` (sem app nativo)
- Resize cliente para 1024px + JPEG 80% → 10x menos bytes na IA
- Upload em fila com indicador de progresso
- Auto-vínculo igual ao pipeline acima

**Caso de uso real:** financeiro entrega lote de comprovantes impressos → assistente tira 30 fotos em sequência → sistema vincula automaticamente 25 e deixa 5 para revisão manual.

Bonus: o mesmo componente serve para "scanner em lote" (1 PDF multipágina → split automático por página → processa cada página como doc independente).

---

## 5. Prestação V1 — 1 modelo, alimentado pelo Painel

Sem `prestacao_modelos` ainda. **Um modelo fixo bem feito**, com seções na ordem padrão:

1. Documentos institucionais fixos
2. Documentos institucionais recorrentes
3. Comprovantes fiscais (gerados automaticamente do Painel: para cada evento, monta página A4 com comprovante + boleto + NF/fatura)
4. Orçamentos + mapas comparativos do mês
5. Upload livre (anexos extras)

Geração = merge `pdf-lib` na ordem. Snapshot imutável (hash + manifest) salvo em `prestacoes`. Reabrir mostra exatamente o que foi entregue.

**Prestação modular configurável → V2**, quando o usuário disser "preciso de outro modelo".

---

## 6. Quick wins (manter do Plano B)

Esses entram primeiro porque são baratos e resolvem dor imediata:

- Rascunho automático no localStorage (debounce)
- Botão "Deixar em aberto" (status no `orcamentos_salvos`)
- Renomear "despesa" → "despesa prevista" em orçamentos
- Preset livre (sem formato SIT obrigatório) MAS QUE VAI SER INCLUSO NO .TXT SIT NO FORMATO SIT

---

## 7. Login (igual ao Plano B)

Email/senha + Google. `profiles` + `user_roles` + RLS por role. Sem mudanças.

---

## 8. Ordem de execução revisada


| #   | Frente                                                     | Por quê primeiro                             |
| --- | ---------------------------------------------------------- | -------------------------------------------- |
| 1   | Quick wins (rascunho, "em aberto", rename, presets livres) | Resolve dor já hoje, baixo risco             |
| 2   | Login + roles + RLS                                        | Pré-requisito de tudo que vem depois         |
| 3   | **Evento Financeiro + Painel**                             | Núcleo — sem isso, captura não tem onde cair |
| 4   | Captura: upload manual + foto/scanner com auto-vínculo     | Cobre 80% do problema sem depender de Gmail  |
| 5   | Gmail OAuth (label-filtered)                               | Automatiza o que sobrou                      |
| 6   | Prestação V1 (1 modelo, geração por snapshot)              | Fecha o ciclo                                |
| 7   | Prestação modular configurável                             | Só quando precisar                           |


---

## 9. Custos estimados (OSC pequena, ~50 docs/mês)


| Item                                               | Custo/mês                |
| -------------------------------------------------- | ------------------------ |
| Lovable AI (Gemini Flash Lite + cache + OCR local) | R$ 1–3                   |
| Drive / Sheets                                     | já incluso               |
| Gmail API                                          | grátis (dentro da quota) |
| Hosting                                            | já pago                  |
| **Total incremental**                              | **~R$ 3**                |


Crescimento linear: 500 docs/mês ≈ R$ 15. Continua barato.

---

## 10. O que CORTAR do Plano B (para simplificar)

- ❌ Cofre + Painel como entidades separadas → ✅ Evento Financeiro unificado  
- ❌ Prestação 100% modular no MVP → ✅ 1 modelo bem feito + modular em V2  
- ❌ IA em todo doc → ✅ Hash + OCR local primeiro, IA só quando precisa  
- ❌ Cron Gmail varrendo caixa inteira → ✅ Cron lê só mensagens com label

---

## Comparação rápida


| &nbsp;                        | Plano B (anterior)                   | Plano A revisado        |
| ----------------------------- | ------------------------------------ | ----------------------- |
| Entidades centrais            | 3 (despesa, documento_fiscal, anexo) | 1 (evento + anexos 1:N) |
| Custo IA/mês (50 docs)        | R$ 10–30                             | R$ 1–3                  |
| Prestação configurável no MVP | sim                                  | só V2                   |
| Captura por foto              | "médio prazo"                        | desde o MVP             |
| Detecção duplicata            | hash + fuzzy                         | igual                   |
| Auto-vínculo                  | sim                                  | sim, mais central       |
| Linhas de código estimadas    | ~3500                                | ~2200                   |


---

## Pergunta única para destravar

Topa esse Plano A revisado? Se sim, começo pelo item 1 (quick wins) imediatamente, já que são edits pequenos e isolados. Plano B fica salvo aqui em `.lovable/plan.md` para referência se mudarmos de ideia.