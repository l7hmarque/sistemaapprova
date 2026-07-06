import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, FileSpreadsheet, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/modelos/ajuda")({ component: AjudaModelos });

function AjudaModelos() {
  return (
    <AdminShell
      title="Como preparar seus modelos"
      subtitle="Estrutura mínima que cada planilha precisa ter para o Approva preencher sem erros."
      module="modelos"
      backTo="/admin/modelos"
    >
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-base">1. Orçamento</CardTitle>
              <Badge variant="secondary">.xlsx ou Google Sheets</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <Section title="Aba">
              Uma única aba ativa (padrão: <code>Orcamento</code>). Não use abas auxiliares no mesmo arquivo.
            </Section>
            <Section title="Cabeçalho fixo (linhas 1 → N)">
              Pode haver logo, dados da OSC, do edital e do fornecedor nas linhas iniciais. O Approva preenche os marcadores abaixo se encontrá-los em qualquer célula:
              <ul className="mt-2 ml-4 list-disc space-y-1 text-muted-foreground">
                <li><code>{"{{FORNECEDOR}}"}</code> — razão social</li>
                <li><code>{"{{CNPJ}}"}</code> — apenas dígitos serão validados</li>
                <li><code>{"{{DATA}}"}</code> — data de emissão (dd/mm/aaaa)</li>
                <li><code>{"{{OBJETO}}"}</code> — descrição do objeto cotado</li>
                <li><code>{"{{NUMERO}}"}</code> — número do orçamento</li>
              </ul>
            </Section>
            <Section title="Linha do primeiro item">
              Indique no cadastro do modelo a linha onde começa o primeiro item (ex.: linha <strong>14</strong>). A partir daí, cada item ocupa uma linha.
            </Section>
            <Section title="Colunas obrigatórias da linha de item">
              <Table rows={[
                ["A", "Item / nº sequencial"],
                ["B", "Descrição"],
                ["C", "Unidade (un, cx, kg…)"],
                ["D", "Quantidade (número)"],
                ["E", "Valor unitário (número, 2 casas)"],
                ["F", "Valor total (fórmula =D*E)"],
              ]} />
            </Section>
            <Section title="Linha de totais">
              Informe a linha onde aparece o total geral (ex.: linha <strong>18</strong>). Deve conter a soma na coluna F.
            </Section>
            <Checklist items={[
              "Linhas de item contíguas (sem mesclar)",
              "Sem fórmulas externas (apenas =SOMA, =D*E)",
              "Formato de número com 2 casas decimais, separador vírgula",
              "Sem colunas escondidas entre A e F",
            ]} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
              <CardTitle className="text-base">2. Mapa Comparativo</CardTitle>
              <Badge variant="secondary">.xlsx ou Google Sheets</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <Section title="Aba">
              Padrão <code>MapaComparativo</code>. Uma aba por mapa.
            </Section>
            <Section title="Cabeçalho">
              Pode conter logo, edital, objeto. Marcadores aceitos: <code>{"{{OBJETO}}"}</code>, <code>{"{{NUMERO}}"}</code>, <code>{"{{DATA}}"}</code>.
            </Section>
            <Section title="Estrutura de colunas (linha 19 por padrão)">
              <Table rows={[
                ["A", "Item"],
                ["B", "Descrição"],
                ["C", "Unidade"],
                ["D", "Quantidade"],
                ["E–F", "Fornecedor 1 — Vlr unit / Vlr total"],
                ["G–H", "Fornecedor 2 — Vlr unit / Vlr total"],
                ["I–J", "Fornecedor 3 — Vlr unit / Vlr total"],
                ["K", "Menor preço (fórmula =MÍNIMO)"],
                ["L", "Fornecedor vencedor"],
              ]} />
            </Section>
            <Section title="Totais por fornecedor">
              Última linha (padrão 22) deve somar F, H e J. O Approva lê esses valores para gerar o ranking.
            </Section>
            <Checklist items={[
              "Mesma quantidade de itens entre os 3 fornecedores",
              "Não mesclar células no bloco de itens",
              "Não sobrescrever fórmulas — o Approva nunca toca em K e L",
            ]} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-base">3. Controle Bancário</CardTitle>
              <Badge variant="secondary">.xlsx ou Google Sheets</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <Section title="Aba">
              Padrão <code>Controle</code>. Uma aba por conta bancária / termo.
            </Section>
            <Section title="Cabeçalho (linha 1)">
              Cabeçalho fixo, colunas obrigatórias na ordem:
              <Table rows={[
                ["A", "Data (dd/mm/aaaa)"],
                ["B", "Histórico / descrição"],
                ["C", "Documento (nº NF, cheque, OP)"],
                ["D", "Débito (saída) — número 2 casas"],
                ["E", "Crédito (entrada) — número 2 casas"],
                ["F", "Saldo (fórmula contínua)"],
                ["G", "Categoria / rubrica"],
                ["H", "Observações"],
              ]} />
            </Section>
            <Section title="Linha do primeiro lançamento">
              Padrão linha <strong>2</strong>. A partir daí cada lançamento ocupa uma linha.
            </Section>
            <Checklist items={[
              "Datas no formato dd/mm/aaaa (sem texto livre)",
              "Separador decimal: vírgula (1.234,56)",
              "Apenas um dos lados preenchido por linha (débito OU crédito)",
              "Saldo na primeira linha igual ao saldo inicial do mês",
              "Sem linhas em branco no meio dos lançamentos",
            ]} />
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/40 dark:bg-amber-950/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-base">Checklist geral antes de subir o modelo</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Checklist items={[
              "Compartilhamento do Google Sheets: 'Qualquer pessoa com o link → Editor'",
              "Linhas de item NÃO podem estar mescladas",
              "Sem proteção de planilha ou intervalo",
              "Tamanho do arquivo abaixo de 5 MB",
              "Confira a linha do primeiro item e linha de totais antes de salvar",
            ]} />
            <Link to="/admin/modelos" className="mt-6 inline-flex items-center text-sm text-primary hover:underline">
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar para Modelos
            </Link>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1.5">{title}</div>
      <div className="text-foreground leading-relaxed">{children}</div>
    </div>
  );
}

function Table({ rows }: { rows: [string, string][] }) {
  return (
    <div className="mt-2 overflow-x-auto rounded-md border border-border">
      <table className="w-full text-xs">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left px-3 py-1.5 w-16 font-medium">Coluna</th>
            <th className="text-left px-3 py-1.5 font-medium">Conteúdo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([c, d]) => (
            <tr key={c} className="border-t border-border">
              <td className="px-3 py-1.5 font-mono text-muted-foreground">{c}</td>
              <td className="px-3 py-1.5">{d}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Checklist({ items }: { items: string[] }) {
  return (
    <ul className="mt-2 space-y-1.5">
      {items.map((i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" />
          <span>{i}</span>
        </li>
      ))}
    </ul>
  );
}
