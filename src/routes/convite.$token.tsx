import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { aceitarConviteMembro } from "@/lib/convites-membro.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/convite/$token")({
  component: ConvitePage,
  head: () => ({ meta: [{ title: "Convite — Approva" }] }),
});

function ConvitePage() {
  const { token } = useParams({ from: "/convite/$token" });
  const nav = useNavigate();
  const aceitar = useServerFn(aceitarConviteMembro);
  const [estado, setEstado] = useState<"verificando" | "logar" | "pronto" | "ok" | "erro">("verificando");
  const [msg, setMsg] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEstado(data.session ? "pronto" : "logar");
    });
  }, []);

  const aceitarAgora = async () => {
    setLoading(true);
    try {
      const r = await aceitar({ data: { token } });
      setEstado("ok");
      toast.success("Convite aceito");
      try { localStorage.setItem("approva.activeOrgId", (r as any).organization_id); } catch {}
      setTimeout(() => nav({ to: "/_authenticated/admin", replace: true }), 800);
    } catch (e: any) {
      setMsg(e?.message || "Erro ao aceitar convite");
      setEstado("erro");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardContent className="p-6 space-y-4">
          <div>
            <div className="font-display text-2xl uppercase">Approva</div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Convite de equipe</div>
          </div>

          {estado === "verificando" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Verificando…
            </div>
          )}

          {estado === "logar" && (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Entre na sua conta para aceitar o convite. Se ainda não tem conta, crie uma com o mesmo e-mail do convite.
              </p>
              <Button asChild className="w-full">
                <Link to="/login" search={{ redirect: `/convite/${token}` }}>Entrar / Criar conta</Link>
              </Button>
            </div>
          )}

          {estado === "pronto" && (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">Confirme abaixo para entrar na organização.</p>
              <Button className="w-full" onClick={aceitarAgora} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Aceitar convite
              </Button>
            </div>
          )}

          {estado === "ok" && (
            <div className="text-sm text-emerald-700 dark:text-emerald-400">
              Convite aceito. Redirecionando…
            </div>
          )}

          {estado === "erro" && (
            <div className="space-y-3 text-sm">
              <p className="text-destructive">{msg}</p>
              <Button asChild variant="outline" className="w-full">
                <Link to="/admin">Ir para o painel</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
