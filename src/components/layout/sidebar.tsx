"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  Building2,
  Database,
  LayoutDashboard,
  FolderKanban,
  DollarSign,
  Settings,
  Plug,
  MessageSquare,
  CircleDot,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Projects",
    href: "/projects",
    icon: FolderKanban,
  },
  {
    label: "Financials",
    href: "/financials",
    icon: DollarSign,
  },
  {
    label: "AI Chat",
    href: "/chat",
    icon: MessageSquare,
  },
  {
    label: "Data Sources",
    href: "/data-sources",
    icon: Database,
  },
  {
    label: "Integrations",
    href: "/integrations",
    icon: Plug,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

const dataSources = [
  { name: "Procore", connected: false },
  { name: "Sage Intacct", connected: false },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-72 flex-col border-r border-border/70 bg-card lg:flex">
      <div className="border-b border-border/70 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500 ring-1 ring-amber-500/30">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight">Konstruq</p>
            <p className="text-xs text-muted-foreground">Construction ERP Suite</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 py-4">
        <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Navigation
        </p>
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative mb-1.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-amber-500/12 text-amber-600 shadow-sm ring-1 ring-amber-500/20 dark:text-amber-400"
                  : "text-muted-foreground hover:bg-accent/70 hover:text-accent-foreground"
              )}
            >
              {isActive ? (
                <span className="absolute -left-1 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-amber-500" />
              ) : null}
              <item.icon className="h-4.5 w-4.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border/70 px-5 py-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Connected Systems
        </p>
        <div className="space-y-2">
          {dataSources.map((dataSource) => (
            <DataSourceBadge
              key={dataSource.name}
              name={dataSource.name}
              connected={dataSource.connected}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-border/70 px-5 py-4">
        <UserButton
          appearance={{
            elements: {
              avatarBox: "h-9 w-9 ring-1 ring-border",
            },
          }}
        />
        <div>
          <p className="text-sm font-medium text-foreground">Workspace</p>
          <p className="text-xs text-muted-foreground">Account settings</p>
        </div>
      </div>
    </aside>
  );
}

function DataSourceBadge({
  name,
  connected,
}: {
  name: string;
  connected: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border/70 bg-background px-2 py-1.5 text-xs">
      <span className="text-muted-foreground">{name}</span>
      <span
        className={cn(
          "flex items-center gap-1 text-[11px]",
          connected ? "text-emerald-500" : "text-muted-foreground"
        )}
      >
        <CircleDot className="h-3 w-3" />
        {connected ? "Connected" : "Not connected"}
      </span>
    </div>
  );
}
