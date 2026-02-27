import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">Settings</h1>
      </div>

      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-slate-100">Settings coming soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400">
            Configuration options for your workspace will be available soon.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
