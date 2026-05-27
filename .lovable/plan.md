# QA Profundo End-to-End — SynSIT

Auditoria completa fingindo ser cliente novo. Org isolada, Drive real, chaos testing, e pacote de artefatos exemplo em `/mnt/documents/`.

## Fase 1 — Setup do sandbox isolado (~5 min)

1. Migração criando organization `QA Sandbox — DELETE ME` (tipo `osc`, status `trial`).
2. Adicionar usuário logado atual como `owner` em `organization_members`.
3. Adicionar flag em `configuracoes` marcando a org como `__qa_sandbox: true` (pra facilitar limpeza depois).
4. **Entregar SQL de rollback** em `/mnt/documents/qa-rollback.sql` que apaga toda a org e dados vinculados.

## Fase 2 — Validação de integrações (~10 min)

5. `verify_credentials` em Google Drive, Docs, Sheets via gateway.
6. Verificar wizard `/admin/setup`: criar pasta-raiz real "SynSIT — QA Sandbox" + 4 subpastas (Orçamentos, Cotações, Documentos, Prestações).
7. Cadastrar 2 templates reais (1 Sheets, 1 Docs) via API e validar leitura.
8. **Smoke test** dos endpoints `/api/extract` (PDF → JSON) e dos server functions de cada domínio (analytics, convites, cotações, fornecedores, objetos, orçamentos, prestação) — chamada via `invoke-server-function`.

## Fase 3 — Fluxo feliz como usuário novo (~15 min)

Browser + chamadas diretas, gerando dados reais na sandbox:

9. **Captura**: gerar 4 PDFs simulados em `/tmp/` (NF, boleto, guia, recibo) com `reportlab` → upload em `/admin/captura` → conferir extração automática e vínculo a evento financeiro previsto.
10. **Fornecedores**: cadastrar 3 fornecedores (com CNPJs reais válidos do BrasilAPI sample).
11. **Objetos de cotação**: criar 2 objetos recorrentes (lanche escolar, material esportivo).
12. **Cotação**: criar cotação de Junho/2026 com 5 itens, enviar 3 convites públicos.
13. **Resposta de fornecedor**: simular preenchimento da página pública do convite (3 respostas) → conferir geração do mapa comparativo no Sheets.
14. **Orçamento**: gerar orçamento vencedor → conferir Docs criado no Drive.
15. **Prestação**: anexar 6 documentos ao mês, gerar snapshot → conferir PDF da prestação + TXT do SIT + manifest.
16. **Agenda**: criar 2 compromissos (vencimento + prazo TCE).
17. **Aprovações**: aprovar 4 documentos, rejeitar 2 com observação.
18. **Painel/Analytics**: verificar se os totais batem com o que foi inserido.

## Fase 4 — Chaos testing (cometer cagada) (~15 min)

Bateria documentada — cada teste registra: **input ruim → comportamento esperado → comportamento observado → fix sugerido**.

**Dados inválidos:**
- CNPJ com dígito verificador errado
- Valor negativo em evento financeiro
- Data de pagamento anterior à de emissão
- PDF de 0 bytes / PDF corrompido
- Campos obrigatórios vazios em todos os forms críticos

**Fluxo fora de ordem:**
- Gerar prestação sem nenhum documento anexado
- Aprovar documento de uma org que não é a do usuário (cross-tenant probe via RLS)
- Deletar fornecedor com cotação ativa
- Gerar TXT do SIT sem mes_referencia
- Wizard sem credenciais Google

**Conflitos / concorrência:**
- 2 requests simultâneos editando a mesma cotação (race condition em `itens` jsonb)
- Mesmo CNPJ inserido 2x (sem unique constraint? verificar)
- 2 snapshots de prestação do mesmo `mes_referencia`
- Convite com `expira_em` no passado

**Recuperação:**
- Para cada falha, tentar a UI de correção. Se não existir, sinalizar como gap.

## Fase 5 — Gargalos & vínculos (~10 min)

19. **Performance**: queries lentas via `pg_stat_statements`, N+1 em loaders, falta de índices em FKs implícitas (`cotacao_id`, `fornecedor_id`, `evento_id`, `mes_referencia`).
20. **Vínculos órfãos**: documentos sem evento, eventos sem categoria, convites sem fornecedor cadastrado, snapshots sem documentos.
21. **Consistência multi-tenant**: scan de queries server-fn que esqueceram filtro `organization_id` (RLS protege, mas custa performance).
22. **RLS audit**: probe com 2º usuário fora da org pra confirmar isolamento.

## Fase 6 — Pacote de artefatos (~5 min)

Gerados em `/mnt/documents/` (alguns reais do Drive, outros mocks do fluxo):

- `qa-report.md` — relatório executivo
- `qa-bugs.md` — lista priorizada de bugs achados (P0/P1/P2)
- `qa-rollback.sql` — script de limpeza da sandbox
- `exemplo-extracao.json` — JSON da extração de PDF
- `exemplo-cotacao-mapa.xlsx` — mapa comparativo (baixado do Drive)
- `exemplo-orcamento.xlsx` — orçamento vencedor
- `exemplo-convite-fornecedor.pdf` — PDF do convite enviado
- `exemplo-resposta-fornecedor.pdf` — PDF consolidado de resposta
- `exemplo-prestacao.pdf` — PDF da prestação de contas
- `exemplo-sit.txt` — TXT do SIT pronto pro TCE-PR
- `exemplo-manifest.json` — manifest do snapshot
- `exemplo-relatorio.docx` — Docs gerado
- `exemplo-auditoria.csv` — dump da `audit_log` filtrada
- `qa-screenshots/` — capturas de cada tela visitada

## Riscos & avisos

- **Drive real**: cria pasta `SynSIT — QA Sandbox` e ~12 arquivos no seu Google Drive. Não toca em nada existente.
- **Banco**: tudo dentro da org sandbox. SQL de rollback entregue no fim.
- **Tempo total**: ~60 min de execução.
- **Cross-tenant probe**: tento ler dados de outra org pelo client autenticado. Espero 0 linhas (RLS); se vier qualquer coisa, é P0.
- **Sem destrutivo na sua org real**: só leio dados existentes pra comparação, não modifico.

## Detalhes técnicos

- Geração de PDFs simulados: `reportlab` com layouts realistas (cabeçalho do emitente, CNPJ formatado, valor, data, código de barras fake pro boleto).
- Chamadas server-fn via `stack_modern--invoke-server-function` com `Authorization` da sessão do preview.
- Drive/Docs/Sheets via `connector-gateway.lovable.dev` com `LOVABLE_API_KEY` + `GOOGLE_*_API_KEY`.
- Browser usado pra validar 3 telas críticas (captura, cotação pública, prestação) — resto via API direta pra economizar tempo.
- Relatório formatado em markdown com seções: Setup, Fluxo feliz, Chaos (tabela), Performance, Vínculos, RLS, Recomendações priorizadas.

Aprova pra eu executar?