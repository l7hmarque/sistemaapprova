## Objetivo
Fazer a captura identificar dados do PDF de forma confiável — valor, fornecedor/CNPJ, data, número e descrição — mesmo quando o PDF não tem texto selecionável ou quando a extração local vem vazia/fraca.

## Diagnóstico
O fluxo atual em `admin.captura` só envia o PDF para a IA quando consegue extrair texto útil no navegador. Se o PDF for escaneado/imagem, ou se o `pdfjs` extrair pouco texto, o sistema cai direto em `{ descricao: nome do arquivo, tipo: outro }`, sem mandar o PDF original para análise visual. Além disso, a função de IA da captura usa uma chamada manual ao gateway com header incorreto/legado, enquanto o projeto já tem o helper correto via AI SDK.

## Plano de implementação
1. **Aceitar PDF bruto na função de extração**
   - Atualizar `src/lib/captura.functions.ts` para aceitar `pdfBase64` além de `texto` e `imagemBase64`.
   - Enviar PDF como arquivo multimodal para Lovable AI quando a extração por texto for ruim ou ausente.

2. **Trocar a chamada manual de IA pelo padrão correto do projeto**
   - Usar `createLovableAiGatewayProvider` + `generateText` do AI SDK.
   - Manter retorno JSON no mesmo formato atual (`tipo`, `cnpj`, `valor`, `data`, `numero`, `descricao`).
   - Usar modelo multimodal para PDF/imagem e fallback mais forte quando vier vazio.

3. **Melhorar o critério de “texto útil”**
   - Em `src/routes/admin.captura.tsx`, considerar ruim quando o PDF extrai texto muito curto ou quase sem letras/números.
   - Nesses casos, enviar o PDF original em base64 para análise visual, em vez de desistir.

4. **Preservar o lançamento no painel financeiro**
   - Mesmo se a IA ainda não conseguir todos os campos, continuar criando o evento financeiro para revisão manual.
   - Quando a extração vier parcial, gravar os campos encontrados e marcar revisão apenas para o que faltar.

5. **Adicionar mensagens de status mais claras**
   - Mostrar quando o sistema está tentando leitura visual do PDF.
   - Se voltar sem valor/fornecedor, indicar que o documento foi lançado para revisão, não que “não processou”.

## Resultado esperado
Ao capturar o mesmo PDF, o sistema tentará primeiro texto selecionável e depois leitura visual do PDF inteiro. Isso deve permitir identificar automaticamente valores e fornecedor em boletos, notas, faturas e PDFs escaneados, e ainda lançar no painel financeiro para revisão quando houver incerteza.