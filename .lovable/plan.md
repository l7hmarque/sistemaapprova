# O que ainda falta

**Atualização desta sessão:** Fase 1 entregue. Renomear "despesa" não era necessário (termo só aparece como nome técnico SIT no backend, não na UI de orçamentos). Fase 2 reduzida só ao preset livre.



---

## Fase 1 — Corrigir lacunas da captura (1 sessão)

A captura funciona para PDF, mas tem 3 buracos:

1. **Foto/imagem não passa pela IA** — hoje só rodo pdf.js, que não funciona em JPG/PNG. Trocar para `google/gemini-2.5-flash` (multimodal) quando o arquivo for imagem, enviando como `image_url` base64.
2. **Tolerância hard-coded** — R$ 0,50 e ±3 dias estão no código. Mover para `configuracoes` (chave `auto_vinculo`) com tela em `/admin/configuracoes` para editar.
3. **Fallback Pro quando Flash falha** — se Flash Lite devolver `tipo: outro` + `valor: null`, refazer com `google/gemini-2.5-pro` antes de marcar como órfão. Aplicar só quando texto tem >200 chars (evita gastar Pro em imagem ruim).

Bônus barato: cache global por hash já está implícito (qualquer doc com mesmo SHA-256 é detectado como duplicata antes da IA), mas falta também **reusar dados extraídos** do hash conhecido em vez de só marcar duplicata.

---

## Fase 2 — Quick wins pendentes do Plano B (1 sessão)

São itens pequenos que ficaram para trás:

- Renomear "despesa" → **"despesa prevista"** em `/admin/orcamentos` (labels, headers, totals).
- **Preset livre de orçamento**: hoje preset força o formato SIT. Permitir preset com qualquer estrutura de itens, mas na hora de exportar o `.TXT SIT` o sistema converte/preenche os campos obrigatórios automaticamente.

---

## Fase 3 — Prestação V1 (2-3 sessões, é o grande)

O ponto final do fluxo. Hoje a tela `/admin/prestacao` é só um repositório de docs institucionais soltos. Precisa virar:

```text
[ Painel do mês ]  ─→  [ Botão "Fechar mês" ]  ─→  [ PDF montado + snapshot ]
```

Passos:

1. **Migration**: tabela `prestacoes_snapshot` com `mes_referencia`, `gerado_em`, `pdf_url`, `manifest` (JSONB com lista de eventos+docs+hashes), `assinatura_hash`. Cada snapshot é imutável.
2. **Lógica de montagem** (server function):
   - Pega todos `eventos_financeiros` do mês.
   - Para cada evento, busca anexos via `documentos_anexos.evento_id`.
   - Monta seções na ordem: institucionais fixos → institucionais recorrentes → comprovantes (1 página A4 por evento, agrupando boleto+NF+comprovante) → orçamentos+mapas → uploads livres.
   - Merge final com `pdf-lib` (Worker-compatível).
   - Upload do PDF resultante para bucket `prestacoes` (novo).
   - Atualiza `eventos_financeiros.prestacao_snapshot_id` para todos os eventos do mês.
3. **UI**: na `/admin/painel`, botão **"Fechar mês e gerar prestação"** ao lado do filtro de mês. Mostra preview do que vai entrar, pede confirmação, gera. Lista de prestações geradas em `/admin/prestacao` com link para baixar.
4. **Validação pré-fechamento**: bloqueia se houver evento com `status_documental != completo` (ou pede confirmação override).

---

## Fase 4 — Gmail OAuth label-filtered (1-2 sessões)

Importante mas só faz sentido depois que a prestação está fechando o ciclo. Caso contrário, vai gerar docs órfãos sem para onde ir.

**Decisão importante:** o Plano A previa OAuth **per-user** (cada usuário conecta seu Gmail). O conector padrão do Lovable Cloud é **builder-only** (sua conta atende a todos). Pra OSC pequena com 1-2 admins, builder-only é suficiente e muito mais simples. Pra V2, se virar multi-OSC, vira per-user.

Passos:
1. Conectar Gmail via conector do Lovable Cloud (sua conta `l7hmarque@gmail.com`).
2. Server function `puxar-gmail` que lista mensagens com query `label:OSC/contas is:unread has:attachment`.
3. Para cada mensagem com anexo PDF: baixa via API → joga no mesmo pipeline da captura → marca como lida.
4. Cron pg_cron rodando a cada 2h chamando `/api/public/gmail-pull` (com signature de segurança).
5. UI: card em `/admin/captura` mostrando "Última varredura Gmail: há X min, Y docs novos".

---

## Fase 5 — Polimento (1 sessão)

Coisas que vão aparecer depois que rodar de verdade:

- Dashboard `/admin` hoje está vazio. Virar resumo do mês: total previsto vs efetivo, % docs completos, alertas (vencimentos próximos, divergências).
- Tela de **documentos órfãos** (`/admin/captura` mostra fila da sessão atual; precisa de tela permanente listando todos os órfãos do banco para revisão posterior).
- Notificações: vencimento em 3 dias sem evento criado → email/toast.

---

## Resumo de prioridade

| Fase | Sessões | Por que nessa ordem |
|------|---------|---------------------|
| 1. Lacunas da captura | 1 | Captura não está confiável sem multimodal e config |
| 2. Quick wins B | 1 | Pequeno, destrava export SIT correto |
| 3. **Prestação V1** | 2-3 | **Fecha o ciclo — sem isso o sistema não entrega o valor principal** |
| 4. Gmail | 1-2 | Automação, só útil depois do ciclo fechar |
| 5. Polimento | 1 | Depois de usar em produção 1 mês |

**Total estimado: 6-8 sessões** até "pronto para usar todo mês".

---

## Detalhes técnicos relevantes

- **pdf-lib no Worker**: confirmado compatível (já usado em projetos similares no stack).
- **Snapshot imutável**: hash SHA-256 do PDF final salvo em `manifest`, validação ao reabrir.
- **Tolerância configurável**: chave nova em `configuracoes` com formato `{ valor_centavos: 50, janela_dias: 3 }`. Captura lê no início do processamento.
- **Bucket novo**: `prestacoes` (privado, RLS authenticated, igual ao `documentos`).
- **Modelo Pro de fallback**: contador no log para garantir que não passe de ~5% das chamadas (custo controlado).

---

## Pergunta de aprovação

Aprovado nessa ordem? Se sim, começo pela **Fase 1** (lacunas da captura) imediatamente — é o mais barato e destrava confiança no pipeline que acabei de entregar.
