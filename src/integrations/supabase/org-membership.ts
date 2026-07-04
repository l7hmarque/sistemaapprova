/**
 * Helper de rigor multi-tenant para server functions (Milestone 1).
 *
 * Uso em qualquer createServerFn que grave/leia dados escopados por organização:
 *
 *   .middleware([requireSupabaseAuth])
 *   .inputValidator((d) => z.object({ activeOrgId: z.string().uuid(), ... }).parse(d))
 *   .handler(async ({ data, context }) => {
 *     await assertOrgMembership(context, data.activeOrgId);
 *     // ... queries usando data.activeOrgId
 *   });
 *
 * Rejeita chamadas onde o usuário autenticado não é membro da organização
 * informada (a menos que seja super_admin).
 */
export async function assertOrgMembership(
  context: { supabase: any; userId: string },
  activeOrgId: string,
): Promise<void> {
  const { supabase, userId } = context;

  // super_admin passa direto (usado para painel /owner)
  const { data: superAdmin } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "super_admin",
  });
  if (superAdmin === true) return;

  // membership direto
  const { data: direct } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("organization_id", activeOrgId)
    .maybeSingle();
  if (direct) return;

  // organização-filha de um escritório do qual o usuário é owner/admin
  const { data: parent } = await supabase
    .from("organizations")
    .select("parent_organization_id")
    .eq("id", activeOrgId)
    .maybeSingle();
  if (parent?.parent_organization_id) {
    const { data: parentMember } = await supabase
      .from("organization_members")
      .select("role")
      .eq("user_id", userId)
      .eq("organization_id", parent.parent_organization_id)
      .in("role", ["owner", "admin"])
      .maybeSingle();
    if (parentMember) return;
  }

  throw new Error("Forbidden: sem acesso à organização informada");
}
