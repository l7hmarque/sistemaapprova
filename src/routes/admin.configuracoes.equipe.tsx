import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/configuracoes/equipe")({
  component: EquipePage,
});

function EquipePage() {
  const { activeOrg, activeRole } = useCurrentUser();
  const qc = useQueryClient();
  const [removendo, setRemovendo] = useState<string | null>(null);

  const { data: membros, isLoading } = useQuery({
    queryKey: ["org-members", activeOrg?.id],
    enabled: !!activeOrg,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("user_id, role, criado_em")
        .eq("organization_id", activeOrg!.id)
        .order("criado_em");
      if (error) throw error;
      return data;
    },
  });

  if (!activeOrg) return <div className="text-sm text-muted-foreground">Sem organização vinculada.</div>;
  const podeGerenciar = activeRole === "owner" || activeRole === "admin";

  const remover = async (userId: string) => {
    if (!confirm("Remover este membro da organização?")) return;
    setRemovendo(userId);
    const { error } = await supabase
      .from("organization_members")
      .delete()
      .eq("organization_id", activeOrg.id)
      .eq("user_id", userId);
    setRemovendo(null);
    if (error) return toast.error("Sem permissão para remover");
    toast.success("Membro removido");
    qc.invalidateQueries({ queryKey: ["org-members", activeOrg.id] });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide">Membros</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : !membros?.length ? (
            <div className="text-sm text-muted-foreground">Nenhum membro além de você.</div>
          ) : (
            <div className="divide-y divide-border">
              {membros.map((m) => (
                <div key={m.user_id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm font-medium font-mono">{m.user_id.slice(0, 8)}…</div>
                    <div className="text-xs text-muted-foreground">
                      Desde {new Date(m.criado_em).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="uppercase">{m.role}</Badge>
                    {podeGerenciar && m.role !== "owner" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => remover(m.user_id)}
                        disabled={removendo === m.user_id}
                      >
                        Remover
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide">Convidar novo membro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Para convidar membros novos, peça que o e-mail crie uma conta em <code>/login</code> e em
            seguida envie o ID dele para o suporte Approva vincular à sua organização.
          </p>
          <p className="text-xs">
            Em breve: convite por e-mail direto desta tela.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
