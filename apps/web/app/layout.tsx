import "./globals.css";
import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Devanagari, IBM_Plex_Mono } from "next/font/google";
import Shell from "./shell";
import { LangProvider } from "@/lib/i18n";

const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-plex", display: "swap" });
const plexDeva = IBM_Plex_Sans_Devanagari({ subsets: ["devanagari"], weight: ["400", "500", "600", "700"], variable: "--font-plex-deva", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "PF Desk — back office for PF consultants", template: "%s · PF Desk" },
  description: "Catch PF claim mistakes before EPFO does, decode rejection remarks, and answer workers in Hindi, Marathi and English. Open models, private by design.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f5f3ec" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plex.variable} ${plexDeva.variable} ${plexMono.variable}`}>
      <body>
        <LangProvider><Shell>{children}</Shell></LangProvider>
      </body>
    </html>
  );
}
