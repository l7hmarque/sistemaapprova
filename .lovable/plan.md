# Screenshots de preview para a landing

## Objetivo
Gerar 3 imagens realistas mostrando o produto em funcionamento, com dados fictícios mas coerentes (CNPJs, razões sociais, valores, datas brasileiras), e integrá-las na home (`src/routes/index.tsx`).

## As 3 telas

**1. Upload e processamento de NF** (`src/assets/preview-upload.png`)
Tela mostrando 4 notas fiscais sendo processadas em tempo real:
- `NF-e 0034521 — Distribuidora Aurora Ltda — CNPJ 12.345.678/0001-90 — R$ 14.230,50 — ✓ Validada`
- `NF-e 0034522 — Metalúrgica São Bento ME — R$ 8.745,00 — ⚠ Divergência CFOP`
- `NF-e 0034523 — Tech Suprimentos SA — R$ 23.118,75 — ⏳ Processando`
- `NF-e 0034524 — Comercial Verdes Campos — R$ 4.890,00 — ✓ Validada`
Header com logo SynSIT, sidebar discreta, barra de progresso "47 de 60 documentos".

**2. Dashboard de divergências** (`src/assets/preview-dashboard.png`)
KPIs no topo:
- "R$ 47.230 em divergências detectadas (mês)"
- "312 NFs processadas"
- "94% de aderência fiscal"
- "12s tempo médio de validação"

Gráfico de barras (últimos 6 meses), tabela com 5 divergências prioritárias (ICMS-ST recolhido a maior, CFOP incompatível, alíquota PIS divergente, etc.) com responsável e prazo.

**3. Relatório auditável de uma divergência** (`src/assets/preview-relatorio.png`)
Visão detalhada de UMA NF:
- Cabeçalho: NF-e 0034522, fornecedor, valor, data emissão
- Lado esquerdo: dados extraídos do XML
- Lado direito: regra fiscal aplicada + base legal (ex.: "Convênio ICMS 142/2018, cláusula 9ª")
- Rodapé: "Recomendação: solicitar carta de correção. Economia estimada: R$ 1.247,30"
- Selo "Lastro auditável — hash SHA-256: a3f2..."

## Estilo visual (corporativo confiável)
- Paleta da landing atual (azul/cinza, fundos claros)
- Tipografia sóbria, sem efeitos chamativos
- UI realista (sombras suaves, cantos arredondados, espaçamento generoso)
- Sem rostos, sem stock photos
- Aspect ratio 16:9 para encaixar bem no hero e nas seções

## Geração
Usar `imagegen--generate_image` com `model: "premium"` (texto legível é crítico) e `transparent_background: false`. Cada imagem em ~1600x900. 3 chamadas em paralelo.

## Integração na landing

**Hero** (`src/routes/index.tsx`): adicionar a imagem 1 (upload) à direita do título, com borda sutil + sombra, em vez do mockup atual (ou complementando).

**Seção "Como funciona"**: 3 colunas, cada uma com uma das imagens + caption curto:
1. "Receba e processe" → preview-upload
2. "Identifique divergências" → preview-dashboard  
3. "Aja com lastro legal" → preview-relatorio

**SEO/OG**: usar `preview-dashboard.png` como `og:image` no `head()` da rota index — já que o hero atual não tem imagem de share dedicada.

## Arquivos tocados
- criados: `src/assets/preview-upload.png`, `src/assets/preview-dashboard.png`, `src/assets/preview-relatorio.png`
- editado: `src/routes/index.tsx` (hero + seção "Como funciona" + og:image)

## Fora do escopo
- Vídeo motion-graphics (fica para próxima rodada se quiser reforçar)
- Gravação de tela real do app
- Animações no preview (imagens estáticas; se quiser micro-animação tipo "cursor passando", abrimos outra rodada)
