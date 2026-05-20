import "./globals.css";
import { Inter, JetBrains_Mono } from "next/font/google";
import type { Metadata } from "next";
import { RootProvider } from "fumadocs-ui/provider";
import Script from "next/script";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://playbook.agentskit.io";
const TITLE = "Agents Playbook";
const DESCRIPTION =
  "The gold-standard playbook for shipping production software with AI coding agents — pillars, patterns, prompts, and gates earned from real production.";

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: TITLE,
  url: SITE_URL,
  description: DESCRIPTION,
  inLanguage: "en",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s · Agents Playbook",
  },
  description: DESCRIPTION,
  applicationName: TITLE,
  authors: [{ name: "Agents Playbook contributors" }],
  keywords: [
    "AI coding agents",
    "Claude Code",
    "playbook",
    "guardrails",
    "ADR",
    "RFC",
    "agentic development",
    "production SDLC",
  ],
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: TITLE,
    description: DESCRIPTION,
    siteName: TITLE,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  alternates: {
    canonical: SITE_URL,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body className={`${inter.variable} ${mono.variable} font-sans`}>
        <Script
          id="jsonld-website"
          type="application/ld+json"
          strategy="beforeInteractive"
        >
          {JSON.stringify(JSON_LD)}
        </Script>
        <RootProvider
          theme={{ defaultTheme: "dark", forcedTheme: "dark" }}
          
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
