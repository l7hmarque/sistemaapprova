## Plano de execução

### 1. Super admin "Ver como" (impersonação visual)
- Novo hook `useViewAs()` com contexto React + persistência em `localStorage` (`approva.viewAs = "super_admin" | "osc" | "escritorio" | "membro"`).
- Wrapper em `useCurrentUser` que devolve `effectiveRole` e `effectiveOrgType` derivados do viewAs **apenas quando** `isSuperAdmin === true`. Permissões reais no banco continuam intactas — é só camada de UI.
- Componente `<ViewAsSwitcher/>` no rodapé da sidebar admin (visível só para super_admin): dropdown com 4 opções + badge "Visualizando como OSC" no topo quando ativo.
- Sidebar, dashboard, menu e telas leem `effectiveRole` para mostrar/ocultar itens; super_admin real nunca perde acesso porque pode trocar de volta a qualquer momento.

### 2. Cores por contexto (híbrido)
Mantém Navy Trust como base e adiciona:
- **Cor-âncora por módulo** (tokens em `src/styles.css`): Dashboard=navy, Orçamentos=âmbar, Cotações=índigo, Fornecedores=teal, Objetos=ciano, Modelos=violeta, Prestação=verde, Aprovações=roxo, Agenda=rosa, Captura=laranja, Painel financeiro=esmeralda, Analytics=slate, Configurações=neutro.
- Aplicada em: borda esquerda do header da página (4px), ícone ativo na sidebar, accent de botões primários da página, hover/badge.
- **Paleta semântica reforçada**: `--success`, `--warning`, `--danger`, `--info`, `--pending` com versões `-soft` para fundos de badge. Usada em todos os status (pago/pendente/atrasado, aprovado/rejeitado, etc.) de forma consistente em todas as páginas.
- Refactor de `AdminShell` para receber `module` prop e injetar a cor-âncora automaticamente.

### 3. Escritório → OSCs (consolidado + switcher)
- **Dashboard do escritório** (nova rota `/admin` quando `org.tipo === "escritorio"`): grid de cards, um por OSC filha, com KPIs do mês (prestação fechada %, eventos pendentes, próximo vencimento, alertas). Clicar entra no contexto daquela OSC.
- **Workspace switcher no header admin**: dropdown sempre visível para contas escritório, lista o próprio escritório + todas OSCs filhas, troca via `setActiveOrg(orgId)` persistido em `localStorage`. `current_user_org()` no banco continua válido; o front filtra queries por `organization_id` ativo.
- `useCurrentUser` ganha `activeOrgId` controlado pelo switcher + lista de orgs acessíveis (escritório + filhas via `parent_organization_id`).

### 4. Remover Analytics de não-super_admin
- Em `src/components/admin/sidebar.tsx`: filtrar o item "Analytics" para mostrar só quando `isSuperAdmin === true` (e respeitando viewAs).
- Em `src/routes/admin.analytics.tsx`: `beforeLoad` redireciona para `/admin` se não for super_admin.

### 5. Screenshots reais nas landings
- Criar org demo "Instituto Exemplo" com dados fictícios coerentes (3 fornecedores, 2 cotações, 1 prestação fechada, 5 eventos financeiros, agenda do mês). Seed via migration `INSERT` numa org marcada `nome = 'DEMO — Instituto Exemplo'`.
- Logar como super_admin com viewAs=OSC, capturar via browser tool em viewport desktop (1440×900) as telas: dashboard, orçamento aberto, prestação do mês, aprovações, captura, painel financeiro. Salvar PNGs em `src/assets/screens/`.
- Substituir as 3 imagens atuais (`preview-upload`, `preview-revisao`, `preview-relatorio`) por screenshots reais coerentes com o texto de cada bloco em `/` , `/contadores`, `/gestores`. Legendas curtas embaixo de cada print explicando o que está sendo mostrado.
- og:image de cada landing usa o screenshot principal da própria página.

### 6. Mobile polish
- **Landings**: revisão de `SiteHeader` (menu hambúrguer já existe? validar), tipografia fluida (`clamp()`), grids 1-coluna < 768px, screenshots com `aspect-ratio` fixo, CTAs full-width no mobile.
- **App interno**: sidebar admin vira drawer < 1024px (botão hambúrguer no topo), tabelas com `overflow-x-auto` + versão card no mobile para listas críticas (orçamentos, prestação, aprovações), formulários em 1 coluna, modais ocupam tela toda < 640px.
- Teste em 375×812, 414×896 e 768×1024 antes de fechar cada página.

### 7. Documentação dos modelos de planilha
- Nova página `/admin/modelos/ajuda` (e link "Como preparar meu modelo?" na tela de modelos) explicando, por tipo:
  - **Orçamento**: aba única, cabeçalho até linha N, primeira linha de item, colunas obrigatórias (descrição, qtd, valor unit, valor total), linha de totais, marcadores de célula que o sistema preenche (`{{FORNECEDOR}}`, `{{CNPJ}}`, `{{DATA}}`).
  - **Mapa Comparativo**: estrutura de colunas por fornecedor, linha de menor preço, fórmulas que NÃO devem ser sobrescritas.
  - **Controle Bancário**: colunas data/histórico/débito/crédito/saldo, formato de data, separador decimal.
- Exemplos visuais (screenshots de planilha modelo) + checklist de validação antes do upload + lista de erros comuns ("aba com nome diferente", "linha de totais movida", "células mescladas no cabeçalho").

---

### Detalhes técnicos

**View-as**: zero mudança de banco/RLS. Só camada de UI lendo um valor local. Real role do super_admin continua intacto — útil pra QA e suporte.

**Switcher de OSC do escritório**: requer mudança no front (filtros por `activeOrgId` em todas queries), mas as RLS via `user_orgs()` já permitem acesso pelo `parent_organization_id`.

**Seed demo**: org com `tipo=osc`, sem `parent`, marcada com flag `metadata.demo=true` em `configuracoes` para nunca aparecer em produção real. Dados inseridos via insert tool, não migration.

**Tokens de cor**: definidos em `oklch` no `src/styles.css`, expostos como `--module-orcamentos`, `--module-orcamentos-soft`, etc. Tailwind v4 já consome via `@theme`.

**Ordem de execução sugerida**: 4 (rápido) → 1 (desbloqueia testes) → 3 (escritório) → 2 (cores) → 6 (mobile) → 5 (screenshots, depende de 2+6 estarem prontas) → 7 (docs).

Posso implementar tudo de uma vez ou fatiar em entregas — me diga se prefere um item por vez ou se posso seguir a ordem acima direto.