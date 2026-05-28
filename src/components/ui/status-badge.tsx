import { cn } from "@/lib/utils";

export type StatusKind = "success" | "warning" | "danger" | "info" | "pending" | "neutral";

const CLASSES: Record<StatusKind, string> = {
  success: "bg-[var(--success-soft)] text-[var(--success)] border-[var(--success)]/30",
  warning: "bg-[var(--warning-soft)] text-[var(--warning)] border-[var(--warning)]/30",
  danger:  "bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger)]/30",
  info:    "bg-[var(--info-soft)] text-[var(--info)] border-[var(--info)]/30",
  pending: "bg-[var(--pending-soft)] text-[var(--pending)] border-[var(--pending)]/30",
  neutral: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({
  kind = "neutral",
  children,
  className,
}: {
  kind?: StatusKind;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        CLASSES[kind],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {children}
    </span>
  );
}
