## Objetivo

1. Extrair as despesas do PDF `despesasAbril.26.pdf` (que falhou com 502 — provável timeout do Gateway com PDF de 65 MB).
2. Salvar a extração online para você acessar e revisar de qualquer PC pelo próprio site.

## Por que deu 502

O endpoint `/api/extract` envia o PDF inteiro (65 MB) para o Gemini via Lovable AI Gateway. Arquivos grandes estouram o limite do Worker / do Gateway. A solução robusta é enviar o **texto extraído** do PDF (≈200 KB) em vez do binário.

## Etapas

### 1. Habilitar Lovable Cloud
Necessário para persistir a extração e você acessar de outro PC.

### 2. Criar tabela `extracoes_salvas` (migração)
- `id uuid pk default gen_random_uuid()`
- `criada_em timestamptz default now()`
- `mes_referencia text`
- `nome_arquivo text`
- `dados jsonb` — o objeto `ExtracaoResultado` completo (receitas, despesas, resumo) já com `aplicarRegrasHolerite` aplicado
- RLS: leitura/escrita pública (o app não tem autenticação hoje; mantém o padrão atual)

### 3. Server functions (`src/lib/extracoes.functions.ts`)
- `salvarExtracao({ dados, nomeArquivo })` → insert, retorna id
- `listarExtracoes()` → últimas 20 (id, criada_em, mes_referencia, nome_arquivo)
- `carregarExtracao({ id })` → retorna `dados`

### 4. UI em `src/routes/index.tsx`
- Botão **"Salvar online"** (ao lado do botão de exportar) → chama `salvarExtracao` com a extração atual
- Botão **"Carregar online"** → abre um pequeno popover/select com as últimas extrações; ao escolher, hidrata o estado da tabela
- Toast de confirmação em ambos
- Sem auto-load para evitar sobrescrever trabalho em andamento

### 5. Extração imediata deste PDF (feita por mim, fora do app)
- Converter PDF→texto com `pdftotext -layout` (já feito; ~200 KB)
- Chamar o Lovable AI Gateway diretamente do sandbox (mesmo prompt do `/api/extract`, modo texto) usando `LOVABLE_API_KEY`
- Validar o JSON com o schema `extracaoSchema` (em script Node no sandbox importando o schema)
- Aplicar `aplicarRegrasHolerite`
- Inserir o resultado direto na tabela `extracoes_salvas` via SQL
- Confirmar no chat o `id` gerado e o `mesReferencia`/contagem de despesas

Quando você abrir o site em outro PC, clica **"Carregar online"** e a extração aparece pronta para revisão (com as bordas verde/amarela, sanitização, exportação SIT — tudo já existente).

## Fora do escopo
- Mudanças em `formatLinha.ts`, schema, regras de holerite, lógica de exportação ou outras abas.
- Autenticação de usuários (mantém RLS pública conforme estado atual do app).
- Resolver o limite de 65 MB no `/api/extract` para uploads futuros (pode ser feito depois — bastaria fazer o `pdftotext` no cliente ou trocar para upload por chunks).
