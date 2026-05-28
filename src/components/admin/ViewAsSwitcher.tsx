import { useViewAs, type ViewAsRole, type ViewAsTipo } from "@/hooks/use-view-as";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Eye, EyeOff } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ROLES: { value: ViewAsRole; label: string }[] = [
  { value: "real", label: "Sem override (super admin)" },
  { value: "owner", label: "Owner / proprietário" },
  { value: "admin", label: "Admin" },
  { value: "membro", label: "Membro" },
];
const TIPOS: { value: ViewAsTipo; label: string }[] = [
  { value: "real", label: "Tipo real da org" },
  { value: "osc", label: "OSC" },
  { value: "escritorio", label: "Escritório contábil" },
];

export function ViewAsSwitcher() {
  const { isSuperAdmin } = useCurrentUser();
  const { role, tipo, setRole, setTipo, reset, isOverriding } = useViewAs();
  if (!isSuperAdmin) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={[
            "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
            isOverriding
              ? "bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-200"
              : "text-foreground hover:bg-muted",
          ].join(" ")}
        >
          {isOverriding ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          <span className="font-medium truncate">
            {isOverriding ? `Ver como ${role !== "real" ? role : ""}${role !== "real" && tipo !== "real" ? " · " : ""}${tipo !== "real" ? tipo : ""}` : "Ver como…"}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-64">
        <DropdownMenuLabel className="text-xs uppercase tracking-wide">Papel efetivo</DropdownMenuLabel>
        {ROLES.map((r) => (
          <DropdownMenuItem key={r.value} onSelect={() => setRole(r.value)}>
            <span className={role === r.value ? "font-semibold" : ""}>{r.label}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs uppercase tracking-wide">Tipo de organização</DropdownMenuLabel>
        {TIPOS.map((t) => (
          <DropdownMenuItem key={t.value} onSelect={() => setTipo(t.value)}>
            <span className={tipo === t.value ? "font-semibold" : ""}>{t.label}</span>
          </DropdownMenuItem>
        ))}
        {isOverriding && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={reset} className="text-destructive">
              Limpar override
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
