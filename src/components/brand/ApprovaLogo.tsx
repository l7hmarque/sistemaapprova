import { Link } from "@tanstack/react-router";

type Variant = "full" | "mono" | "icon";

interface ApprovaLogoProps {
  variant?: Variant;
  /** Color used when not overridden by className */
  className?: string;
  withTagline?: boolean;
  asLink?: boolean;
  size?: "sm" | "md" | "lg";
}

const MARK_PX = { sm: 24, md: 30, lg: 40 } as const;
const WORD_CLASS = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-2xl",
} as const;
const TAG_CLASS = {
  sm: "text-[8px]",
  md: "text-[9px]",
  lg: "text-[10px]",
} as const;

function PrismaMark({ px }: { px: number }) {
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 32 32"
      role="img"
      aria-label="Approva"
      className="shrink-0"
    >
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <path d="M10 22V10l11 6-11 6z" fill="#fff" opacity="0.92" />
      <path d="M10 16l11-6-4 12-7-6z" className="fill-accent" opacity="0.9" />
    </svg>
  );
}

/**
 * Lockup de marca Approva — identidade Prisma Tecnologias.
 * Símbolo prisma (roxo + laranja) + wordmark "Approva" com assinatura "por Prisma".
 * O texto usa `currentColor` para herdar a cor do contexto (claro/escuro/superfície escura).
 */
export function ApprovaLogo({
  variant = "full",
  className = "",
  withTagline = false,
  asLink = false,
  size = "md",
}: ApprovaLogoProps) {
  const px = MARK_PX[size];

  const content =
    variant === "icon" ? (
      <span className={`inline-flex items-center ${className}`}>
        <PrismaMark px={px} />
      </span>
    ) : (
      <span className={`inline-flex items-center gap-2 ${className}`}>
        <PrismaMark px={px} />
        <span className="flex flex-col leading-none">
          <span
            className={`font-display font-bold leading-none ${WORD_CLASS[size]}`}
            style={{ letterSpacing: "-0.02em" }}
          >
            Approva
          </span>
          <span
            className={`uppercase tracking-[0.16em] opacity-60 font-sans mt-0.5 ${TAG_CLASS[size]}`}
          >
            {variant === "mono" ? "por Prisma" : withTagline ? "contas em ordem" : "por Prisma"}
          </span>
        </span>
      </span>
    );

  if (asLink) {
    return (
      <Link to="/" className="inline-flex items-center group" aria-label="Approva — Início">
        {content}
      </Link>
    );
  }

  return content;
}
