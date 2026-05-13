## Objetivo
Corrigir o gerador do `Despesa.txt` para eliminar o erro `número de campos inválidos` no SIT, preservando os lançamentos já salvos e reaplicando a correção sobre eles na próxima exportação.

## O que encontrei
- O arquivo enviado (`Despesa_2.txt`) está saindo com **24 pipes**, o que vira **25 tokens** para parsers que contam o campo vazio final.
- Sem o pipe final, cada linha fica com **24 campos reais**, que é o total esperado pelo layout implementado hoje.
- O gerador atual em `src/lib/sit/formatLinha.ts` sempre retorna `campos.join("|") + "|"`, então o erro estrutural acontece em **todas as linhas**.
- Os lançamentos atuais já estão persistidos no navegador; dá para **manter tudo salvo** e apenas corrigir a serialização do TXT.

## Plano
1. **Ajustar o serializador do SIT**
   - Remover o campo vazio implícito no fim da linha.
   - Manter a ordem atual dos 24 campos e os formatos já corretos (datas, decimais, textos limpos).

2. **Atualizar a validação automatizada**
   - Corrigir os testes de `formatLinhaSIT` para validar o formato aceito pelo SIT.
   - Garantir que cada linha exportada tenha exatamente os 24 campos esperados pelo importador.

3. **Preservar os lançamentos já salvos**
   - Não alterar a estrutura do estado salvo das despesas.
   - Aplicar a correção apenas no momento da exportação, para que os lançamentos atuais continuem disponíveis e gerem um novo `.txt` válido.

4. **Validar com o arquivo real**
   - Comparar a nova saída com o `Despesa_2.txt` enviado.
   - Confirmar contagem de campos em todas as linhas e revisar os casos com campos vazios para não introduzir novas inconsistências.

## Detalhes técnicos
- Arquivos-alvo prováveis:
  - `src/lib/sit/formatLinha.ts`
  - `src/lib/sit/formatLinha.test.ts`
- A correção principal deve ser trocar a montagem final da linha para não produzir o token vazio extra no final.
- Como os dados já ficam salvos localmente, não preciso migrar banco nem apagar nada para reaproveitar os lançamentos atuais.

## Resultado esperado
Ao clicar em exportar novamente, o app vai gerar um novo `Despesa.txt` usando os mesmos lançamentos já salvos, mas agora com a estrutura de campos compatível com o SIT.