import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/esqueci-senha")({
  component: EsqueciSenhaPage,
  head: () => ({ meta: [{ title: "Recuperar senha — SynSIT" }] }),
});

function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/atualizar-senha`,
    });
    setLoading(false);
    if (error) return toast.error(error.message || "Erro ao enviar email");
    setEnviado(true);
    toast.success("Email de recuperação enviado");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardContent className="p-6 space-y-5">
          <div>
            <div className="font-display text-2xl uppercase">SynSIT</div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">
              Recuperar senha
            </div>
          </div>

          {enviado ? (
            <div className="text-sm text-muted-foreground space-y-3">
              <p>
                Se houver uma conta com <strong>{email}</strong>, você receberá
                um email com o link para redefinir a senha.
              </p>
              <p>Confira também a caixa de spam.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div>
                <Label className="text-xs">Email da conta</Label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar link
              </Button>
            </form>
          )}

          <Link to="/login" className="block text-center text-xs text-muted-foreground hover:text-foreground">
            ← voltar ao login
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
