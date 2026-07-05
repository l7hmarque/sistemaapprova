/**
 * Infográfico do fluxo mensal de prestação de contas com o Approva.
 * Duas raias horizontais (Gestor OSC e Contador) mostrando as etapas
 * ao longo do mês. SVG inline, responsivo, com <title>/<desc> para
 * leitores de tela. Sem menção a "IA" — só ao fluxo de trabalho.
 */

const NAVY = "#1a2a44";
const NAVY_SOFT = "#334966";
const BLUE = "#3b6fa0";
const CREAM = "#f6efe0";
const CREAM_SOFT = "#faf5ea";
const LINE = "#d9d0bd";
const ACCENT = "#c9a84c";
const MUTED = "#6b6555";

type Etapa = {
  fase: string;
  gestor: { titulo: string; detalhe: string };
  contador: { titulo: string; detalhe: string };
};

const ETAPAS: Etapa[] = [
  {
    fase: "Dia 1 · Repasse entra",
    gestor: {
      titulo: "Registra o convênio ou termo",
      detalhe: "Valor, vigência e rubricas ficam prontos para lançar despesas o mês inteiro.",
    },
    contador: {
      titulo: "Confere abertura do período",
      detalhe: "Saldo inicial e categorias herdadas do mês anterior — sem digitar de novo.",
    },
  },
  {
    fase: "Ao longo do mês · Despesa acontece",
    gestor: {
      titulo: "Envia documentos pelo Approva",
      detalhe: "NF-e, boleto, holerite ou PDF — o sistema lê e propõe a categoria certa.",
    },
    contador: {
      titulo: "Revisa fornecedor e rubrica",
      detalhe: "Painel único com o que ainda falta comprovante e o que precisa de segunda mão.",
    },
  },
  {
    fase: "Fim do mês · Aprovação",
    gestor: {
      titulo: "Aprova em duas mãos",
      detalhe: "Solicitante e responsável assinam. Trilha de auditoria fica salva.",
    },
    contador: {
      titulo: "Fecha o período",
      detalhe: "Concilia com extrato bancário. Homologado, ninguém mais altera.",
    },
  },
  {
    fase: "Entrega · Órgão repassador",
    gestor: {
      titulo: "Recebe o relatório",
      detalhe: "PDF pronto para conselho, diretoria e financiador.",
    },
    contador: {
      titulo: "Exporta para TCE-PR ou município",
      detalhe: "Arquivo no formato oficial exigido pelo controle externo, sem retrabalho.",
    },
  },
];

export function FluxoMensal() {
  const cols = ETAPAS.length;
  const W = 1120;
  const H = 520;
  const padX = 32;
  const colW = (W - padX * 2) / cols;
  const laneH = 160;
  const headerH = 96;
  const gestorY = headerH + 20;
  const contadorY = gestorY + laneH + 40;

  return (
    <section className="bg-brand-cream-soft border-y border-brand-line">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-widest text-brand-blue font-medium">
            Fluxo mensal
          </p>
          <h2 className="mt-3 text-3xl md:text-4xl font-serif text-brand-navy leading-tight">
            Como fica a rotina do gestor de OSC e do contador.
          </h2>
          <p className="mt-4 text-brand-muted leading-relaxed">
            Cada mês tem quatro momentos. O Approva conecta os dois lados —
            quem opera a OSC e quem responde tecnicamente pela prestação —
            para que ninguém trabalhe duas vezes o mesmo documento.
          </p>
        </div>

        <div className="mt-12 overflow-x-auto">
          <svg
            role="img"
            aria-labelledby="fluxo-title fluxo-desc"
            viewBox={`0 0 ${W} ${H}`}
            className="min-w-[900px] w-full h-auto"
          >
            <title id="fluxo-title">
              Fluxo mensal de prestação de contas no Approva
            </title>
            <desc id="fluxo-desc">
              Quatro etapas em duas raias: gestor da OSC e contador. Do
              registro do repasse até a exportação para TCE-PR ou município.
            </desc>

            {/* Header — fase */}
            {ETAPAS.map((e, i) => {
              const x = padX + colW * i;
              return (
                <g key={`h-${i}`}>
                  <rect
                    x={x + 8}
                    y={16}
                    width={colW - 16}
                    height={56}
                    rx={10}
                    fill={NAVY}
                  />
                  <text
                    x={x + colW / 2}
                    y={40}
                    textAnchor="middle"
                    fill={CREAM}
                    fontSize={11}
                    fontFamily="Inter, system-ui, sans-serif"
                    fontWeight={600}
                    letterSpacing={2}
                  >
                    {`ETAPA ${String(i + 1).padStart(2, "0")}`}
                  </text>
                  <text
                    x={x + colW / 2}
                    y={60}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize={13}
                    fontFamily="Inter, system-ui, sans-serif"
                    fontWeight={500}
                  >
                    {e.fase}
                  </text>
                </g>
              );
            })}

            {/* Raia Gestor */}
            <LaneLabel y={gestorY + laneH / 2} label="Gestor OSC" color={BLUE} />
            {ETAPAS.map((e, i) => {
              const x = padX + colW * i;
              return (
                <Card
                  key={`g-${i}`}
                  x={x + 8}
                  y={gestorY}
                  w={colW - 16}
                  h={laneH}
                  titulo={e.gestor.titulo}
                  detalhe={e.gestor.detalhe}
                  fill="#ffffff"
                  border={LINE}
                  accent={BLUE}
                />
              );
            })}

            {/* Raia Contador */}
            <LaneLabel y={contadorY + laneH / 2} label="Contador" color={ACCENT} />
            {ETAPAS.map((e, i) => {
              const x = padX + colW * i;
              return (
                <Card
                  key={`c-${i}`}
                  x={x + 8}
                  y={contadorY}
                  w={colW - 16}
                  h={laneH}
                  titulo={e.contador.titulo}
                  detalhe={e.contador.detalhe}
                  fill={CREAM}
                  border={LINE}
                  accent={ACCENT}
                />
              );
            })}

            {/* Setas de progressão entre colunas (raia gestor) */}
            {ETAPAS.slice(0, -1).map((_, i) => {
              const x = padX + colW * (i + 1);
              return (
                <g key={`a-g-${i}`}>
                  <Arrow x={x} y={gestorY + laneH / 2} color={BLUE} />
                  <Arrow x={x} y={contadorY + laneH / 2} color={ACCENT} />
                </g>
              );
            })}
          </svg>
        </div>

        <p className="mt-8 text-sm text-brand-muted max-w-3xl leading-relaxed">
          O mesmo mês, dois papéis, uma única base de documentos. O gestor
          nunca envia planilha por email; o contador nunca precisa redigitar
          o que já foi lançado.
        </p>
      </div>
    </section>
  );
}

function LaneLabel({ y, label, color }: { y: number; label: string; color: string }) {
  return (
    <g transform={`translate(0 ${y})`}>
      <text
        x={20}
        y={0}
        fill={color}
        fontSize={11}
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight={700}
        letterSpacing={2}
        transform="rotate(-90 20 0)"
        textAnchor="middle"
      >
        {label.toUpperCase()}
      </text>
    </g>
  );
}

function Card({
  x, y, w, h, titulo, detalhe, fill, border, accent,
}: {
  x: number; y: number; w: number; h: number;
  titulo: string; detalhe: string;
  fill: string; border: string; accent: string;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={12} fill={fill} stroke={border} />
      <rect x={x} y={y} width={4} height={h} rx={2} fill={accent} />
      <foreignObject x={x + 16} y={y + 14} width={w - 32} height={h - 28}>
        <div
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            color: NAVY,
            fontSize: 14,
            fontWeight: 600,
            lineHeight: 1.3,
          }}
        >
          {titulo}
          <div
            style={{
              marginTop: 8,
              color: MUTED,
              fontSize: 12,
              fontWeight: 400,
              lineHeight: 1.5,
            }}
          >
            {detalhe}
          </div>
        </div>
      </foreignObject>
    </g>
  );
}

function Arrow({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g>
      <line x1={x - 12} y1={y} x2={x + 4} y2={y} stroke={color} strokeWidth={2} />
      <polygon
        points={`${x + 4},${y - 5} ${x + 12},${y} ${x + 4},${y + 5}`}
        fill={color}
      />
    </g>
  );
}
