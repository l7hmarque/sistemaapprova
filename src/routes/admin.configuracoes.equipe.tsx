import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useActiveOrg } from "@/hooks/use-active-org";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Copy, Trash2 } from "lucide-react";
import {
  criarConviteMembro,
  listarConvitesMembro,
  removerConviteMembro,
} from "@/lib/convites-membro.functions";

export const Route = createFileRoute("/admin/configuracoes/equipe")({
  component: EquipePage,
});

function EquipePage() {
  const { activeRole } = useCurrentUser();
  const { activeOrg, activeOrgId } = useActiveOrg();
  const qc = useQueryClient();
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"membro" | "admin">("membro");
  const [enviando, setEnviando] = useState(false);

  const criar = useServerFn(criarConviteMembro);
  const listar = useServerFn(listarConvitesMembro);
  const remover = useServerFn(removerConviteMembro);

  const { data: membros, isLoading } = useQuery({
    queryKey: ["org-members", activeOrgId],
    enabled: !!activeOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("user_id, role, criado_em")
        .eq("organization_id", activeOrgId!)
        .order("criado_em");
      if (error) throw error;
      return data;
    },
  });

  const { data: convites, isLoading: loadingConvites } = useQuery({
    queryKey: ["org-convites", activeOrgId],
    enabled: !!activeOrgId,
    queryFn: () => listar({ data: { organization_id: activeOrgId! } }),
  });

  if (!activeOrgId || !activeOrg)
    return <div className="p-6 text-sm text-muted-foreground">Sem organização vinculada.</div>;
  const podeGerenciar = activeRole === "owner" || activeRole === "admin";

  const removerMembro = async (userId: string) => {
    if (!confirm("Remover este membro da organização?")) return;
    setRemovendo(userId);
    const { error } = await supabase
      .from("organization_members")
      .delete()
      .eq("organization_id", activeOrgId)
      .eq("user_id", userId);
    setRemovendo(null);
    if (error) return toast.error("Sem permissão para remover");
    toast.success("Membro removido");
    qc.invalidateQueries({ queryKey: ["org-members", activeOrgId] });
  };

  const enviarConvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setEnviando(true);
    try {
      await criar({ data: { organization_id: activeOrgId, email, role } });
      toast.success("Convite enviado");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["org-convites", activeOrgId] });
    } catch (err: any) {
      toast.error(err?.message || "Erro ao convidar");
    } finally {
      setEnviando(false);
    }
  };

  const copiarLink = (token: string) => {
    const url = `${window.location.origin}/convite/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  };

  const cancelar = async (id: string) => {
    if (!confirm("Cancelar este convite?")) return;
    try {
      await remover({ data: { id } });
      toast.success("Convite cancelado");
      qc.invalidateQueries({ queryKey: ["org-convites", activeOrgId] });
    } catch (err: any) {
      toast.error(err?.message || "Erro");
    }
  };

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide">Membros</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : !membros?.length ? (
            <div className="text-sm text-muted-foreground">Nenhum membro.</div>
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
                        onClick={() => removerMembro(m.user_id)}
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

      {podeGerenciar && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wide">Convidar novo membro</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={enviarConvite} className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1">
                <Label className="text-xs">E-mail</Label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="pessoa@exemplo.com"
                />
              </div>
              <div className="sm:w-40">
                <Label className="text-xs">Papel</Label>
                <Select value={role} onValueChange={(v) => setRole(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="membro">Membro</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={enviando}>
                {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Convidar
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-2">
              O convidado recebe um e-mail com link. O link expira em 14 dias.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wide">Convites pendentes</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingConvites ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : !convites?.length ? (
            <div className="text-sm text-muted-foreground">Nenhum convite enviado.</div>
          ) : (
            <div className="divide-y divide-border">
              {convites.map((c: any) => {
                const expirado = new Date(c.expira_em) < new Date();
                return (
                  <div key={c.id} className="flex items-center justify-between py-3 gap-3">
                    <div className="min-w-0">
                      <div className="text-sm truncate">{c.email}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.aceito_em ? `Aceito em ${new Date(c.aceito_em).toLocaleDateString("pt-BR")}` :
                          expirado ? "Expirado" :
                          `Expira em ${new Date(c.expira_em).toLocaleDateString("pt-BR")}`} · {c.role}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {!c.aceito_em && !expirado && (
                        <Button variant="ghost" size="sm" onClick={() => copiarLink(c.token)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {podeGerenciar && !c.aceito_em && (
                        <Button variant="ghost" size="sm" onClick={() => cancelar(c.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
