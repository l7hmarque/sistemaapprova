import { type ReactNode } from "react";
import { useLocation, Link } from "@tanstack/react-router";
import { useActiveOrg } from "@/hooks/use-active-org";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Lock } from "lucide-react";

/**
 * Bloqueia o acesso ao painel quando a organização ativa está com:
 * - status = "suspenso" ou "cancelado"
 * - status = "trial" com trial_ate no passado
 *
 * Owner/admin continuam podendo navegar em /admin/configuracoes para
 * acertar dados, contato e ver instruções de pagamento.
 */
export function PlanoGuard({ children }: { children: ReactNode }) {
  const { activeOrg, activeRole, loading } = useActiveOrg();
  const location = useLocation();

  if (loading || !activeOrg) return <>{children}</>;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const trialVencido =
    activeOrg.status === "trial" &&
    !!activeOrg.trial_ate &&
    new Date(activeOrg.trial_ate) < hoje;

  const bloqueado =
    activeOrg.status === "suspenso" ||
    activeOrg.status === "cancelado" ||
    trialVencido;

  if (!bloqueado) return <>{children}</>;

  // Owner/admin podem mexer em configurações pra atualizar dados/contato.
  const isOwnerOrAdmin = activeRole === "owner" || activeRole === "admin";
  const isConfigRoute = location.pathname.startsWith("/admin/configuracoes");
  if (isOwnerOrAdmin && isConfigRoute) return <>{children}</>;

  const motivo =
    activeOrg.status === "suspenso"
      ? "Acesso suspenso"
      : activeOrg.status === "cancelado"
      ? "Plano cancelado"
      : "Período de avaliação encerrado";

  const detalhe =
    activeOrg.status === "suspenso"
      ? "O acesso desta organização foi suspenso. Fale com nossa equipe para regularizar e liberar o acesso."
      : activeOrg.status === "cancelado"
      ? "O plano desta organização foi cancelado. Fale com nossa equipe para reativar."
      : `O período de avaliação terminou em ${activeOrg.trial_ate ? new Date(activeOrg.trial_ate).toLocaleDateString("pt-BR") : "—"}. Fale com nossa equipe para contratar um plano e continuar usando o Approva.`;

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <Card className="max-w-md w-full border-amber-300 dark:border-amber-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
            {activeOrg.status === "suspenso" ? (
              <Lock className="h-5 w-5" />
            ) : (
              <AlertTriangle className="h-5 w-5" />
            )}
            {motivo}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{detalhe}</p>
          <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1">
            <div>
              <span className="text-muted-foreground">Organização: </span>
              <span className="font-medium">{activeOrg.nome}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Plano: </span>
              <span className="font-medium">{activeOrg.plano}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Status: </span>
              <span className="font-medium">{activeOrg.status}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {isOwnerOrAdmin ? (
              <Button asChild>
                <Link to="/_authenticated/admin/configuracoes/organizacao">
                  Abrir Configurações da Organização
                </Link>
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                Avise o responsável (owner) da organização para regularizar o acesso.
              </p>
            )}
            <Button asChild variant="outline">
              <a href="mailto:contato@sistemaapprova.com?subject=Reativar%20acesso%20Approva">
                Falar com suporte
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
