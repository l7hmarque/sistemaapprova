import { useActiveOrg } from "@/hooks/use-active-org";
import { Building2, Check, ChevronsUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function OrgSwitcher() {
  const { orgs, activeOrg, setActiveOrgId } = useActiveOrg();
  if (orgs.length <= 1) return null;

  const escritorios = orgs.filter((o) => o.tipo === "escritorio");
  const oscs = orgs.filter((o) => o.tipo === "osc");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-card hover:bg-muted text-sm transition-colors max-w-[260px]">
          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="truncate font-medium">{activeOrg?.nome ?? "Selecionar organização"}</span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground shrink-0">
            {activeOrg?.tipo === "escritorio" ? "ESC" : "OSC"}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        {escritorios.length > 0 && (
          <>
            <DropdownMenuLabel className="text-xs uppercase tracking-widest text-muted-foreground">Escritórios</DropdownMenuLabel>
            {escritorios.map((o) => (
              <DropdownMenuItem key={o.id} onSelect={() => setActiveOrgId(o.id)}>
                <Check className={`h-4 w-4 mr-2 ${activeOrg?.id === o.id ? "opacity-100" : "opacity-0"}`} />
                <span className="truncate">{o.nome}</span>
              </DropdownMenuItem>
            ))}
            {oscs.length > 0 && <DropdownMenuSeparator />}
          </>
        )}
        {oscs.length > 0 && (
          <>
            <DropdownMenuLabel className="text-xs uppercase tracking-widest text-muted-foreground">OSCs</DropdownMenuLabel>
            {oscs.map((o) => (
              <DropdownMenuItem key={o.id} onSelect={() => setActiveOrgId(o.id)}>
                <Check className={`h-4 w-4 mr-2 ${activeOrg?.id === o.id ? "opacity-100" : "opacity-0"}`} />
                <span className="truncate">{o.nome}</span>
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
