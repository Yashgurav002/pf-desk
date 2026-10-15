"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { LangToggle, useT, type Key } from "@/lib/i18n";

const NAV = [
  ["/", "today"], ["/claims", "claims"], ["/employees", "employees"], ["/import", "import"], ["/rules", "rules"], ["/label", "label"], ["/cycle", "cycle"],
] as const; // labels are i18n keys (lib/i18n.tsx)

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { t } = useT();
  const [demo, setDemo] = useState(false);
  useEffect(() => { api<{ demo: boolean }>("/health", { noRedirect: true }).then((h) => setDemo(!!h.demo)).catch(() => {}); }, []);
  const bare = path.startsWith("/help/") || path === "/login";

  return (
    <div className="flex min-h-screen flex-col">
      {demo && <div className="bg-yellow-300 px-4 py-2 text-center font-bold text-black">{t("demo")}</div>}
      {!bare && (
        <nav className="flex flex-wrap items-center gap-1 border-b-2 border-gray-300 bg-gray-50 px-4 py-2">
          <span className="mr-4 text-xl font-extrabold text-blue-800">PF Desk</span>
          {NAV.map(([href, label]) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link key={href} href={href} className={`rounded-lg px-3 py-2 font-semibold ${active ? "bg-blue-700 text-white" : "text-gray-900 hover:bg-gray-200"}`}>
                {t(label as Key)}
              </Link>
            );
          })}
          <div className="ml-auto"><LangToggle /></div>
          <button className="min-h-11 px-3 py-2 text-gray-700 underline" onClick={async () => { await api("/auth/logout", { method: "POST", noRedirect: true }).catch(() => {}); location.href = "/login"; }}>
            {t("logout")}
          </button>
        </nav>
      )}
      {bare && <div className="flex justify-end px-4 pt-3"><LangToggle /></div>}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
      <footer className="border-t-2 border-gray-300 px-4 py-4 text-center text-sm text-gray-700">
        {t("footer")}
      </footer>
    </div>
  );
}
