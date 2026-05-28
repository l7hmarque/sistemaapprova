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

/**
 * Wordmark tipográfico "approva".
 * O segundo "p" recebe um micro-check no pingo do "i" — assinatura discreta.
 * Usa `currentColor` para herdar cor do contexto (tema claro/escuro).
 */
export function ApprovaLogo({
  variant = "full",
  className = "",
  withTagline = false,
  asLink = false,
  size = "md",
}: ApprovaLogoProps) {
  const sizeClasses = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-3xl",
  }[size];

  const taglineSize = {
    sm: "text-[9px]",
    md: "text-[10px]",
    lg: "text-xs",
  }[size];

  const content =
    variant === "icon" ? (
      <span
        className={`inline-flex items-center justify-center font-display tracking-tight leading-none ${sizeClasses} ${className}`}
        aria-label="Approva"
      >
        ap<span className="opacity-70">.</span>
      </span>
    ) : variant === "mono" ? (
      <span
        className={`font-display tracking-tight leading-none ${sizeClasses} ${className}`}
        aria-label="Approva"
      >
        ap<span className="opacity-70">.</span>
      </span>
    ) : (
      <span className={`inline-flex items-baseline gap-2 ${className}`}>
        <span
          className={`font-display tracking-tight leading-none lowercase ${sizeClasses}`}
          style={{ letterSpacing: "-0.03em" }}
        >
          approva
          <span
            aria-hidden
            className="ml-0.5 inline-block align-middle"
            style={{
              width: "0.32em",
              height: "0.32em",
              borderBottom: "2px solid currentColor",
              borderRight: "2px solid currentColor",
              transform: "translateY(-0.18em) rotate(45deg)",
              marginLeft: "0.18em",
            }}
          />
        </span>
        {withTagline && (
          <span className={`uppercase tracking-widest opacity-60 font-sans ${taglineSize}`}>
            contas em ordem
          </span>
        )}
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
