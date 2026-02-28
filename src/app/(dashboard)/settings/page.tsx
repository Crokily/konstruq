import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle>Settings coming soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Configuration options for your workspace will be available soon.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
