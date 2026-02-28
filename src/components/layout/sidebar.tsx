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
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-slate-800 bg-slate-950">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-6 py-5 border-b border-slate-800">
        <Building2 className="h-7 w-7 text-amber-500" />
        <span className="text-lg font-bold tracking-tight">Konstruq</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-amber-500/10 text-amber-500"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              )}
            >
              <item.icon className="h-4.5 w-4.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Data sources status */}
      <div className="px-4 py-3 border-t border-slate-800">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
          Data Sources
        </p>
        <div className="space-y-1.5">
          {dataSources.map((dataSource) => (
            <DataSourceBadge
              key={dataSource.name}
              name={dataSource.name}
              connected={dataSource.connected}
            />
          ))}
        </div>
      </div>

      {/* User */}
      <div className="flex items-center gap-3 px-4 py-4 border-t border-slate-800">
        <UserButton
          appearance={{
            elements: {
              avatarBox: "h-8 w-8",
            },
          }}
        />
        <span className="text-sm text-slate-400">Account</span>
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
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-400">{name}</span>
      <span
        className={cn(
          "flex items-center gap-1",
          connected ? "text-emerald-400" : "text-slate-600"
        )}
      >
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            connected ? "bg-emerald-400" : "bg-slate-600"
          )}
        />
        {connected ? "Connected" : "Not connected"}
      </span>
    </div>
  );
}
