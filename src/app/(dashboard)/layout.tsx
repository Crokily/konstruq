import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="pl-64">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
