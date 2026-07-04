import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ApprovaLogo } from "@/components/brand/ApprovaLogo";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/login")({
  validateSearch: (s) => searchSchema.parse(s),
  component: LoginPage,
  head: () => ({ meta: [{ title: "Entrar — Approva" }] }),
});

function LoginPage() {
  const nav = useNavigate();
  const { redirect } = useSearch({ from: "/login" });
  const dest = redirect || "/admin";
  const goDest = () => { window.location.assign(dest); };
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [modo, setModo] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);

  // Redireciona se já estiver logado
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav({ to: dest, replace: true });
    });
  }, [dest, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (modo === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
        toast.success("Bem-vindo!");
        nav({ to: dest, replace: true });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: { emailRedirectTo: window.location.origin + "/admin" },
        });
        if (error) throw error;
        // E-mail de boas-vindas (best-effort, não bloqueia o fluxo)
        try {
          const { enviarEmail } = await import("@/lib/email.functions");
          const { tplBoasVindas } = await import("@/lib/email-templates");
          const { subject, html } = tplBoasVindas(email, window.location.origin + "/admin");
          await enviarEmail({ data: { to: email, subject, html } });
        } catch (e) {
          console.warn("[signup] welcome email falhou:", e);
        }
        toast.success("Conta criada. Você já pode entrar.");
        setModo("login");
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro na autenticação");
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setLoading(true);
    try {
      const r = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + dest,
      });
      if (r.error) throw r.error;
    } catch (err: any) {
      toast.error(err?.message || "Erro com Google");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardContent className="p-6 space-y-5">
          <div>
            <ApprovaLogo size="lg" />
            <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">
              {modo === "login" ? "Entrar no painel" : "Criar conta"}
            </div>
          </div>

          <Button type="button" variant="outline" className="w-full" onClick={google} disabled={loading}>
            Entrar com Google
          </Button>

          <div className="relative text-center text-xs text-muted-foreground">
            <span className="bg-card px-2 relative z-10">ou com email</span>
            <div className="absolute inset-x-0 top-1/2 border-t border-border" />
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label className="text-xs">Email</Label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div>
              <Label className="text-xs">Senha</Label>
              <Input
                type="password"
                required
                minLength={6}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete={modo === "login" ? "current-password" : "new-password"}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {modo === "login" ? "Entrar" : "Criar conta"}
            </Button>
          </form>

          <div className="flex flex-col gap-2 text-xs">
            <div className="flex justify-between">
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setModo(modo === "login" ? "signup" : "login")}
              >
                {modo === "login" ? "Criar conta" : "Já tenho conta"}
              </button>
              {modo === "login" && (
                <Link to="/esqueci-senha" className="text-muted-foreground hover:text-foreground">
                  Esqueci a senha
                </Link>
              )}
            </div>
            <Link to="/" className="text-center text-muted-foreground hover:text-foreground">
              ← voltar ao site
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
