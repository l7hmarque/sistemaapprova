Dois ajustes independentes no fluxo financeiro.

## 1) Um evento por documento dentro do PDF

Hoje o worker de captura instrui a IA a **consolidar** todos os documentos do arquivo em um único JSON (linhas 34–51 de `src/lib/captura-processor.server.ts`). O resultado é um único evento no painel com valor somado.

Mudanças em `src/lib/captura-processor.server.ts`:

- Ajustar o `SYSTEM` prompt para pedir uma **lista** de documentos:
  - Instruir a IA a identificar cada documento separado (holerite de cada funcionário, cada NF, cada boleto, cada comprovante) e retornar `{ "documentos": [ {…}, {…} ] }`.
  - Cada item mantém os mesmos campos atuais (`tipo`, `cnpj`, `valor`, `numero`, datas, `descricao`, `forma_pagamento`, `numero_pagamento`) e ganha `paginas: [n, …]` para referência.
  - Regra explícita: quando o PDF traz o documento + seu comprovante de pagamento juntos, consolidar em um único item (mantém o comportamento atual para esse caso). Só separar quando forem despesas distintas.
- Substituir `parseDados` por `parseListaDados` que devolve `Dados[]`. Aceitar também o formato antigo (objeto único) como fallback → array de 1.
- No `processarCapturaJob`, após extrair a lista:
  - Se vazia → tratar como hoje (1 evento "revisar" com dados nulos).
  - Para cada `Dados` da lista, executar o bloco atual de "fornecedor → tentar vínculo → criar evento → anexo", em série. O mesmo arquivo do Storage é anexado a todos os eventos criados (mesmo `arquivo_hash`, mesma `signed URL`); a dedup por hash passa a considerar apenas o **primeiro** item — os demais do mesmo PDF não são marcados como duplicata.
  - Contabilizar `eventosCriados`, `eventosVinculados` para gravar em `captura_jobs.mensagem`/`resultado` no final.
- Fallback para modelo `gemini-2.5-pro` continua, mas agora dispara quando a lista vier vazia **ou** quando todos os itens parecerem vazios.

Fora do escopo: cortar o PDF em subarquivos por documento; dividir o anexo por páginas.

## 2) Exclusão de evento não sumia da tela

O trigger `fn_eventos_financeiros_soft_delete` cancela o DELETE físico e apenas preenche `excluido_em`. As telas hoje não filtram por `excluido_em IS NULL`, então o evento reaparece ao recarregar.

Mudanças:

- `src/routes/_authenticated.admin.painel.tsx` (`recarregar`): adicionar `.is("excluido_em", null)` no `select`.
- Mesma correção nos outros locais que listam `eventos_financeiros` para consumo direto do usuário: `src/routes/_authenticated.admin.captura.tsx` (contagem/lista de eventos do mês) e `src/lib/captura-processor.server.ts` na busca `eventos` usada para auto-vínculo (não vincular a eventos já excluídos).
- Não mexer no trigger nem no botão — o soft delete continua sendo a fonte da verdade.

## Detalhes técnicos

- Novo tipo `type ListaDocs = { documentos: Dados[] }`. `chamarIA` retorna `Dados[]`; `parseListaDados` cuida do JSON.
- Loop de criação reaproveita variáveis já resolvidas por documento (categoria, SIT, fornecedor). `fornEncontrado` é resolvido por item — CNPJs diferentes viram fornecedores diferentes.
- Filtro `excluido_em IS NULL` é aplicado no client (Supabase JS `.is("excluido_em", null)`), sem migração.
