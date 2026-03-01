"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const sections: Array<{ prefix: string; label: string; href: string }> = [
  { prefix: "/dashboard", label: "Dashboard", href: "/dashboard" },
  { prefix: "/projects", label: "Project", href: "/projects" },
  { prefix: "/financials", label: "Financial", href: "/financials" },
  { prefix: "/chat", label: "AI Chat", href: "/chat" },
  { prefix: "/dashboards", label: "My Dashboard", href: "/dashboards" },
  { prefix: "/data-sources", label: "Data Source", href: "/data-sources" },
  { prefix: "/integrations", label: "Integrations", href: "/integrations" },
  { prefix: "/settings", label: "Settings", href: "/settings" },
];

function currentSection(pathname: string) {
  return sections.find((item) => pathname === item.href || pathname.startsWith(`${item.prefix}/`));
}

export function ERPTopbar() {
  const pathname = usePathname();
  const section = useMemo(() => currentSection(pathname), [pathname]);

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-16 items-center justify-between gap-4 px-4 lg:px-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link href="/dashboard" className="transition-colors hover:text-foreground">
              Konstruq ERP
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="truncate text-foreground">{section?.label ?? "Workspace"}</span>
          </div>
          <p className="truncate text-sm text-muted-foreground">
            Enterprise construction intelligence and controls
          </p>
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
