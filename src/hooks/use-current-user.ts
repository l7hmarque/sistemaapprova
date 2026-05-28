import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";


export type Membership = {
  organization_id: string;
  role: "owner" | "admin" | "membro";
  organizations: {
    id: string;
    nome: string;
    tipo: "osc" | "escritorio";
    plano: string;
    status: "trial" | "ativo" | "suspenso" | "cancelado";
    trial_ate: string | null;
    parent_organization_id: string | null;
  } | null;
};

export function useCurrentUser() {
  const { user, loading } = useAuth();

  const memberships = useQuery({
    queryKey: ["memberships", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select(
          "organization_id, role, organizations:organizations!inner(id, nome, tipo, plano, status, trial_ate, parent_organization_id)"
        )
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as unknown as Membership[];
    },
  });

  const role = useQuery({
    queryKey: ["user-role", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.role);
    },
  });

  const isSuperAdmin = (role.data ?? []).includes("super_admin");

  // Marca o navegador como tráfego interno quando o usuário é super_admin,
  // para que o analytics público ignore as visitas dele em todas as rotas.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (isSuperAdmin) localStorage.setItem("synsit_interno", "1");
    } catch {}
  }, [isSuperAdmin]);

  return {
    user,
    loading: loading || memberships.isLoading || role.isLoading,
    memberships: memberships.data ?? [],
    isSuperAdmin,
  };
}


