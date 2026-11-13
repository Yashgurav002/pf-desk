"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  BookOpenText, Building2, CalendarClock, CircleHelp, FileSearch, Inbox, ListChecks, LogOut, Menu, Plus, Search, Settings, Upload, X,
} from "lucide-react";
import { api } from "@/lib/api";
import { LangToggle, useT, type Key } from "@/lib/i18n";
import { Button, LinkButton, cx } from "@/lib/ui";
import { Tour } from "@/lib/tour";

type NavItem = { href: string; label: Key; icon: ReactNode };
const NAV: { group: Key; items: NavItem[] }[] = [
  { group: "navWork", items: [
    { href: "/today", label: "today", icon: <Inbox className="size-[18px]" /> },
    { href: "/claims", label: "claims", icon: <ListChecks className="size-[18px]" /> },
  ] },
  { group: "navClients", items: [
    { href: "/employees", label: "companies", icon: <Building2 className="size-[18px]" /> },
    { href: "/cycle", label: "cycle", icon: <CalendarClock className="size-[18px]" /> },
  ] },
  { group: "navTools", items: [
    { href: "/decode", label: "decodeRemark", icon: <FileSearch className="size-[18px]" /> },
    { href: "/rules", label: "rules", icon: <BookOpenText className="size-[18px]" /> },
    { href: "/import", label: "import", icon: <Upload className="size-[18px]" /> },
  ] },
];
const MOBILE_TABS: NavItem[] = [
  { href: "/today", label: "today", icon: <Inbox className="size-5" /> },
  { href: "/claims", label: "claims", icon: <ListChecks className="size-5" /> },
  { href: "/decode", label: "decodeShort", icon: <FileSearch className="size-5" /> },
  { href: "/cycle", label: "cycleShort", icon: <CalendarClock className="size-5" /> },
];

// pages that draw their own chrome
const isBare = (p: string) => p === "/" || p === "/login" || p.startsWith("/help/");
const isActive = (path: string, href: string) => path === href || path.startsWith(href + "/");

function Brand({ className }: { className?: string }) {
  return (
    <Link href="/today" className={cx("flex items-center gap-2.5", className)}>
      {/* monogram: a ledger page with a tick — drawn, not an emoji */}
      <svg viewBox="0 0 28 28" className="size-7" aria-hidden>
        <rect x="3" y="2" width="20" height="24" rx="2.5" fill="#23408e" />
        <path d="M7 8h12M7 12h12M7 16h6" stroke="#fff" strokeOpacity=".55" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="21" cy="20" r="5.5" fill="#f5f3ec" stroke="#1d6b40" strokeWidth="1.6" />
        <path d="m18.6 20 1.7 1.7 3-3.2" fill="none" stroke="#1d6b40" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="whitespace-nowrap text-[1.08rem] font-semibold tracking-tight text-ink">PF Desk</span>
    </Link>
  );
}

function Sidebar({ path, onNavigate }: { path: string; onNavigate?: () => void }) {
  const { t } = useT();
  return (
    <nav className="flex h-full flex-col gap-6 px-3 py-4" aria-label="Main">
      {NAV.map(({ group, items }) => (
        <div key={group}>
          <p className="mb-1.5 px-2 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">{t(group)}</p>
          <ul className="space-y-0.5">
            {items.map((it) => {
              const on = isActive(path, it.href);
              return (
                <li key={it.href}>
                  <Link href={it.href} onClick={onNavigate} aria-current={on ? "page" : undefined} data-tour={`nav-${it.href.slice(1)}`}
                    className={cx("relative flex h-9 items-center gap-2.5 rounded-md px-2 text-[0.95rem] transition-colors",
                      on ? "bg-sheet font-semibold text-ink shadow-[var(--shadow-card)]" : "text-ink-2 hover:bg-sunk hover:text-ink")}>
                    {on && <span className="absolute inset-y-2 -left-3 w-[3px] rounded-r bg-brand" aria-hidden />}
                    <span className={on ? "text-brand" : "text-ink-3"}>{it.icon}</span>{t(it.label)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <div className="mt-auto space-y-0.5 border-t border-line pt-3">
        <Link href="/settings" onClick={onNavigate} className={cx("flex h-9 items-center gap-2.5 rounded-md px-2 text-[0.95rem]",
          isActive(path, "/settings") || isActive(path, "/label") ? "bg-sheet font-semibold text-ink" : "text-ink-2 hover:bg-sunk")}>
          <Settings className="size-[18px] text-ink-3" />{t("settings")}
        </Link>
        <button className="flex h-9 w-full items-center gap-2.5 rounded-md px-2 text-[0.95rem] text-ink-2 hover:bg-sunk"
          onClick={async () => { await api("/auth/logout", { method: "POST", noRedirect: true }).catch(() => {}); location.href = "/"; }}>
          <LogOut className="size-[18px] text-ink-3" />{t("logout")}
        </button>
      </div>
    </nav>
  );
}

function SearchBox() {
  const { t } = useT();
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form role="search" data-tour="search" className="relative w-full max-w-md" onSubmit={(e) => { e.preventDefault(); if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`); }}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPlaceholder")} aria-label={t("searchPlaceholder")}
        className="h-9 w-full rounded-md border border-line bg-sheet pl-9 pr-3 text-[0.95rem] placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15" />
    </form>
  );
}

/** Free hosting sleeps; the API answers /health with {starting:true} until data is loaded. Hold the UI until then. */
function useBoot(enabled: boolean) {
  const [state, setState] = useState<{ demo: boolean; status: "ok" | "starting" | "failed"; error?: string }>({ demo: false, status: "ok" });
  useEffect(() => {
    if (!enabled) return;
    let stop = false, timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      try {
        const h = await api<{ demo?: boolean; starting?: boolean; error?: string | null }>("/health", { noRedirect: true });
        if (stop) return;
        if (h.starting && h.error) { setState({ demo: !!h.demo, status: "failed", error: h.error }); timer = setTimeout(check, 8000); } // API keeps retrying; recover by itself
        else if (h.starting) { setState((s) => ({ ...s, status: "starting" })); timer = setTimeout(check, 4000); }
        else setState({ demo: !!h.demo, status: "ok" });
      } catch { if (!stop) { setState((s) => ({ ...s, status: "starting" })); timer = setTimeout(check, 4000); } }
    };
    check();
    return () => { stop = true; clearTimeout(timer); };
  }, [enabled]);
  return state;
}

export function WakeScreen({ failed, error }: { failed?: boolean; error?: string }) {
  const { t } = useT();
  return (
    <div className="mx-auto mt-[12vh] max-w-md px-6 text-center" role="status" aria-live="polite">
      <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-full border border-line bg-sheet">
        {failed ? <X className="size-5 text-danger" /> : <span className="size-2.5 animate-ping rounded-full bg-brand" />}
      </div>
      <h1 className="text-xl font-semibold">{failed ? t("bootFailed") : t("wakingTitle")}</h1>
      <p className="mt-2 text-ink-2">{failed ? error : t("wakingBody")}</p>
      {failed && <Button className="mt-5" variant="secondary" onClick={() => location.reload()}>{t("retry")}</Button>}
    </div>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { t } = useT();
  const bare = isBare(path);
  const boot = useBoot(!path.startsWith("/help/") && path !== "/");
  const [drawer, setDrawer] = useState(false);
  useEffect(() => setDrawer(false), [path]);

  const gate = boot.status !== "ok" && path !== "/" ? <WakeScreen failed={boot.status === "failed"} error={boot.error} /> : null;

  if (bare) return <>{gate ?? children}</>;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[232px_1fr]">
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-paper lg:flex">
        <div className="flex h-14 items-center border-b border-line px-5"><Brand /></div>
        <Sidebar path={path} />
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col">
        {boot.demo && (
          <div className="border-b border-warn/25 bg-warn-tint px-4 py-1 text-center font-mono text-xs tracking-wide text-warn">{t("demoStrip")}</div>
        )}
        {/* top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-paper/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-paper/85 lg:px-6">
          <button className="-ml-1 flex size-9 items-center justify-center rounded-md text-ink-2 hover:bg-sunk lg:hidden" onClick={() => setDrawer(true)} aria-label={t("menu")}>
            <Menu className="size-5" />
          </button>
          <Brand className="lg:hidden" />
          <div className="hidden flex-1 md:block"><SearchBox /></div>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <span className="hidden sm:inline-flex" data-tour="new-claim"><LinkButton href="/claims/new" size="sm" icon={<Plus className="size-4" />}>{t("newClaim")}</LinkButton></span>
            <LangToggle />
            <button data-tour="help" className="flex size-9 items-center justify-center rounded-md text-ink-2 hover:bg-sunk" aria-label={t("help")} title={t("startTour")}
              onClick={() => window.dispatchEvent(new Event("pfd:tour"))}>
              <CircleHelp className="size-5" />
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 lg:px-8 lg:pb-10">
          <div className="mb-4 md:hidden"><SearchBox /></div>
          {gate ?? children}
        </main>
        <footer className="mx-auto hidden w-full max-w-6xl px-8 pb-6 text-xs leading-relaxed text-ink-3 lg:block">{t("footer")}</footer>
      </div>

      {/* mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button className="absolute inset-0 bg-ink/30" aria-label={t("close")} onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-paper shadow-[var(--shadow-pop)]">
            <div className="flex h-14 items-center justify-between border-b border-line px-4">
              <Brand /><button className="flex size-9 items-center justify-center rounded-md hover:bg-sunk" onClick={() => setDrawer(false)} aria-label={t("close")}><X className="size-5" /></button>
            </div>
            <Sidebar path={path} onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      )}

      {/* mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-sheet pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Quick">
        {MOBILE_TABS.slice(0, 2).map((it) => <Tab key={it.href} it={it} on={isActive(path, it.href)} />)}
        <Link href="/claims/new" className="flex flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-semibold text-brand" aria-label={t("newClaim")}>
          <span className="flex size-9 items-center justify-center rounded-full bg-brand text-white shadow-[var(--shadow-card)]"><Plus className="size-5" /></span>
        </Link>
        {MOBILE_TABS.slice(2).map((it) => <Tab key={it.href} it={it} on={isActive(path, it.href)} />)}
      </nav>
      <Tour />
    </div>
  );
}

function Tab({ it, on }: { it: NavItem; on: boolean }) {
  const { t } = useT();
  return (
    <Link href={it.href} aria-current={on ? "page" : undefined}
      className={cx("flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium", on ? "text-brand" : "text-ink-3")}>
      {it.icon}<span className="max-w-full truncate px-1">{t(it.label)}</span>
    </Link>
  );
}
