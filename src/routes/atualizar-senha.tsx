import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/atualizar-senha")({
  component: AtualizarSenhaPage,
  head: () => ({ meta: [{ title: "Nova senha — Approva" }] }),
});

function AtualizarSenhaPage() {
  const nav = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (senha.length < 8) return toast.error("Use ao menos 8 caracteres");
    if (senha !== confirma) return toast.error("Senhas não conferem");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setLoading(false);
    if (error) return toast.error(error.message || "Erro ao atualizar");
    toast.success("Senha atualizada");
    nav({ to: "/admin", replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardContent className="p-6 space-y-5">
          <div>
            <div className="font-display text-2xl uppercase">Approva</div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">
              Definir nova senha
            </div>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label className="text-xs">Nova senha</Label>
              <Input
                type="password"
                required
                minLength={8}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div>
              <Label className="text-xs">Confirmar nova senha</Label>
              <Input
                type="password"
                required
                minLength={8}
                value={confirma}
                onChange={(e) => setConfirma(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar senha
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
