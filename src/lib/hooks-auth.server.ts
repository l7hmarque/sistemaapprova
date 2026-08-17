/**
 * Autenticação dos endpoints públicos de automação (`/api/public/hooks/*`).
 *
 * Aceita, nesta ordem:
 *  1. `x-cron-secret` (ou `authorization: Bearer …`) igual ao CRON_SECRET — recomendado;
 *  2. `apikey` / `x-api-key` igual à chave publicável do backend — compatibilidade
 *     com os agendamentos já configurados.
 *
 * As variáveis são lidas DENTRO da função (nunca em escopo de módulo), porque
 * o runtime injeta o ambiente por requisição.
 */
export function hookAutorizado(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const header = request.headers.get("x-cron-secret");
    const bearer = request.headers.get("authorization");
    const token = header ?? (bearer?.startsWith("Bearer ") ? bearer.slice(7).trim() : null);
    if (token && token === cronSecret) return true;
  }

  const anon = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  const provided = request.headers.get("apikey") ?? request.headers.get("x-api-key");
  return Boolean(anon && provided && provided === anon);
}

export function respostaNaoAutorizado(): Response {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
