## Como será feito

**1. Tokens (`src/styles.css`)**
- Reescrever os valores de `:root` e `.dark` com a paleta PRISMA convertida para oklch, mantendo os nomes de token existentes (`--primary`, `--accent`, `--muted`, `--sidebar-*`, `--success/warning/danger/info/pending`) — assim nenhum componente precisa mudar de classe.
- `--radius: 0.625rem` (10px) e sombras com tinta roxa.
- `--font-display: "Space Grotesk"`, `--font-body: "Inter"`, `--font-mono: "JetBrains Mono"`.
- Os `--brand-*` do bloco marketing passam a apontar para a paleta roxo/laranja e `.marketing-theme` deixa de forçar a serifa: títulos passam a Space Grotesk. As classes utilitárias `.marketing-theme .bg-brand-*` continuam existindo, então as 12 páginas públicas que as usam mudam de cor sem edição individual.
- Acentos por módulo (`[data-module=...]`) rebalanceados dentro da família roxo/laranja, preservando a distinção entre módulos.

**2. Fontes (`src/routes/__root.tsx`)**
- Trocar o `<link>` do Google Fonts: Space Grotesk (500/700) + Inter (400/500/600/700) + JetBrains Mono, removendo Archivo Black e Instrument Serif.

**3. Logo (`src/components/brand/ApprovaLogo.tsx`)**
- Reescrever o componente com o lockup PRISMA: símbolo SVG (quadrado roxo, raio 9, triângulos branco/laranja) + wordmark "Approva" em Space Grotesk e a linha "por Prisma" em caixa alta espaçada. Mantidas as props atuais (`variant`, `size`, `withTagline`, `asLink`) para que header, footer, login e sidebar do admin continuem funcionando sem alteração.
- Gerar `public/favicon.png` a partir do mesmo símbolo, apontar no `head()` do root e remover o `favicon.ico` antigo.

**4. Ajustes pontuais**
- Varredura por cores fixas (`text-white`, `bg-[#...]`, hex soltos) nas páginas públicas e no admin, trocando por tokens.
- Conferência de contraste no claro e no escuro nas telas principais (home, gestores, contadores, login, /admin dashboard, /admin/prestacao) via captura de tela.

## Fora do escopo
Nenhuma mudança de conteúdo, layout, rotas, textos de SEO ou lógica de negócio — apenas cor, tipografia, forma e logo.
