"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { api } from "@/lib/api";
import { Button, ErrorBox, Field, Input, Notice } from "@/lib/ui";
import { LangToggle, useT } from "@/lib/i18n";
import { Mark } from "@/components/landing/mark";

const CAN = ["lgW1", "lgW2", "lgW3", "lgW4", "lgW5"] as const;

export default function Login() {
  const { t } = useT();
  const [passcode, setPasscode] = useState("");
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api<{ demo: boolean }>("/health", { noRedirect: true }).then((h) => setDemo(!!h.demo)).catch(() => {}); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api("/auth/login", { method: "POST", body: JSON.stringify({ passcode }), noRedirect: true });
      let seen = false;
      try { seen = !!localStorage.getItem("pfd.tour.done"); } catch {}
      location.href = seen ? "/today" : "/today?tour=1";
    } catch {
      setError(t("wrongPasscode"));
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:px-6">
          <Mark />
          <div className="ml-auto flex items-center gap-2">
            <Link href="/" className="hidden h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-semibold text-ink-2 hover:bg-sunk hover:text-ink sm:inline-flex">
              <ArrowLeft className="size-4" aria-hidden />{t("lgBack")}
            </Link>
            <LangToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-5xl flex-1 gap-10 px-4 py-10 sm:px-6 md:grid-cols-[minmax(0,24rem)_1fr] md:gap-16 md:py-20">
        <form onSubmit={submit} className="space-y-5">
          <div>
            <h1 className="text-[1.65rem] font-semibold leading-tight">{t("lgTitle")}</h1>
            <p className="mt-1 text-ink-2">{t("lgSub")}</p>
          </div>
          <Field label={t("passcode")}>
            <Input type="password" value={passcode} onChange={(e) => setPasscode(e.target.value)} autoFocus autoComplete="current-password" />
          </Field>
          {demo && (
            <Notice>
              <p className="text-sm">{t("lgDemoNote")}</p>
              <button type="button" className="mt-1 text-sm font-semibold text-brand hover:underline" onClick={() => setPasscode("demo")}>
                {t("lgUseDemo")} <span className="font-mono font-medium">(demo)</span>
              </button>
            </Notice>
          )}
          <ErrorBox error={error} />
          <Button type="submit" size="lg" busy={busy} disabled={!passcode}>{busy ? t("checking") : t("login")}</Button>
        </form>

        <aside className="hidden border-l border-line pl-10 md:block">
          <h2 className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-ink-3">{t("lgWhatTitle")}</h2>
          <ol className="mt-4 border-t border-line">
            {CAN.map((k, i) => (
              <li key={k} className="flex gap-4 border-b border-line py-3 text-ink-2">
                <span className="num w-5 shrink-0 font-mono text-sm text-ink-3">{i + 1}</span>{t(k)}
              </li>
            ))}
          </ol>
          <p className="mt-6 flex items-start gap-2 text-sm text-ink-3"><Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />{t("lpPriv1")}</p>
        </aside>
      </main>
      <footer className="mx-auto w-full max-w-5xl px-4 pb-6 text-xs leading-relaxed text-ink-3 sm:px-6">{t("footer")}</footer>
    </div>
  );
}
