import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://konstruq.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Konstruq — Construction Analytics Dashboard",
    template: "%s | Konstruq",
  },
  description:
    "AI-powered data analytics for the construction industry. Integrates Procore and Sage Intacct.",
  applicationName: "Konstruq",
  keywords: [
    "construction analytics",
    "EVM dashboard",
    "project controls",
    "Procore analytics",
    "Sage Intacct analytics",
    "cost performance index",
    "schedule performance index",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Konstruq",
    title: "Konstruq — Construction Analytics Dashboard",
    description:
      "AI-powered construction analytics for schedule, cost, and portfolio performance.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Konstruq — Construction Analytics Dashboard",
    description:
      "AI-powered construction analytics for schedule, cost, and portfolio performance.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
        >
          <ThemeProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
