import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { fetchDriveFileMedia, fileBelongsToOrg } from "@/lib/drive-org.server";

export const Route = createFileRoute("/api/files/$id/preview")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const auth = request.headers.get("authorization") || "";
        let token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : null;
        // fallback: token via query (?t=...) para uso em <iframe>
        if (!token) {
          const url = new URL(request.url);
          token = url.searchParams.get("t");
        }
        if (!token) return new Response("Unauthorized", { status: 401 });

        const supa = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false },
          },
        );
        const { data: userRes } = await supa.auth.getUser(token);
        if (!userRes?.user) return new Response("Unauthorized", { status: 401 });

        const { data: orgIdData } = await supa.rpc("current_user_org");
        if (!orgIdData) return new Response("Sem organização", { status: 403 });

        const fileId = (params as { id: string }).id;
        const ok = await fileBelongsToOrg(orgIdData as string, fileId);
        if (!ok) return new Response("Forbidden", { status: 403 });

        const upstream = await fetchDriveFileMedia(fileId);
        const headers = new Headers();
        const ct = upstream.headers.get("content-type");
        if (ct) headers.set("content-type", ct);
        headers.set("cache-control", "private, max-age=60");
        return new Response(upstream.body, { status: upstream.status, headers });
      },
    },
  },
});
