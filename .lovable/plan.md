## Problema

Nos logs do servidor:

```
[api/extract] chamando IA — pdfBytes=45865439b, textLen=0
POST /api/extract → 502
```

O PDF tem ~46 MB e está sendo enviado inteiro como anexo binário (`type: "file"`) para o Lovable AI Gateway. O gateway/modelo rejeita/encerra a conexão (502) porque:

1. Excede o limite prático de payload multimodal do modelo.
2. Mesmo cabendo, o tempo de upload + processamento estoura o timeout da Edge/Worker.

Hoje só existe fallback se vier `text` no JSON — mas o front sempre manda `file`, então não há caminho de recuperação.

## Solução (sem quebrar nada que já funciona)

Dois ajustes complementares: **limite + pré-extração de texto no cliente** e **mensagem de erro decente** no servidor.

### 1. Extrair texto do PDF no cliente antes de enviar

No componente que faz upload em `/` (Home), trocar o envio bruto do `File` por:

- Ler o PDF com `pdfjs-dist` (já dá pra rodar no browser, sem instalar binários no Worker).
- Se a extração de texto resultar em conteúdo significativo (> ~500 chars), enviar como `application/json` com `{ text }` para `/api/extract` — caminho que já existe e funciona.
- Se o texto extraído for muito curto (PDF é escaneado/imagem), aí sim enviar o binário, mas:
  - apenas se `file.size <= 8 MB` (limite seguro para multimodal),
  - caso contrário mostrar mensagem clara: "PDF muito grande para análise por imagem (X MB). Limite: 8 MB. Sugestão: dividir o arquivo ou usar um PDF com texto selecionável."

Isso resolve 95% dos casos (PDFs de prestação de contas normalmente têm texto), sem mexer no pipeline determinístico nem nas regras de holerite.

### 2. Endurecer `src/routes/api/extract.ts`

- Adicionar guard no início do handler: se `pdfBytes && pdfBytes.byteLength > 8 * 1024 * 1024`, retornar 413 com mensagem amigável em vez de chamar a IA e estourar 502.
- No `catch`, tratar `statusCode` 502/504/413 com mensagem específica ("PDF muito grande ou demorou demais. Tente um arquivo menor ou cole o texto").

### 3. (Opcional, só se necessário) compressão

Se ainda assim alguns PDFs grandes-mas-com-texto falharem na extração local, dá pra adicionar um passo de "rasterizar página a página em JPEG" no cliente — mas só implemento se aparecer o caso. Por ora não é preciso.

## O que NÃO muda

- Pipeline determinístico (`reforcarComDeterministico`), schema, regras holerite, categorias, salvamento em `extracoes_salvas`, geração de `.txt`, planilhas, mapa comparativo — tudo intacto.
- A rota `/api/extract` continua aceitando `file` (caminho binário) para PDFs pequenos/escaneados.

## Detalhes técnicos

- Dependência nova: `pdfjs-dist` (browser-only, ~2 MB gzip, sem nativo). Worker fica de fora.
- Arquivo a editar no front: o componente de upload da Home (provavelmente `src/routes/index.tsx` ou um componente em `src/components/`). Confirmo ao implementar.
- Arquivo a editar no back: `src/routes/api/extract.ts` (guard + mensagens).

## Fases

1. Adicionar guard de 8 MB e mensagens de erro no servidor (5 min, já evita o 502 silencioso).
2. Instalar `pdfjs-dist` e extrair texto no cliente antes do POST (caminho principal).
3. Testar com o mesmo PDF de 46 MB.
