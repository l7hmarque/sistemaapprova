import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ViewAsRole = "real" | "owner" | "admin" | "membro";
export type ViewAsTipo = "real" | "osc" | "escritorio";

type ViewAsValue = {
  role: ViewAsRole;
  tipo: ViewAsTipo;
  setRole: (r: ViewAsRole) => void;
  setTipo: (t: ViewAsTipo) => void;
  reset: () => void;
  isOverriding: boolean;
};

const KEY_ROLE = "approva.viewAs.role";
const KEY_TIPO = "approva.viewAs.tipo";

const Ctx = createContext<ViewAsValue | null>(null);

export function ViewAsProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<ViewAsRole>("real");
  const [tipo, setTipoState] = useState<ViewAsTipo>("real");

  useEffect(() => {
    try {
      const r = localStorage.getItem(KEY_ROLE) as ViewAsRole | null;
      const t = localStorage.getItem(KEY_TIPO) as ViewAsTipo | null;
      if (r) setRoleState(r);
      if (t) setTipoState(t);
    } catch {}
  }, []);

  const setRole = (r: ViewAsRole) => {
    setRoleState(r);
    try { localStorage.setItem(KEY_ROLE, r); } catch {}
  };
  const setTipo = (t: ViewAsTipo) => {
    setTipoState(t);
    try { localStorage.setItem(KEY_TIPO, t); } catch {}
  };
  const reset = () => {
    setRole("real");
    setTipo("real");
  };

  return (
    <Ctx.Provider value={{ role, tipo, setRole, setTipo, reset, isOverriding: role !== "real" || tipo !== "real" }}>
      {children}
    </Ctx.Provider>
  );
}

export function useViewAs(): ViewAsValue {
  const v = useContext(Ctx);
  if (!v) return { role: "real", tipo: "real", setRole: () => {}, setTipo: () => {}, reset: () => {}, isOverriding: false };
  return v;
}
