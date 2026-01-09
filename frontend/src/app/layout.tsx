import type { Metadata } from "next";
import "@/styles/globals.css";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { AppProviders } from "@/components/AppProviders";
import { ThemeInit } from "@/components/ThemeInit";
import { Analytics } from "@/components/Analytics";

export const metadata: Metadata = {
  metadataBase: new URL("https://cooked-ai.local"),
  title: "Cooked-AI – Tu plan diario nutricional optimizado por IA",
  description:
    "Genera en segundos la nutrición completa de tu día según entreno, objetivo y preferencias. IA para atletas reales.",
  openGraph: {
    title: "Cooked-AI",
    description:
      "Tu plan diario nutricional optimizado por IA. Recupera mejor y rinde más.",
    url: "https://cooked-ai.local",
    siteName: "Cooked-AI",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Cooked-AI App Preview"
      }
    ],
    locale: "es_ES",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Cooked-AI",
    description:
      "Genera tu plan diario personalizado en segundos.",
    images: ["/og-image.png"]
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png"
  },
  manifest: "/manifest.json"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="bg-[var(--bg)]">
        <body className="text-[var(--text-primary)] bg-[var(--bg)] antialiased">
          <AppProviders>
            <ThemeInit />
            <Analytics />
            <PublicHeader />
            <main className="px-4 py-12">
              <div className="mx-auto max-w-content">{children}</div>
            </main>
          </AppProviders>
        </body>
    </html>
  );
}
