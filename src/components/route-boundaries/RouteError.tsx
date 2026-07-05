import { useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

type Props = { error: Error; reset: () => void };

export function RouteError({ error, reset }: Props) {
  if (typeof console !== "undefined") console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Não conseguimos carregar esta página
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo falhou por aqui. Você pode tentar novamente ou voltar para o início.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Tentar novamente
          </Button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ir para o início
          </a>
        </div>
      </div>
    </div>
  );
}
