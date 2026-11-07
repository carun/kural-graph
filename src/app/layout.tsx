import type { Metadata, Viewport } from "next";
import { Inter, Noto_Serif_Tamil, Source_Serif_4 } from "next/font/google";
import "./globals.css";

// Variable faces (full axes). Pinning discrete weights narrows the axis, which makes Google intermittently serve
// `/l/font?kit=…&skey=…` instance URLs that Turbopack 15.5 can't resolve. All three cover the full IAST range.
const inter = Inter({ subsets: ["latin", "latin-ext"], axes: ["opsz"], variable: "--font-inter", display: "swap" });
const sourceSerif = Source_Serif_4({ subsets: ["latin", "latin-ext"], style: ["normal", "italic"], axes: ["opsz"], variable: "--font-source-serif", display: "swap" });
const tiro = Noto_Serif_Tamil({ subsets: ["tamil", "latin"], variable: "--font-tiro", display: "swap" });

// A static export bakes this into every page, and link previews need the picture's full address.
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://kural-graph.carun.workers.dev";

export const metadata: Metadata = {
  ...(SITE ? { metadataBase: new URL(SITE) } : {}),
  title: "Kural Graph · The Tirukkural as a knowledge graph",
  description:
    "Explore all 1,330 couplets of the Tirukkural as an interactive knowledge graph: read the Tamil with a plain reading and Parimelazhagar’s commentary, trace how ideas connect, ask questions grounded in the text, and map your own reflections privately.",
  applicationName: "Kural Graph",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    type: "website",
    siteName: "Kural Graph",
    title: "Kural Graph · The Tirukkural as a knowledge graph",
    description: "Read all 1,330 couplets, see how the Kural’s ideas connect, and bring your own questions to it.",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "The words Kural Graph beside a line of palmyra palms against a dusk sky." }],
  },
  twitter: { card: "summary_large_image", images: ["/og.jpg"] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0d0c0b" },
    { media: "(prefers-color-scheme: light)", color: "#f5f4f1" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${inter.variable} ${sourceSerif.variable} ${tiro.variable}`}>
      <head>
        {/* Before first paint, so they can't be async. Files, because public/_headers blocks inline scripts. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/theme.js" />
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/entry.js" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
