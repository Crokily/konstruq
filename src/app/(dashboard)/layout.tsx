import type { Metadata } from "next";
import { ChatRuntimeProvider } from "@/components/chat/chat-runtime-provider";
import { ERPTopbar } from "@/components/layout/erp-topbar";
import { Sidebar } from "@/components/layout/sidebar";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 text-foreground">
      <Sidebar />
      <main className="lg:pl-72">
        <ERPTopbar />
        <div className="px-4 py-5 lg:px-8 lg:py-6">
          <ChatRuntimeProvider>{children}</ChatRuntimeProvider>
        </div>
      </main>
    </div>
  );
}
