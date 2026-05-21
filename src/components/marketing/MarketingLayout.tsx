import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

export function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="marketing-theme min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
