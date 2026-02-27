import Link from "next/link"
import {
  Building2,
  CheckCircle,
  Clock,
  DollarSign,
  ExternalLink,
  Plug,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const procoreIntegration = {
  connected: false,
  lastSync: "2 hours ago",
  features: ["Projects", "Budgets", "RFIs", "Change Orders", "Schedules"],
}

const sageIntacctIntegration = {
  features: [
    "General Ledger",
    "Accounts Payable",
    "Accounts Receivable",
    "Cost Types",
    "Project Contracts",
  ],
}

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <Plug className="h-5 w-5 text-amber-500" />
          <h1 className="text-2xl font-bold text-slate-100">Integrations</h1>
        </div>
        <p className="mt-1 text-slate-400">Connect your construction data sources</p>
      </div>

      <div className="grid grid-cols-2 gap-4 max-xl:grid-cols-1">
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader className="space-y-4 pb-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg border border-slate-700/80 bg-slate-900 p-2">
                  <Building2 className="h-5 w-5 text-amber-500" />
                </div>
                <CardTitle className="text-slate-100">Procore</CardTitle>
              </div>
              {procoreIntegration.connected ? (
                <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Connected
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-slate-700 bg-slate-900 text-slate-400"
                >
                  Not Connected
                </Badge>
              )}
            </div>
            <CardDescription className="text-slate-400">
              Sync projects, budgets, RFIs, change orders, and schedules
            </CardDescription>
            {procoreIntegration.connected ? (
              <div className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                <Clock className="h-3.5 w-3.5" />
                Last sync {procoreIntegration.lastSync}
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-5">
            <ul className="space-y-2">
              {procoreIntegration.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm text-slate-300">
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                  {feature}
                </li>
              ))}
            </ul>
            {procoreIntegration.connected ? (
              <Button className="w-full bg-emerald-600 text-white hover:bg-emerald-500">
                <Clock className="h-4 w-4" />
                Sync Now
              </Button>
            ) : (
              <Button asChild className="w-full bg-amber-500 text-slate-950 hover:bg-amber-400">
                <Link href="/api/procore/auth">
                  Connect Procore
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader className="space-y-4 pb-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg border border-slate-700/80 bg-slate-900 p-2">
                  <DollarSign className="h-5 w-5 text-cyan-400" />
                </div>
                <CardTitle className="text-slate-100">Sage Intacct</CardTitle>
              </div>
              <Badge className="border-sky-500/20 bg-sky-500/10 text-sky-200">
                Coming Soon
              </Badge>
            </div>
            <CardDescription className="text-slate-400">
              Access GL, AP/AR, cost types, and project financials
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <ul className="space-y-2">
              {sageIntacctIntegration.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm text-slate-300">
                  <CheckCircle className="h-4 w-4 text-cyan-400" />
                  {feature}
                </li>
              ))}
            </ul>
            <Button disabled className="w-full bg-slate-800 text-slate-400 hover:bg-slate-800">
              Coming Soon
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
