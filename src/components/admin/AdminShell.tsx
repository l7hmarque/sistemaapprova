import React from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

export type AdminModule =
  | "dashboard"
  | "orcamentos"
  | "cotacoes"
  | "fornecedores"
  | "objetos"
  | "modelos"
  | "prestacao"
  | "aprovacoes"
  | "agenda"
  | "captura"
  | "painel"
  | "analytics"
  | "configuracoes";

interface AdminShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  backTo?: string;
  module?: AdminModule;
  actions?: React.ReactNode;
}

export function AdminShell({ title, subtitle, children, backTo, module = "dashboard", actions }: AdminShellProps) {
  return (
    <div data-module={module} className="p-6 md:p-8 space-y-6 md:space-y-8">
      <header
        className="space-y-1 border-l-4 pl-4"
        style={{ borderColor: "var(--module-accent, var(--primary))" }}
      >
        {backTo && (
          <Link
            to={backTo}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Voltar
          </Link>
        )}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-display uppercase tracking-tight text-foreground">
              {title}
            </h1>
            {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </header>
      {children}
    </div>
  );
}
