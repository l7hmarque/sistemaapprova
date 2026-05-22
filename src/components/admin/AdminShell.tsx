import React from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

interface AdminShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  backTo?: string;
}

export function AdminShell({ title, subtitle, children, backTo }: AdminShellProps) {
  return (
    <div className="p-8 space-y-8">
      <header className="space-y-1">
        {backTo && (
          <Link
            to={backTo}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Voltar
          </Link>
        )}
        <h1 className="text-3xl font-display uppercase tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </header>
      {children}
    </div>
  );
}
