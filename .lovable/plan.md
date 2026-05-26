## Estratégia geral

Fatiar em 3 fases. Esta proposta detalha **Fase 1** (núcleo de cotação) e descreve Fase 2/3 em alto nível para alinhar antes de cada uma.

---

## FASE 1 — Núcleo de cotação (foco desta entrega)

### 1.1 Objetos de cotação (`/admin/objetos`)
- Página real (substitui o `PlaceholderPage`).
- CRUD em `objetos_cotacao` (já existe): descrição, unidade padrão, categoria, contador de uso.
- Busca + ordenação por uso. Auto-criação continua funcionando (já registrada em `orcamentos.functions.ts`).

### 1.2 Cadastro de fornecedores (`/admin/fornecedores`)
- Página real sobre `fornecedores` (tabela existente).
- CRUD completo: razão social, CNPJ, representante, CPF, e-mail, telefone, endereço.
- **Cadastro rápido a partir de despesa**: no `/ferramenta`, ao revisar uma despesa cujo CNPJ não está em `fornecedores`, exibir botão "Salvar fornecedor" que pré-preenche o modal com os dados extraídos. Opcional, não bloqueante.

### 1.3 Orçamentos parciais (`/admin/orcamentos`)
**Mudança de modelo**: hoje `gerarOrcamentoNoDrive` exige 1 fornecedor com itens completos e gera 1 Sheet. Vai virar fluxo em 2 níveis:

- **Cotação** (nova tabela `cotacoes`): agrupa o objeto, termo, mês, lista de itens (qtd/unidade/descrição) e até N fornecedores candidatos. Status: `coletando` → `pronto_para_mapa` → `finalizado`.
- **Orçamento por fornecedor** (`orcamentos_salvos` já existe, ganha `cotacao_id` + `status`): cada fornecedor vira 1 linha. Pode ser criado vazio (sem preços) e preenchido depois. Geração no Drive acontece quando os preços chegam.

UI: página da cotação mostra grid `itens × fornecedores` com status por célula (aguardando / preenchido). Botão por fornecedor: "Gerar Sheet", "Marcar como recebido", "Reabrir".

### 1.4 Mapa comparativo automático
- Botão "Gerar mapa comparativo" habilita quando ≥3 orçamentos da cotação estão `preenchido`.
- Reutiliza `gerarMapaComparativoNoDrive` (já existe) montando o payload a partir dos 3 orçamentos selecionados (usuário escolhe quais 3 se houver mais).
- Salva referência no registro da cotação (drive URL).

### 1.5 Orçamentos presetados
- Nova tabela `cotacao_presets` (campos: nome, objeto, termo, itens jsonb, fornecedores_sugeridos jsonb).
- Em qualquer cotação: botão "Salvar como modelo" e "Carregar modelo".
- Ao carregar: cria nova cotação com data/mês atuais, itens copiados, preços zerados, fornecedores sugeridos pré-selecionados (e se o cadastro mudou — razão social, representante — usa o atual de `fornecedores`).

### 1.6 Arquivos & migrations
**Migration**:
- `cotacoes` (id, objeto, termo, mes_referencia, itens jsonb, status, criado_em, atualizado_em) + RLS authenticated.
- `cotacao_presets` (id, nome, objeto, termo, itens jsonb, fornecedores_sugeridos jsonb) + RLS authenticated.
- `orcamentos_salvos`: adicionar `cotacao_id uuid null`, `status text default 'rascunho'` (rascunho/preenchido/finalizado), índice por `cotacao_id`.

**Server functions novas** (`src/lib/cotacoes.functions.ts`):
- `criarCotacao`, `listarCotacoes`, `obterCotacao`, `atualizarCotacao`, `adicionarFornecedorACotacao`, `preencherPrecosOrcamento` (gera/atualiza Sheet via helpers existentes em `orcamentos.server.ts`), `gerarMapaDaCotacao`, `salvarPreset`, `listarPresets`, `carregarPreset`.

**Server functions de fornecedores** (`src/lib/fornecedores.functions.ts`): CRUD + `criarFornecedorDeExtracao`.

**Rotas novas/atualizadas**:
- `src/routes/admin.objetos.tsx` — implementação real (usa `AdminShell`).
- `src/routes/admin.fornecedores.tsx` — implementação real.
- `src/routes/admin.orcamentos.tsx` — lista de cotações.
- `src/routes/admin.cotacoes.$id.tsx` — detalhe da cotação (grid itens×fornecedores, mapa, presets).
- `src/components/admin/CotacaoGrid.tsx`, `FornecedorDialog.tsx`, `PresetDialog.tsx`.

**Não mexer**: `/ferramenta` (exceto adicionar botão "Salvar fornecedor"), landing, `/admin/aprovacoes`, extração.

---

## FASE 2 — Portal do fornecedor (próxima entrega, **NÃO** incluso agora)

Resumo aprovado nas respostas:
- Link público com token único (sem login), sob `/cotacao/$token`. Rota pública (não `_authenticated`).
- Token gerado por orçamento (campo novo `acesso_token` + `acesso_expira_em` em `orcamentos_salvos`).
- Página mostra dados pré-preenchidos do fornecedor (editáveis), itens com preço unitário e checkbox "não temos disponível".
- Ao enviar: salva preços, atualiza cadastro do fornecedor, marca orçamento como `preenchido`, gera Sheet no Drive e exporta PDF; tela mostra botão "Baixar PDF" (sem e-mail).
- Endpoint público em `src/routes/api/public/cotacao.$token.ts` para submit (rate-limited, valida token).

## FASE 3 — Agenda + Analytics interno

- Agenda em formato calendário (mensal/semanal), eventos com cards. Tabela `eventos_agenda` (titulo, descricao, inicio, fim, prazo, criado_por, atribuido_a).
- Web Push (Service Worker + VAPID keys — exige `add_secret` de `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` ou via Lovable Cloud) + som no app quando aberto.
- Analytics fica restrito a admin (já é hoje em `/admin/analytics`); confirmar que rotas estão sob layout autenticado.

---

## Fora de escopo desta fase
- E-mail para fornecedor, integração WhatsApp.
- Notificações push (Fase 3).
- Edição direta de Google Sheet do orçamento na UI (continua sendo "gerar no Drive e abrir").
- Multi-OSC / multi-termo.

---

## Ordem de execução proposta (Fase 1)
1. Migration (`cotacoes`, `cotacao_presets`, colunas em `orcamentos_salvos`).
2. Server functions de fornecedores + página `/admin/fornecedores`.
3. Página `/admin/objetos` real.
4. Server functions de cotações + página lista `/admin/orcamentos`.
5. Página de detalhe da cotação com grid + geração de Sheet por fornecedor.
6. Botão "Gerar mapa comparativo" reutilizando função existente.
7. Presets (salvar/carregar).
8. Botão "Salvar fornecedor" no `/ferramenta`.

Posso seguir com esta Fase 1?
