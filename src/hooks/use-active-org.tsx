import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./use-current-user";

type Org = {
  id: string;
  nome: string;
  tipo: "osc" | "escritorio";
  parent_organization_id: string | null;
};

type ActiveOrgValue = {
  activeOrgId: string | null;
  setActiveOrgId: (id: string) => void;
  orgs: Org[];
  loading: boolean;
  activeOrg: Org | null;
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
        .select("id, nome, tipo, parent_organization_id")
        .in("parent_organization_id", parents);
      if (error) throw error;
      return (data ?? []) as Org[];
    },
  });

  const directOrgs: Org[] = memberships
    .map((m) => m.organizations)
    .filter((o): o is NonNullable<typeof o> => !!o)
    .map((o) => ({ id: o.id, nome: o.nome, tipo: o.tipo, parent_organization_id: o.parent_organization_id }));

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

  return (
    <Ctx.Provider value={{ activeOrgId, setActiveOrgId, orgs, loading: userLoading || childrenQ.isLoading, activeOrg }}>
      {children}
    </Ctx.Provider>
  );
}

export function useActiveOrg(): ActiveOrgValue {
  const v = useContext(Ctx);
  if (!v) return { activeOrgId: null, setActiveOrgId: () => {}, orgs: [], loading: false, activeOrg: null };
  return v;
}
