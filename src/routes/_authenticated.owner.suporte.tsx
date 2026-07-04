import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/owner/suporte")({ component: SuportePage });

function SuportePage() {
  const qc = useQueryClient();
  const [respostas, setRespostas] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["owner-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("id, organization_id, assunto, mensagem, status, resposta, criado_em, respondido_em")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const responder = async (id: string) => {
    const r = respostas[id]?.trim();
    if (!r) return;
    const { error } = await supabase
      .from("support_tickets")
      .update({ resposta: r, status: "respondido", respondido_em: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Resposta enviada");
    qc.invalidateQueries({ queryKey: ["owner-tickets"] });
  };

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <header>
        <h1 className="font-display text-3xl uppercase">Suporte</h1>
        <p className="text-sm text-muted-foreground mt-1">Tickets de todas as organizações.</p>
      </header>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : !data?.length ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhum ticket aberto.</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {data.map((t) => (
            <Card key={t.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-sm">{t.assunto}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Org {t.organization_id.slice(0, 8)}… · {new Date(t.criado_em).toLocaleString("pt-BR")}
                  </p>
                </div>
                <Badge variant={t.status === "aberto" ? "default" : "secondary"} className="uppercase text-[10px]">
                  {t.status}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm whitespace-pre-wrap">{t.mensagem}</p>
                {t.resposta ? (
                  <div className="rounded-md bg-muted p-3 text-sm">
                    <div className="text-xs uppercase text-muted-foreground mb-1">Sua resposta</div>
                    {t.resposta}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Responder ao cliente…"
                      rows={3}
                      value={respostas[t.id] ?? ""}
                      onChange={(e) => setRespostas({ ...respostas, [t.id]: e.target.value })}
                    />
                    <div className="flex justify-end">
                      <Button size="sm" onClick={() => responder(t.id)}>Enviar resposta</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
