import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  Building2,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-slate-800/50">
        <div className="flex items-center gap-2">
          <Building2 className="h-7 w-7 text-amber-500" />
          <span className="text-xl font-bold tracking-tight">Konstruq</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/sign-in">
            <Button variant="ghost" size="sm">
              Sign In
            </Button>
          </Link>
          <Link href="/sign-up">
            <Button
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold"
            >
              Get Started
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex flex-col items-center justify-center px-8 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-sm mb-8">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
          Construction Analytics Platform
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight max-w-4xl leading-tight">
          Your projects.
          <br />
          <span className="text-amber-500">One dashboard.</span>
        </h1>

        <p className="mt-6 text-lg md:text-xl text-slate-400 max-w-2xl">
          Unify Procore project data and Sage Intacct financials into a single,
          powerful analytics dashboard. No more PowerBI. No more spreadsheets.
        </p>

        <div className="flex gap-4 mt-10">
          <Link href="/sign-up">
            <Button
              size="lg"
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold h-12 px-8 text-base"
            >
              Start Free <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        {/* Feature cards */}
        <div className="grid md:grid-cols-3 gap-6 mt-24 max-w-5xl w-full">
          <FeatureCard
            icon={<Building2 className="h-6 w-6 text-amber-500" />}
            title="Procore Integration"
            description="Projects, budgets, RFIs, change orders, schedules — all synced in real time."
          />
          <FeatureCard
            icon={<TrendingUp className="h-6 w-6 text-emerald-500" />}
            title="Sage Intacct Integration"
            description="GL, AP/AR, cost types, project contracts — your complete financial picture."
          />
          <FeatureCard
            icon={<BarChart3 className="h-6 w-6 text-blue-500" />}
            title="Construction Analytics"
            description="EVM curves, cost breakdowns, cash flow forecasts — purpose-built for construction."
          />
        </div>
      </main>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-left hover:border-slate-700 transition-colors">
      <div className="mb-4">{icon}</div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
}
