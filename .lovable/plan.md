# Nova landing page do Approva — só o que o sistema faz de verdade

## O problema com a página atual

A home promete coisas que o Approva não faz: "arquivo no formato oficial do TCE-PR com um clique", "exportação para o controle municipal", "pronto para o TCE-PR". Não existe nenhuma integração ou envio direto para TCE ou SIT — o que existe é organização dos dados e geração de relatórios/PDFs que a pessoa usa para preencher e entregar onde precisar. Isso sai da página inteira (home, textos, FAQ e dados estruturados).

## O que realmente existe no app (base da nova página)

Confirmado nas telas do sistema:

- **Captura de documentos por leitura automática** — envio de PDF com vários documentos dentro (NF, boleto, holerite, comprovante); cada documento vira uma despesa separada, com fornecedor, valor e datas já preenchidos para conferência.
- **Painel financeiro mensal** — todas as despesas do mês, o que já tem comprovante e o que falta, filtro por mês e por projeto.
- **Fila de aprovações** — revisão da despesa antes de fechar o mês, com registro de quem aprovou e devolução com motivo.
- **Prestação de contas em PDF único** — junta o documento-modelo, as certidões cadastradas e todos os comprovantes das despesas do mês em um arquivo só, com sumário. Certidões com validade longa reaparecem sozinhas nos meses seguintes até vencer.
- **Relatório REO mensal** — repasses, classificação das despesas, resumo bancário e execução (previsto x realizado) em PDF.
- **Projetos/termos com saldo** — quanto foi aprovado, repassado, executado e quanto sobra em cada convênio ou termo.
- **Cotações e mapa comparativo** — pedido de orçamento enviado por e-mail ao fornecedor, comparação de preços, mapa comparativo gerado e despesa criada a partir do vencedor.
- **Cadastro de fornecedores e regras de despesa** — o sistema aprende a classificação por fornecedor/tipo e repete sozinho.
- **Arquivos** — todos os documentos do ano organizados por seção, com download.
- **Vários clientes no mesmo login** — escritório contábil alterna entre OSCs sem misturar dados, com convite de equipe por e-mail.
- **Histórico e trilha** — registro de edições, exclusões e aprovações.

Nada além disso entra na página.

## Estrutura da nova home

1. **Topo (hero)** — linguagem simples: "Organize as despesas da sua OSC e feche a prestação de contas do mês em um PDF só." Botões: começar teste grátis / ver planos. Imagem real do sistema.
2. **Para quem é** — dois blocos claros e separados, logo no início:
   - *Gestor ou financeiro de OSC*: parar de montar pasta, saber o que falta de comprovante, ver saldo do termo.
   - *Escritório de contabilidade*: várias OSCs no mesmo login, mês padronizado, aprovar e baixar o pacote do cliente.
   Cada bloco leva às páginas `/gestores` e `/contadores`.
3. **Como funciona em 3 passos** — enviar documentos → conferir e aprovar → gerar o PDF da prestação. Com as capturas de tela já existentes.
4. **O que o sistema faz** — cards das funcionalidades reais listadas acima, escritos em linguagem do dia a dia (sem "rubrica", "lastro auditável", "homologação").
5. **Seção separada por público** — duas colunas com os ganhos específicos de OSC e de escritório contábil, sem misturar.
6. **Perguntas frequentes** — reescritas e honestas, incluindo explicitamente: "O Approva envia dados direto ao TCE ou ao SIT?" → não; o sistema organiza e gera os relatórios e o pacote de documentos que você usa na entrega.
7. **Planos + chamada final** — mantidos como estão hoje.

Também ajusto `/gestores` e `/contadores` para remover as mesmas promessas de integração e manter a separação de público coerente com a home.

## SEO

- Título e descrição focados em termos que as pessoas realmente pesquisam: prestação de contas de OSC, prestação de contas do terceiro setor, sistema para OSC, organização de documentos de convênio, mapa comparativo de orçamentos. (A pesquisa de volume mostra nicho pequeno e concorrência baixa — vale mirar termos longos e específicos, sem inflar promessa.)
- Um único H1, H2/H3 hierárquicos por seção, HTML semântico.
- Dados estruturados corrigidos: Organization, WebSite, SoftwareApplication e FAQPage refletindo só funções reais, sem menção a integração com órgão de controle.
- Canonical, og/twitter tags com a imagem real do produto, alt descritivo em todas as imagens, lazy loading fora do topo.
- Links internos da home para `/gestores`, `/contadores`, `/demonstracao` e o blog.

## Detalhes técnicos

- Edição principal em `src/routes/index.tsx` (conteúdo, head, JSON-LD).
- Revisão de texto em `src/routes/gestores.tsx` e `src/routes/contadores.tsx`.
- Reuso dos componentes existentes: `MarketingLayout`, `PlanCards`, `FaqAccordion`, `FluxoMensal` (o infográfico de fluxo será revisado se citar envio ao TCE/SIT).
- Nenhuma mudança de banco, backend ou funcionalidade — só conteúdo e marcação da página pública.
