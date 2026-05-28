## Atualizar nome "SIT" → "Approva" em páginas e abas restantes

Algumas páginas ainda mostram o nome antigo "SIT" no título da aba e no conteúdo.

### Alterações

1. **`src/routes/login.tsx`**
   - Título da aba: `"Entrar — SIT"` → `"Entrar — Approva"`
   - Marca exibida no card: substituir o `<div>SIT</div>` pelo componente `<ApprovaLogo />` (mesma marca usada no header do site).

2. **`src/routes/ferramenta.tsx`**
   - Título: `"SIT — Prestação de Contas TCE-PR"` → `"Approva — Prestação de Contas TCE-PR"`

3. **`src/routes/orcamentos.tsx`**
   - Título: `"Orçamentos — SIT"` → `"Orçamentos — Approva"`

### Fora de escopo (mantidos)
- `src/lib/sit/*` e referências a `formatLinhaSIT`, `Exportar SIT/TCE-PR`: "SIT" aqui é o nome do **arquivo/layout oficial do TCE-PR** (Sistema de Informações do TCE), não a marca do produto. Mantido.
- `synsit.lovable.app` em `termos.tsx` e `sitemap.xml.ts`: é o domínio técnico atual. Pode ser trocado depois caso queira migrar para `sistemaapprova.lovable.app` (URL publicada) — me confirme se quer incluir.