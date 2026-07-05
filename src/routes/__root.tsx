import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

import appCss from "../styles.css?url";


import { RouteError } from "@/components/route-boundaries/RouteError";
import { RouteNotFound } from "@/components/route-boundaries/RouteNotFound";


export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Approva — Gestão financeira e prestação de contas" },
      { name: "description", content: "Approva é a plataforma de gestão financeira e prestação de contas para OSCs e contadores do terceiro setor — captura, aprovação em duas mãos e exportação no padrão TCE-PR." },
      { name: "author", content: "3RD TECH" },
      { property: "og:title", content: "Approva — Contas em ordem" },
      { property: "og:description", content: "Capture, aprove e arquive prestações de contas em conformidade com o TCE-PR." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Approva" },
      { name: "twitter:description", content: "Gestão financeira e prestação de contas para o terceiro setor." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/133edae9-e8df-4b9c-a5c8-77aaa0b64f42/id-preview-51e062e7--84728f81-35b1-4f0a-b429-cfce22582220.lovable.app-1779137543256.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/133edae9-e8df-4b9c-a5c8-77aaa0b64f42/id-preview-51e062e7--84728f81-35b1-4f0a-b429-cfce22582220.lovable.app-1779137543256.png" },
      { name: "google-site-verification", content: "lrzVadvOEZaOHz7Y9hjvzAAwFIINZWEcIyNs5LfFLqo" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Approva",
          url: "https://sistemaapprova.lovable.app",
          logo: "https://sistemaapprova.lovable.app/favicon.ico",
          description:
            "Plataforma de gestão financeira e prestação de contas para OSCs e escritórios contábeis do terceiro setor. Convênios e termos de fomento com exportação para TCE-PR e prestações municipais.",
          areaServed: { "@type": "Country", name: "Brasil" },
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: RouteNotFound,
  errorComponent: RouteError,
});

function RootShell({ children }: { children: React.ReactNode }) {
  const GTM = import.meta.env.VITE_GTM_ID as string | undefined;
  const GA4 = import.meta.env.VITE_GA4_ID as string | undefined;
  const META_PIXEL = import.meta.env.VITE_META_PIXEL_ID as string | undefined;
  const LINKEDIN = import.meta.env.VITE_LINKEDIN_PARTNER_ID as string | undefined;

  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
        {GTM && (
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM}');`,
            }}
          />
        )}
        {GA4 && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA4}`} />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA4}',{anonymize_ip:true});`,
              }}
            />
          </>
        )}
        {META_PIXEL && (
          <script
            dangerouslySetInnerHTML={{
              __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META_PIXEL}');fbq('track','PageView');`,
            }}
          />
        )}
        {LINKEDIN && (
          <script
            dangerouslySetInnerHTML={{
              __html: `_linkedin_partner_id="${LINKEDIN}";window._linkedin_data_partner_ids=window._linkedin_data_partner_ids||[];window._linkedin_data_partner_ids.push(_linkedin_partner_id);(function(l){if(!l){window.lintrk=function(a,b){window.lintrk.q.push([a,b])};window.lintrk.q=[]}var s=document.getElementsByTagName("script")[0];var b=document.createElement("script");b.type="text/javascript";b.async=true;b.src="https://snap.licdn.com/li.lms-analytics/insight.min.js";s.parentNode.insertBefore(b,s);})(window.lintrk);`,
            }}
          />
        )}
      </head>
      <body>
        {GTM && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        )}
        {children}
        <Scripts />
      </body>
    </html>
  );
}
function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      router.invalidate();
      queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
