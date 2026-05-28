# Rebrand: SynSIT → Approva

## Identidade

**Nome:** Approva
**Posicionamento:** Plataforma de gestão financeira com fluxo de aprovação em duas mãos para o Terceiro Setor.
**Tagline:** "Aprovado. Arquivado. Em conformidade."
**Tom:** Tech moderno — frases curtas, diretas, confirmações com check, sem jargão fiscal pesado.

## Identidade visual

**Logo — wordmark tipográfico**
- Texto puro "approva" (lowercase) em fonte grotesque moderna (Space Grotesk ou similar já no projeto)
- Detalhe sutil: o segundo "p" com terminação levemente arredondada OU um micro-check substituindo o pingo de um caractere — assinatura discreta sem virar ícone
- Versão reduzida: monograma "ap." para favicon e avatares
- Sem símbolo separado — a tipografia é a marca

**Paleta Navy Trust (tokens em `src/styles.css`)**
```
--background:        #f8fafc  (quase branco, leve frio)
--foreground:        #0f1b3d  (navy profundo, texto)
--primary:           #1e3a5f  (navy médio, ações principais)
--primary-foreground:#e8edf3
--accent:            #3b6fa0  (azul links, destaques)
--muted:             #e8edf3
--border:            #d6dde8
--success:           #0d7a5f  (verde discreto para "aprovado")
--destructive:       #b91c1c
```
Modo escuro: inverte para fundo `#0f1b3d` com cards `#1e3a5f`.

**Tipografia**
- Headings: Space Grotesk (já usado em padrões tech modernos)
- Body: Inter ou DM Sans
- Mono (números financeiros, IDs): JetBrains Mono

## Escopo da mudança (apenas frontend/apresentação)

1. **Tokens `src/styles.css`** — substituir paleta atual pela Navy Trust em light e dark, manter estrutura de variáveis OKLCH.
2. **Wordmark** — criar `src/components/brand/ApprovaLogo.tsx` (SVG inline, variantes: full / mono / icon-only) usado em header, sidebar, login, emails.
3. **Substituição textual global** — todas as strings visíveis "SynSIT" → "Approva":
   - Header / sidebar / footer
   - `index.html` (title, meta description, og:tags)
   - `head()` de cada rota (titles, descriptions)
   - Páginas de login / signup / landing (`src/routes/index.tsx`)
   - Templates de email (assunto + corpo) se existirem
   - README / manifest / favicon alt
4. **Tom de voz** — revisar microcopy chave para padrão tech moderno:
   - Toasts: "Prestação aprovada ✓" em vez de "A prestação foi aprovada com sucesso"
   - Botões: verbos diretos ("Aprovar", "Arquivar", "Enviar")
   - Estados vazios: 1 linha + 1 CTA
5. **Favicon + OG image** — gerar novos assets com wordmark sobre fundo navy.
6. **SEO** — meta description nova: "Approva — gestão financeira e prestação de contas para o Terceiro Setor."

## Fora de escopo
- Lógica de negócio, schema, RLS, server functions (intactos)
- Renomear tabelas/colunas/projeto no Supabase
- Mudar o domínio publicado (`synsit.lovable.app` continua funcionando; trocar domínio é passo separado quando você quiser)

## Verificação pós-build
- Buscar `rg -i "synsit"` no projeto — deve retornar zero ocorrências em código de UI (ok ficar em migrations antigas).
- Conferir preview: header, login, dashboard, página de prestação — wordmark + paleta aplicados.
- Lighthouse meta tags atualizadas.

## Detalhes técnicos
- Paleta convertida para OKLCH antes de gravar em `styles.css` (formato exigido pelo template).
- Logo como componente SVG (não PNG) para escalar e respeitar `currentColor` em tema claro/escuro.
- Manter `synsit.lovable.app` como published URL — só rebrand visual, sem migração de domínio nesta etapa.
