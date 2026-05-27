## Objetivo

Gerar uma nova versão do **Relatório Técnico-Legal: Propostas de Aprimoramento do Fluxo de Encaminhamentos do SCFV em Medianeira-PR** com:

1. Correções terminológicas no Estudo de Caso (item 5).
2. Bloco de autoria assinado por você.
3. Data oficial de elaboração.
4. Linguagem humanizada de ponta a ponta — sem cara de IA.

Entrega final: `/mnt/documents/Relatorio_SCFV_Medianeira_v2.pdf` (mantém o original intocado, gera nova versão).

---

## O que muda no conteúdo

### 1. Correções pontuais (item 5 — Estudo de Caso)

- "Registro de Revelação Espontânea (conforme o Anexo II do protocolo municipal)" → **"Escuta Especializada (conforme o Anexo II do protocolo municipal)"**
- "acionou imediatamente a rede de proteção (Conselho Tutelar e CREAS)" → **"acionou imediatamente a rede de proteção (Conselho Tutelar e Escuta Especializada)"**

### 2. Bloco de autoria (página de rosto + assinatura no fim)

```
Leonardo Henrique de Marque
Psicólogo Social
Coordenador do SCFV-CAIA — Medianeira/PR
CRP 08/37876
```

### 3. Data de elaboração

Medianeira-PR, **18 de novembro de 2025**.
(Atualizar também a data de "Acesso em:" nas referências para 18 nov. 2025, para coerência cronológica — hoje estão como 21 mai. 2026, posterior à elaboração.)

### 4. Humanização da linguagem (passada de pente fino em todo o texto)

Diretrizes da reescrita:

- Primeira pessoa do plural ("temos observado", "no nosso cotidiano com as famílias do CAIA") em trechos analíticos, sem perder formalidade.
- Substituir conectivos típicos de IA ("ademais", "outrossim", "destarte", "portanto, conclui-se", "vale ressaltar", "é importante notar") por construções naturais.
- Quebrar frases longas com encadeamentos lineares; intercalar períodos curtos.
- Remover redundâncias ("forma muito clara", "extrema relevância", "potencializar essa estratégia").
- Trazer marcas de vivência prática: referências a famílias atendidas, ao território, à rotina da unidade itinerante, sem inventar dados.
- Tom técnico-empático: combina fundamentação legal (LOAS, Tipificação, NOB/SUAS) com leitura da realidade vivida na ponta.
- Sem bullets quando a ideia couber em parágrafo corrido; manter listas só onde realmente ajudam o leitor (ex.: propostas finais).

A estrutura (1. Introdução → 2. Fluxo Atual → 3. Acessibilidade e Competências → 4. Fundamentação Legal → 5. Estudo de Caso → 6. Conclusões → 7. Referências) é mantida, assim como a tabela do item 2 e as citações de lei. O que muda é a textura da escrita.

---

## Detalhes técnicos da geração

1. Escrever o conteúdo reescrito em `/tmp/relatorio_v2.md` (markdown com a tabela do fluxo atual, citações em blockquote e referências numeradas).
2. Converter para PDF com `pandoc` + engine `weasyprint` (já disponível no sandbox via `nix run nixpkgs#weasyprint`) ou `wkhtmltopdf`. Folha de estilo simples:
  - Fonte serifada para corpo (Source Serif / Liberation Serif), sans para títulos.
  - Margens 2,5 cm; numeração de páginas no rodapé; cabeçalho com título curto.
  - Página de rosto com título, autor, cargo, CRP e data.
3. Salvar em `/mnt/documents/Relatorio_SCFV_Medianeira_v2.pdf`.
4. QA obrigatório: converter cada página em imagem (`pdftoppm`) e revisar visualmente — checar quebras de página, tabela do item 2 não cortada, citações legais com recuo correto, página de rosto com assinatura, ausência de #ERROR/placeholder. Corrigir e regenerar se algo estiver torto.
5. Devolver no chat com `<presentation-artifact>` para preview/download.

## Fora de escopo

- Não publica nada no site nem altera código do projeto.
- Não cria nova rota `/blog/...` (isso ficou em aberto na conversa anterior; pergunto depois).
- Não inventa dados novos do CAIA, de famílias ou de bairros — apenas humaniza o que já está no relatório.

Posso seguir e gerar o PDF v2?