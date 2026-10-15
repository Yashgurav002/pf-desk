import "./globals.css";
import type { Metadata, Viewport } from "next";
import Shell from "./shell";
import { LangProvider } from "@/lib/i18n";

export const metadata: Metadata = { title: "PF Desk", description: "Back office for PF consultants" };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LangProvider><Shell>{children}</Shell></LangProvider>
      </body>
    </html>
  );
}
