"use client";
// Public landing page. Bare (the shell draws no chrome here), so it has its own top bar and footer.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowRight, Check, Loader2, MessageCircle } from "lucide-react";
import { api } from "@/lib/api";
import { LangToggle, useT, type Key } from "@/lib/i18n";
import { Button, Card, LinkButton, Mono, RiskMeter, Stamp, cx } from "@/lib/ui";
import { Mark } from "@/components/landing/mark";

const GITHUB = "https://github.com/Yashgurav002/pf-desk";

/** Try the demo: wait out a sleeping free server, log in with the demo passcode, open Today with the tour. */
function useDemoStart() {
  const [state, setState] = useState<"idle" | "busy" | "waking">("idle");
  const [tries, setTries] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function start(): Promise<void> {
    setState((s) => (s === "waking" ? s : "busy"));
    const retry = () => { setState("waking"); setTries((n) => n + 1); timer.current = setTimeout(start, 4000); };
    let h: { demo?: boolean; starting?: boolean };
    try { h = await api("/health", { noRedirect: true }); } catch { return retry(); } // asleep: proxy errors until it wakes
    if (h.starting) return retry();
    if (!h.demo) { location.href = "/login"; return; }
    try {
      await api("/auth/login", { method: "POST", body: JSON.stringify({ passcode: "demo" }), noRedirect: true });
      location.href = "/today?tour=1";
    } catch { location.href = "/login"; }
  }
  return { state, slow: tries > 15, start };
}

export default function Landing() {
  const { t } = useT();
  const demo = useDemoStart();
  const busy = demo.state !== "idle";

  return (
    <div className="min-h-screen">
      {/* top bar */}
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:px-6">
          <Mark />
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <LangToggle />
            <LinkButton href="/login" variant="ghost" size="sm">{t("login")}</LinkButton>
            <span className="hidden sm:inline-flex"><Button size="sm" busy={busy} onClick={demo.start}>{t("lpTryDemo")}</Button></span>
          </div>
        </div>
      </header>

      <main>
        {/* hero */}
        <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-14 pt-10 sm:px-6 lg:grid-cols-[1fr_minmax(0,30rem)] lg:gap-14 lg:pb-20 lg:pt-16">
          <div className="lg:border-l-[3px] lg:border-double lg:border-danger/35 lg:pl-8">
            <p className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-ink-3">{t("lpKicker")}</p>
            <h1 className="mt-3 max-w-xl text-[2.1rem] font-semibold leading-[1.12] tracking-tight sm:text-[2.6rem]">{t("lpTitle")}</h1>
            <p className="mt-4 max-w-xl text-[1.05rem] leading-relaxed text-ink-2">{t("lpSub")}</p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button size="lg" busy={busy} onClick={demo.start}>{t("lpCtaDemo")}</Button>
              <a href="#how" className="inline-flex h-12 items-center gap-1.5 px-2 font-semibold text-brand hover:underline">
                {t("lpCtaHow")}<ArrowRight className="size-4" aria-hidden />
              </a>
            </div>
            {demo.state === "waking" && (
              <p className="mt-3 flex max-w-xl items-start gap-2 text-sm text-ink-2" role="status" aria-live="polite">
                <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-brand" aria-hidden />{demo.slow ? t("lpWakeSlow") : t("lpWaking")}
              </p>
            )}
            <p className="mt-10 max-w-xl border-t border-line pt-4 text-[0.95rem] text-ink-2">
              {t("lpFact")} <span className="text-sm text-ink-3">— {t("lpFactSrc")}</span>
            </p>
          </div>
          <SampleClaim />
        </section>

        <HowItWorks />
        <WhoFor />

        {/* privacy + evidence */}
        <section className="border-t border-line">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
            <div>
              <Kicker>{t("lpPrivKicker")}</Kicker>
              <h2 className="text-[1.5rem] font-semibold leading-tight">{t("lpPrivTitle")}</h2>
              <ul className="mt-5 space-y-3">
                {(["lpPriv1", "lpPriv2", "lpPriv3", "lpPriv4"] as const).map((k) => (
                  <li key={k} className="flex gap-3 text-ink-2"><Check className="mt-1 size-4 shrink-0 text-ok" aria-hidden />{t(k)}</li>
                ))}
              </ul>
            </div>
            <Evidence />
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-sunk/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm sm:px-6 md:flex-row md:items-start md:justify-between">
          <p className="max-w-2xl leading-relaxed text-ink-3">{t("footer")}</p>
          <div className="flex shrink-0 items-center gap-4 text-ink-2">
            <a href={GITHUB} className="font-medium text-brand hover:underline" target="_blank" rel="noreferrer">{t("lpGithub")}</a>
            <span className="font-mono text-xs text-ink-3">{t("lpOpenSource")}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Kicker({ children }: { children: ReactNode }) {
  return <p className="mb-2 font-mono text-xs font-medium uppercase tracking-[0.12em] text-ink-3">{children}</p>;
}

/** A real-looking claim card built from the kit, so the hero shows the product rather than describing it. */
function SampleClaim() {
  const { t } = useT();
  return (
    <figure aria-label={t("lpfSample")} className="self-start">
      <figcaption className="mb-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-3">{t("lpfSample")}</figcaption>
      <Card className="overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
          <div className="min-w-0">
            <p className="text-[1.05rem] font-semibold">Ravi Kannen Bhat</p>
            <p className="mt-0.5 text-sm text-ink-3">{t("lpfForm")} · <Mono>UAN ••••4821</Mono></p>
          </div>
          <Stamp tone="danger" className="mt-1">{t("check")}</Stamp>
        </div>

        <div className="border-t border-line px-5 py-3.5">
          <p className="flex items-center gap-2 font-semibold text-danger"><AlertTriangle className="size-4" aria-hidden />{t("lpfIssue")}</p>
          <dl className="mt-2.5 overflow-hidden rounded-md border border-line text-[0.95rem]">
            <div className="grid grid-cols-[4.5rem_1fr] border-b border-line">
              <dt className="bg-sunk px-3 py-1.5 font-mono text-xs uppercase leading-6 tracking-wider text-ink-3">UAN</dt>
              <dd className="px-3 py-1.5">Kannen <span className="underline decoration-danger decoration-wavy decoration-1 underline-offset-4">Krishnadas</span> Bhat</dd>
            </div>
            <div className="grid grid-cols-[4.5rem_1fr]">
              <dt className="bg-sunk px-3 py-1.5 font-mono text-xs uppercase leading-6 tracking-wider text-ink-3">Bank</dt>
              <dd className="px-3 py-1.5">Kannen Bhat</dd>
            </div>
          </dl>
          <p className="mt-2 text-sm text-ink-2">{t("lpfFix")}</p>
        </div>

        <div className="grid grid-cols-2 border-t border-line">
          <div className="px-5 py-3">
            <p className="text-xs text-ink-3">{t("rejectionRisk").replace(":", "")}</p>
            <p className="mt-1"><RiskMeter pct={0.59} band="High" compact /></p>
          </div>
          <div className="border-l border-line px-5 py-3">
            <p className="text-xs text-ink-3">{t("lpfAfterFix")}</p>
            <p className="mt-1 text-sm font-semibold">{t("lpfPaidBy", { d: "29 Oct" })}</p>
          </div>
        </div>

        <div className="border-t border-line bg-sunk/70 px-5 py-3.5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-ink-3"><MessageCircle className="size-3.5" aria-hidden />{t("lpfWa")}</p>
          <p lang="hi" className="mt-1.5 rounded-md border border-line bg-sheet px-3 py-2 text-[0.92rem] leading-relaxed text-ink">
            नमस्ते रवि जी, आपके PF क्लेम में पिता का नाम UAN और बैंक में अलग है। कृपया बैंक से पूरा नाम लिखा हुआ लेटर लेकर आइए।
          </p>
        </div>
      </Card>
    </figure>
  );
}

const STEPS: [Key, Key, Key][] = [["lpS1t", "lpS1d", "lpS1w"], ["lpS2t", "lpS2d", "lpS2w"], ["lpS3t", "lpS3d", "lpS3w"], ["lpS4t", "lpS4d", "lpS4w"]];
const ROW = "md:grid md:grid-cols-[3.5rem_15rem_1fr_10rem] md:gap-6";

/** The claim journey as a ruled register, not icon cards. */
function HowItWorks() {
  const { t } = useT();
  return (
    <section id="how" className="scroll-mt-4 border-t border-line bg-sheet">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
        <Kicker>{t("lpHowKicker")}</Kicker>
        <h2 className="text-[1.5rem] font-semibold leading-tight">{t("lpHowTitle")}</h2>

        <div className="mt-8 border-y-2 border-ink/80">
          <div className={cx("hidden border-b border-line-strong py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-3", ROW)} aria-hidden>
            <span>{t("lpColNo")}</span><span>{t("lpColStep")}</span><span>{t("lpColWhat")}</span><span>{t("lpColWhere")}</span>
          </div>
          <ol>
            {STEPS.map(([title, desc, where], i) => (
              <li key={title} className={cx("grid grid-cols-[2.5rem_1fr] gap-x-3 border-b border-line py-5 last:border-b-0", ROW)}>
                <span className="num row-span-3 font-mono text-[1.6rem] font-semibold leading-none text-brand md:row-span-1">{i + 1}</span>
                <h3 className="font-semibold leading-snug">{t(title)}</h3>
                <p className="mt-1 text-ink-2 md:mt-0">{t(desc)}</p>
                <p className="mt-2 md:mt-0"><span className="rounded-sm bg-sunk px-1.5 py-0.5 font-mono text-xs text-ink-2">{t(where)}</span></p>
              </li>
            ))}
          </ol>
        </div>
        <p className={cx("mt-4 grid grid-cols-[2.5rem_1fr] gap-x-3 text-ink-2", ROW)}>
          <span className="font-mono text-[1.6rem] leading-none text-ink-3" aria-hidden>↻</span>
          <span className="font-semibold text-ink">{t("lpCycleLabel")}</span>
          <span className="col-start-2 md:col-start-auto">{t("lpCycle")}</span>
          <span className="col-start-2 mt-2 md:col-start-auto md:mt-0"><span className="rounded-sm bg-sunk px-1.5 py-0.5 font-mono text-xs text-ink-2">{t("lpCycleWhere")}</span></span>
        </p>
      </div>
    </section>
  );
}

function WhoFor() {
  const { t } = useT();
  const people: [Key, Key, Key][] = [["lpWho1t", "lpWho1tag", "lpWho1d"], ["lpWho2t", "lpWho2tag", "lpWho2d"], ["lpWho3t", "lpWho3tag", "lpWho3d"]];
  return (
    <section className="border-t border-line">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
        <div className="grid gap-6 lg:grid-cols-[1fr_2fr] lg:gap-14">
          <div>
            <Kicker>{t("lpWhoKicker")}</Kicker>
            <h2 className="text-[1.5rem] font-semibold leading-tight">{t("lpWhoTitle")}</h2>
            <p className="mt-3 text-ink-2">{t("lpWhoSub")}</p>
          </div>
          <dl className="grid divide-y divide-line border-y border-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {people.map(([who, tag, desc], i) => (
              <div key={who} className={cx("py-5 sm:px-5", i === 0 && "sm:pl-0")}>
                <dt>
                  <span className="block font-semibold">{t(who)}</span>
                  <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3">{t(tag)}</span>
                </dt>
                <dd className="mt-2 text-[0.95rem] text-ink-2">{t(desc)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

function Evidence() {
  const { t } = useT();
  const rows: [Key, Key, string][] = [["lpEv1", "lpEv1m", "72%"], ["lpEv2", "lpEv2m", "800/800"], ["lpEv3", "lpEv3m", "20/20"]];
  return (
    <div>
      <Kicker>{t("lpEvKicker")}</Kicker>
      <h2 className="text-[1.5rem] font-semibold leading-tight">{t("lpEvTitle")}</h2>
      <table className="mt-5 w-full text-[0.95rem]">
        <thead className="border-b border-line-strong text-left font-mono text-[11px] uppercase tracking-[0.1em] text-ink-3">
          <tr><th className="py-2 pr-4 font-medium">{t("lpEvCheck")}</th><th className="py-2 text-right font-medium">{t("lpEvResult")}</th></tr>
        </thead>
        <tbody>
          {rows.map(([label, meta, value]) => (
            <tr key={label} className="border-b border-line align-top">
              <td className="py-3 pr-4">
                <span className="block font-medium">{t(label)}</span>
                <span className="mt-0.5 block text-sm text-ink-3">{t(meta)}</span>
              </td>
              <td className="num py-3 text-right font-mono text-xl font-semibold text-ink">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <a href={`${GITHUB}/tree/main/evaluation`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
        {t("lpEvMore")}<ArrowRight className="size-3.5" aria-hidden />
      </a>
    </div>
  );
}
