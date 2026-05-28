/**
 * Logout limpo: encerra sessão no Supabase, limpa caches do React Query
 * e remove chaves de usuário em localStorage (org ativa, view-as, rascunhos).
 * Não toca em chaves de marketing/tour que sobrevivem entre contas.
 */
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const PREFIXOS_USUARIO = ["approva.", "synsit:rascunho", "orcamentos:rascunho"];

export async function signOutLimpo(queryClient?: QueryClient) {
  try {
    await supabase.auth.signOut();
  } catch {
    // ignora — vamos limpar o cliente mesmo se a chamada falhar
  }
  try {
    queryClient?.removeQueries();
  } catch {
    /* noop */
  }
  try {
    const remover: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (PREFIXOS_USUARIO.some((p) => k.startsWith(p))) remover.push(k);
    }
    remover.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* noop */
  }
}
