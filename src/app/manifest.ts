import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://konstruq.com";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Konstruq - Construction analytic (ERP & PMS)",
    short_name: "Konstruq",
    description:
      "AI-powered construction analytics and project controls platform for ERP and PMS teams.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#f59e0b",
    lang: "en",
    icons: [
      {
        src: `${siteUrl}/favicon.ico`,
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
