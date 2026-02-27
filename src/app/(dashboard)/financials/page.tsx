import { Card } from "@/components/ui/card";
import { DollarSign } from "lucide-react";

export default function FinancialsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Financials</h1>
        <p className="text-slate-400 mt-1">
          Financial overview from Sage Intacct.
        </p>
      </div>

      <Card className="border-dashed border-slate-700 bg-slate-900/30 p-12 text-center">
        <DollarSign className="h-12 w-12 text-slate-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">No financial data yet</h2>
        <p className="text-slate-400">
          Connect Sage Intacct to see GL, AP/AR, and project financials.
        </p>
      </Card>
    </div>
  );
}
