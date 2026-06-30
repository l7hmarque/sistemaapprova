# Diagnóstico Approva — estado atual e caminho até o lançamento

Este é um documento de análise (não há código a implementar até você aprovar os próximos passos). Ao final há um roteiro priorizado.

## 1. O que o produto entrega hoje

**Objetivo central:** centralizar a vida financeira/documental de OSCs e escritórios contábeis que prestam contas no SIT-TCE/PR, automatizando captura de notas, organização no Drive e geração do `Despesa.txt`.

**Módulos ativos no /admin:**

- Dashboard (OSC e visão Escritório com múltiplas orgs)
- Painel Financeiro (eventos, edição, validação SIT, export `.txt`)
- Captura (IA lê PDF de NF/boleto/comprovante e cria evento)
- Orçamentos, Fornecedores, Objetos, Modelos
- Prestação (snapshot mensal) + Aprovações
- Agenda, Arquivos (browser do Drive da organização)
- Configurações (organização, equipe + convites, dados do termo SIT)
- Setup wizard (cria estrutura de pastas no Drive master)
- Área `/owner` para super_admin: clientes, financeiro, suporte, analytics

**Marketing/público:** home, contadores, gestores, demonstração, ferramenta, blog, cotação pública por token, convite por token, recuperação de senha.

**Backend:** 26 tabelas com RLS por `organization_id`, trigger `handle_new_user` cria org+owner no signup, `has_role`/`user_roles` para super_admin, Resend para e-mails, Drive master multi-tenant com proxy em `/api/files/$id/preview`.

## 2. Atendimento aos objetivos


| Objetivo declarado                                 | Status                                                                 |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| Captura automática de NF/boleto + comprovante      | ✅ funcional, com inferência SIT                                        |
| Geração do Despesa.txt válido para SIT             | ✅ com validação CNPJ/CPF e modal de pendências                         |
| Multi-tenant isolado (OSC + escritório com filhas) | ✅ RLS + `user_orgs()` + OrgSwitcher                                    |
| Drive organizado por org/mês sem OAuth por usuário | ✅ master account + subpastas idempotentes                              |
| Onboarding self-service                            | ⚠️ funciona, mas wizard ainda enxuto e sem checklist pós-setup         |
| Cobrança / planos                                  | ❌ apenas `plano`/`status`/`trial_ate` no banco; sem fluxo de pagamento |
| E-mails transacionais (convite, recuperação)       | ✅ Resend conectado                                                     |
| Portal do fornecedor                               | ⚠️ só cotação pública por token, sem "área do fornecedor"              |


**Veredicto:** o núcleo (captura → painel → SIT → prestação) atende o objetivo. Periferia comercial (billing, comunicação com lead, suporte in-app) ainda é frágil.

## 3. Fluxo mensal típico do usuário (OSC)

```text
Dia 1-25 do mês
  1. Recebe NFs/boletos/comprovantes por email/whatsapp
  2. /admin/captura  → upload do PDF (1 ou vários)
        IA extrai fornecedor, valores, datas, doc, comprovante de pagto
        Cria evento em eventos_financeiros com sugestão de categoria SIT
        Arquivo vai pro Drive: Approva/<org>/Documentos/<AAAA-MM>/

Dia 25-30
  3. /admin/painel?mes=AAAA-MM
        Revisa cards, edita campos faltantes (categoria REO, tp_doc, modalidade)
        Botão "Validar antes de exportar" → modal de pendências
        Botão "Exportar Despesa.txt" → arquivo Win-1252 pronto pro SIT
  4. /admin/prestacao
        "Fechar mês" gera snapshot e PDF na pasta Prestações/<AAAA-MM>
  5. /admin/aprovacoes (se houver workflow interno)
```

**Fluxo do Escritório contábil:** OrgSwitcher → entra na org-filha → executa o mesmo loop; dashboard `EscritorioDashboard` mostra agregado.

## 4. Riscos de erro humano / lógica

### 4.1 Riscos altos (recomendo corrigir antes do lançamento)

1. **Edição de valores numéricos no painel.** O painel usa strings locais (`valorPrevStr`, `valorEfetStr`) para evitar perder o ponto decimal — bom — mas não há máscara R$ nem validação de mês_referencia ao salvar. Usuário pode salvar `mes_referencia` mexido manualmente; existe `validar_evento_financeiro` no DB que protege, porém o erro só aparece como toast genérico.
2. `**current_user_org()` retorna a org mais antiga.** Várias `*.functions.ts` (ex.: `arquivos.functions.ts`) usam `current_user_org()` em vez do `activeOrgId` enviado do front. Para um usuário com múltiplas orgs (escritório), o servidor pode escrever/ler na org errada, mesmo com o switcher na UI mostrando outra.
3. `**id_interno` único por (org, id_interno)** já tem índice, mas o gerador adiciona sufixo aleatório — pode dificultar conciliação manual quando o contador tenta reemitir.
4. **Captura via IA sem fallback determinístico visível.** Quando o gateway de IA falha, o evento entra como rascunho sem aviso claro. Não há fila de "captura com erro" no painel.
5. **Sem trava em "Fechar mês".** Após gerar snapshot, eventos ainda são editáveis — pode descasar o `Despesa.txt` já entregue do que está no banco.
6. **Cache do React Query x troca de org.** `useActiveOrg` faz `removeQueries`, mas alguns `useEffect` antigos (admin.index, admin.painel) leem `supabase` direto sem queryKey — após troca rápida pode mostrar dados da org anterior por um frame.

### 4.2 Riscos médios

7. Convite por e-mail: não há expiração visível no UI nem reenvio.
8. `PlanoGuard` bloqueia trial expirado, mas não há tela de "renovar/pagar" — usuário fica preso.
9. `useCurrentUser` faz 2 queries (memberships + roles) sem `staleTime`; refetch a cada foco.
10. Captura armazena o `pdfText` em `metadata` — pode estourar tamanho de linha em PDFs grandes.
11. `eventos_financeiros` não tem soft-delete; exclusão do painel é destrutiva e sem audit-log granular (a tabela `audit_log` existe mas não é populada pelas funções de captura/painel).
12. Domínio de e-mail Resend: se não houver domínio verificado, convites podem cair em spam.

### 4.3 Riscos baixos / cosméticos

- Sidebar ainda tem `tour:` props mortas após remoção do tour.
- `CATEGORIAS` no painel não conversa com `CATEGORIAS_REO` do SIT (lista duplicada → divergência conceitual).
- `admin.setup` não detecta se a estrutura já existe e re-roda silenciosamente (idempotente, mas sem feedback de "tudo certo").
- Várias rotas marketing têm `head()` semelhante — OG-image só na raiz.

## 5. Qualidade das queries

- **RLS:** todas as 26 tabelas têm policies; nenhuma tabela aberta a `anon` indevida (validado pelo padrão `user_orgs()`/`has_role`).
- **N+1 potencial:** `EscritorioDashboard` lista filhas e faz uma query por filha (verificar — se >10 filhas vira lento). Migrar para `IN (...)` agregado.
- **Falta índice provável:** `eventos_financeiros(organization_id, mes_referencia)` e `documentos_anexos(organization_id, criado_em DESC)` — checar `EXPLAIN`. Em dataset pequeno (2 eventos hoje) não dói, mas com 5k linhas/cliente vai.
- **Funções definers OK:** `current_user_org`, `user_orgs`, `has_role` todas com `SET search_path = public` (boa prática).
- **Mistura de leitura:** alguns módulos (painel/index) usam `supabase` no client, outros usam serverFn — inconsistente. Para listas pesadas (eventos com joins) compensa mover pro server com `requireSupabaseAuth`.

## 6. Caminho até o lançamento (polimento priorizado)

### Sprint A — Confiabilidade do núcleo (1 semana)

A

1. Servir `activeOrgId` em todas as `*.functions.ts` (parar de usar `current_user_org()` quando o cliente sabe a org).

A

2. "Fechar mês" trava edição dos eventos do mês (campo `mes_fechado_em` em `eventos_financeiros` ou flag em `prestacoes_snapshot`).

A

3. Popular `audit_log` em todo INSERT/UPDATE/DELETE de eventos e documentos (trigger genérico).

A

4. Estado de erro de captura: nova coluna `captura_status` ('ok' | 'erro' | 'parcial') + filtro no painel "Captura com erro".

A

5. Máscara monetária BR (R$) no painel e validação de `mes_referencia` antes de PATCH.

### Sprint B — Onboarding e cobrança mínima (1 semana)

B

1. Tela `/admin/plano`: mostra status, dias restantes do trial, CTA "Falar com vendas" (cobrança manual por enquanto, como decidido).

B

2. Wizard pós-setup: checklist (Drive ✅, fornecedores cadastrados, dados do termo SIT preenchidos, primeira captura).

B

3. Reenvio/expiração visível de convites + verificação de domínio Resend.

B

4. Tela "Trial expirado" amigável (não só PlanoGuard cinza).

### Sprint C — Performance e observabilidade (3-4 dias)

C

1. Índices: `eventos_financeiros(organization_id, mes_referencia)`, `documentos_anexos(organization_id, criado_em DESC)`, `audit_log(organization_id, criado_em DESC)`.

C

2. `EscritorioDashboard` em uma única query agregada.

C

3. `staleTime` razoável em `useCurrentUser` e `useActiveOrg`.

C

4. Sentry/logflare ou ao menos `error-capture.ts` enviando pro `audit_log` em produção.

### Sprint D — Acabamento (3-4 dias)

D

1. Unificar `CATEGORIAS` do painel com `CATEGORIAS_REO` do SIT (uma única fonte).

D

2. Limpar props `tour` mortas na sidebar e código deletado.

D

3. OG-images por rota leaf no marketing; sitemap.xml revisado.

D

4. Testes E2E mínimos (Playwright): login → captura → editar → exportar TXT → fechar mês.

D

5. Página `/status` simples (Drive ok, Resend ok, IA ok) para suporte.

### Sprint E — Pré-venda (paralelo)

E

1. Domínio próprio + e-mail (`@sistemaapprova.com.br`) verificado no Resend.

E

2. Política de privacidade e termos revisados (já existem rotas).

E

3. Vídeo curto da demonstração + um caso real com dados anonimizados.

## 7. Perguntas que ainda preciso responder para fechar o roteiro

- **Cobrança no MVP:** confirma manual (boleto/PIX fora do app) ou já quer Stripe/Pagar.me em D-day? manual
- **Travamento de mês fechado:** total (nada edita) ou só admin/owner pode reabrir? admin e owner podem abrir
- **Audit log:** registrar apenas eventos financeiros e documentos, ou todo o CRUD (fornecedores, modelos, convites)? todo crud
- **Multi-org rápido:** confirma que `activeOrgId` deve ser passado do front em TODA serverFn (sim, recomendo) e aposentar `current_user_org()` como fallback? sim
- **Lançamento beta:** quer abrir com convites manuais (você cria orgs no /owner) ou self-service público desde o dia 1? abrir com convites manuais

Responda essas 5 e eu volto com o plano executável das Sprints A–E em ordem.