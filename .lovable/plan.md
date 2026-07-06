## O que vou fazer

### 1. Arquivos — corrigir 403 no download e melhorar visualização
- **Corrigir o 403** em `/api/files/$id/preview`: hoje `fileBelongsToOrg` sobe a árvore de pastas do Drive usando apenas `parents[0]` e limita a 8 níveis. Vou:
  - percorrer TODOS os pais (BFS, não só o primeiro), o que resolve arquivos que caíram em subpastas com mais de um parent (raro, mas ocorre em Shared Drives / cópias);
  - aceitar como "da org" também arquivos cujo `id` esteja registrado em `documentos_anexos` ou `prestacao_documentos` da mesma org (checagem via banco), garantindo download mesmo se a hierarquia do Drive tiver sido alterada manualmente;
  - retornar mensagem clara ("arquivo não pertence à sua organização" vs "sessão expirada") no cliente.
- **Mostrar todos por padrão**: adicionar opção **"Todas as seções"** no filtro Seção (valor padrão). Quando selecionado, o servidor lista os arquivos das 4 subpastas (Orçamentos, Cotações, Prestações, Documentos) em paralelo e devolve um array unificado, cada item marcado com sua seção de origem.
- **Badges de identificação** em cada linha: seção (Orçamentos/Cotações/Prestações/Documentos), mês (quando o path contém `AAAA-MM`), extensão real do arquivo e — quando o `drive_file_id` estiver em `documentos_anexos` — badge com o `id_interno` do evento vinculado (ex.: `#0007`). Para arquivos vinculados a `prestacao_documentos`, badge "cadastrado".

### 2. Sidebar — remover Analytics
- Remover o item **Analytics** de `src/components/admin/sidebar.tsx` e a lógica `showAnalytics`/`superAdminOnly`.
- Excluir `src/routes/_authenticated.admin.analytics.tsx` e `src/lib/analytics.functions.ts` (funções `getAnalyticsSummary` etc. só são consumidas por essa página).
- **Mantém** `src/hooks/use-analytics.ts` e a chamada em `__root.tsx` / `MarketingLayout` — isso é o rastreamento de visitas do site público, feature diferente da página Analytics do admin. Se quiser removê-lo também, me diga.

### 3. Prestação — upload de arquivo do computador
- Na modal "Novo/Editar documento" em `/admin/prestacao`, além do campo "URL do arquivo", adicionar um botão **"Enviar do computador"** que:
  - abre file picker (pdf/imagens);
  - envia direto ao bucket `prestacoes` já existente, em `prestacoes/{orgId}/documentos-cadastrados/{uuid}-{filename}`;
  - preenche automaticamente `arquivo_url` com uma signed URL (ou salva `storage_path` num campo dedicado — ver seção técnica) e mostra o nome do arquivo enviado;
  - permite trocar o arquivo antes de salvar.

### 4. Toast do relatório — contar despesas do mês
- Hoje o toast mostra `totalComprovantes` (arquivos anexados únicos). O usuário quer que reflita **quantas despesas do mês** entraram no PDF, independente de anexos compartilhados.
- Alterar `montarPdfBytes` para retornar também `totalEventos` (linhas de `eventos_financeiros` do mês, não excluídas) e o toast na página passar a mostrar: `X pág. · Y documentos cadastrados · Z despesas do mês (W comprovantes únicos anexados)`.

### 5. Dashboard `/admin` — reformular para guiar o fluxo de trabalho
Substituir os cards atuais (Orçamentos no mês, Fornecedores, Objetos, gráficos) por blocos **acionáveis** e centrados na rotina da OSC:

- **Este mês em curso** (mês atual, editável): card grande com barra de progresso mostrando
  - despesas lançadas × despesas com comprovante anexado (ex.: "18 de 24 despesas com comprovante") — link direto para `/admin/painel` filtrado pelas pendências;
  - total gasto no mês vs. mês anterior (delta %).
- **Próximas ações** (lista priorizada, cada item é link):
  - documentos da Prestação vencidos ou a vencer em 30 dias (usa a mesma query da página Prestação);
  - convites/cotações abertas aguardando resposta há mais de X dias;
  - capturas em falha (`captura_jobs` com `status = falhou_definitivo`);
  - aprovações pendentes (`aprovacoes`).
- **Fechamento da prestação**: card do mês atual mostrando se já existe snapshot fechado (`prestacoes_snapshot` sem `revogado_em`) — botão "Ir para Prestação" ou "Ver PDF fechado". Se não fechado, mostrar checklist rápido (docs faltando + comprovantes faltando).
- **Últimas atividades** (feed compacto): últimos 5 eventos financeiros, últimas 3 capturas concluídas, último orçamento salvo — para o usuário ter "senso de onde parou".
- Remover os gráficos de barras/linha/pizza atuais. Se quiser manter um gráfico, sugiro **gasto acumulado do mês vs. média dos 3 meses anteriores** — só um, para não voltar ao problema de "números que não guiam".

Mantém o `EscritorioDashboard` para orgs do tipo escritório (não mexo nele).

---

## Detalhes técnicos

- **`fileBelongsToOrg`**: reescrever como BFS com fila de `parents` (não `parents[0]`), profundidade 12, cache local por request. Antes do BFS, tentar match direto em `documentos_anexos.drive_file_id = fileId` ou `prestacao_documentos.drive_file_id = fileId` para a org.
- **Listar todas as seções**: novo modo em `listarArquivosDaOrg` quando `section` não vem — retorna `Array<DriveFileEntry & { section: string; mes?: string }>`, resolvendo o mês pelo nome da pasta imediata (regex `^\d{4}-\d{2}$`). Para isso, listamos primeiro as subpastas de cada seção (com `mimeType = folder`) e depois os arquivos de cada uma.
- **Upload em Prestação**: usar `supabase.storage.from('prestacoes').upload(...)` do cliente (bucket já existe, é privado). Salvar em `arquivo_url` a signed URL de longa duração (ou adicionar coluna `storage_path` em `prestacao_documentos` via migração — decido pelo caminho mais simples: gravar `storage_path` novo e priorizá-lo no download; migração pequena, sem quebrar dados existentes).
- **Remoção de Analytics**: apagar arquivos, remover import de `analytics.functions` em qualquer lugar (só a página usa), remover item do sidebar, sem tocar em `use-analytics` (visitor tracking).
- **Toast prestação**: `gerarPrestacaoContas` já retorna `totalComprovantes`; adiciono `totalEventos` no retorno e ajusto a página `_authenticated.admin.prestacao.tsx`.
- **Dashboard**: novas queries adicionadas ao `useEffect` (ou migrar para `useQuery` para caching). Reaproveitar `buscarDocumentosVigentes` via server-fn nova `getDashboardResumo` para não replicar SQL no cliente.

## Fora de escopo

- Remoção do tracking de visitas (`use-analytics`) — só a página Analytics do admin sai.
- Reorganizar o `EscritorioDashboard`.
- Mudar layout do sidebar além de tirar o item Analytics.
