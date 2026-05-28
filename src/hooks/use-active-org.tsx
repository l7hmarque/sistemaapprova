import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./use-current-user";

type Org = {
  id: string;
  nome: string;
  tipo: "osc" | "escritorio";
  parent_organization_id: string | null;
  plano: string;
  status: "trial" | "ativo" | "suspenso" | "cancelado";
  trial_ate: string | null;
};

type ActiveOrgValue = {
  activeOrgId: string | null;
  setActiveOrgId: (id: string) => void;
  orgs: Org[];
  loading: boolean;
  activeOrg: Org | null;
  activeRole: "owner" | "admin" | "membro" | null;
};

const KEY = "approva.activeOrgId";
const Ctx = createContext<ActiveOrgValue | null>(null);

export function ActiveOrgProvider({ children }: { children: ReactNode }) {
  const { memberships, user, loading: userLoading } = useCurrentUser();
  const queryClient = useQueryClient();
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(null);

  // memberships dá orgs onde sou membro direto. Para escritórios,
  // user_orgs() inclui filhas via parent_organization_id — buscamos elas também.
  const childrenQ = useQuery({
    queryKey: ["org-children", user?.id, memberships.map((m) => m.organization_id).join(",")],
    enabled: !!user && memberships.some((m) => m.organizations?.tipo === "escritorio"),
    queryFn: async () => {
      const parents = memberships
        .filter((m) => m.organizations?.tipo === "escritorio" && (m.role === "owner" || m.role === "admin"))
        .map((m) => m.organization_id);
      if (parents.length === 0) return [] as Org[];
      const { data, error } = await supabase
        .from("organizations")
        .select("id, nome, tipo, parent_organization_id, plano, status, trial_ate")
        .in("parent_organization_id", parents);
      if (error) throw error;
      return (data ?? []) as Org[];
    },
  });

  const directOrgs: Org[] = memberships
    .map((m) => m.organizations)
    .filter((o): o is NonNullable<typeof o> => !!o)
    .map((o) => ({
      id: o.id,
      nome: o.nome,
      tipo: o.tipo,
      parent_organization_id: o.parent_organization_id,
      plano: o.plano,
      status: o.status,
      trial_ate: o.trial_ate,
    }));

  const all: Org[] = [...directOrgs, ...(childrenQ.data ?? [])];
  // dedup
  const orgs = Array.from(new Map(all.map((o) => [o.id, o])).values());

  useEffect(() => {
    if (!user) return;
    try {
      const stored = localStorage.getItem(KEY);
      if (stored && orgs.some((o) => o.id === stored)) {
        setActiveOrgIdState(stored);
        return;
      }
    } catch {}
    if (orgs.length > 0 && !activeOrgId) {
      setActiveOrgIdState(orgs[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, orgs.length]);

  const setActiveOrgId = (id: string) => {
    if (id === activeOrgId) return;
    setActiveOrgIdState(id);
    try {
      localStorage.setItem(KEY, id);
      // Limpa rascunhos e fila de captura escopados pela org anterior
      localStorage.removeItem("synsit:rascunho-auto");
    } catch {}
    // Invalida todo o cache pra não vazar dados da org anterior
    queryClient.removeQueries();
  };

  const activeOrg = orgs.find((o) => o.id === activeOrgId) ?? null;
  // Papel do usuário na org ativa. Para orgs-filhas (escritório → OSC), herda
  // o papel da org-mãe quando o usuário não é membro direto da filha.
  const directRole = memberships.find((m) => m.organization_id === activeOrgId)?.role ?? null;
  const inheritedRole = activeOrg?.parent_organization_id
    ? memberships.find((m) => m.organization_id === activeOrg.parent_organization_id)?.role ?? null
    : null;
  const activeRole = directRole ?? inheritedRole;

  return (
    <Ctx.Provider value={{ activeOrgId, setActiveOrgId, orgs, loading: userLoading || childrenQ.isLoading, activeOrg, activeRole }}>
      {children}
    </Ctx.Provider>
  );
}

export function useActiveOrg(): ActiveOrgValue {
  const v = useContext(Ctx);
  if (!v) return { activeOrgId: null, setActiveOrgId: () => {}, orgs: [], loading: false, activeOrg: null, activeRole: null };
  return v;
}
