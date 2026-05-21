import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { useAnalytics } from "@/hooks/use-analytics";

export function MarketingLayout({ children }: { children: React.ReactNode }) {
  useAnalytics();
  return (
    <div className="marketing-theme min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
