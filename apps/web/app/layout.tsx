import "./globals.css";
import type { Metadata, Viewport } from "next";
import Shell from "./shell";

export const metadata: Metadata = { title: "PF Desk", description: "Back office for PF consultants" };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
