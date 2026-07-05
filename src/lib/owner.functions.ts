import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DriveQueueStats = {
  pendente: number;
  em_andamento: number;
  falhou_retry: number;
  falhou_permanente: number;
  concluido_24h: number;
  atrasados: number;
};

export const getDriveQueueStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DriveQueueStats> => {
    const { data: isSuper } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!isSuper) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const nowIso = new Date().toISOString();
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [pend, em, retry, fail, done, atras] = await Promise.all([
      supabaseAdmin.from("drive_sync_queue").select("id", { count: "exact", head: true }).eq("status", "pendente"),
      supabaseAdmin.from("drive_sync_queue").select("id", { count: "exact", head: true }).eq("status", "em_andamento"),
      supabaseAdmin.from("drive_sync_queue").select("id", { count: "exact", head: true }).eq("status", "falhou_retry"),
      supabaseAdmin.from("drive_sync_queue").select("id", { count: "exact", head: true }).eq("status", "falhou_permanente"),
      supabaseAdmin.from("drive_sync_queue").select("id", { count: "exact", head: true }).eq("status", "concluido").gte("atualizado_em", last24h),
      supabaseAdmin.from("drive_sync_queue").select("id", { count: "exact", head: true }).in("status", ["pendente", "falhou_retry"]).lt("proximo_retry", nowIso),
    ]);

    return {
      pendente: pend.count ?? 0,
      em_andamento: em.count ?? 0,
      falhou_retry: retry.count ?? 0,
      falhou_permanente: fail.count ?? 0,
      concluido_24h: done.count ?? 0,
      atrasados: atras.count ?? 0,
    };
  });
