"use client";
// Today: an inbox. Stats on top, one merged "Do next" list, then every section as a collapsed ledger.
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronRight, Sparkles } from "lucide-react";
import { api, post, fmtDate } from "@/lib/api";
import { useT } from "@/lib/i18n";
import {
  Button, Card, CopyButton, EmptyState, ErrorBox, LinkButton, PageHeader, RiskMeter, SectionTitle, Skeleton, SkeletonRows, Stat, cx,
} from "@/lib/ui";
import { Ledger, claimAction, daysSince, issueLine, monthLabel, overdueSince, shortDate, type Claim, type Col, type Row } from "@/components/today/ledger";

type Payment = { employer_id: string; name: string; wage_month: string; due_date: string };
type Salary = { employer_id: string; name: string; wage_month: string };
type Escalation = { id: string; title: string; ref_id: string; created_at: string };
type Today = {
  fix_before_submit: Claim[]; rejected: Claim[]; overdue: Claim[]; salary_missing: Salary[]; payments_due: Payment[]; escalations: Escalation[];
  counts?: { fix_before_submit: number; rejected: number; overdue: number }; // full totals; the lists stop at 50
};
type Tone = "danger" | "warn" | "brand" | "neutral";
type Item = { key: string; tone: Tone; who: ReactNode; reason: ReactNode; meta: ReactNode[]; action: (first: boolean) => ReactNode }; // only the top row gets the primary button

const LOCALE = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" } as const;
const TOP = 10;

export default function TodayPage() {
  const { t, lang } = useT();
  const [d, setD] = useState<Today | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = () => api<Today>("/v1/today").then(setD).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function act(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    try { await fn(); await load(); } catch (e: any) { setError(e.message); } finally { setBusy(null); }
  }
  const markPaid = (p: Payment) => act("pay" + p.employer_id, () => post(`/v1/employers/${p.employer_id}/cycle/paid`, { wage_month: p.wage_month }));
  const taskDone = (e: Escalation) => act("task" + e.id, () => post(`/v1/tasks/${e.id}/done`, {}));

  const kicker = new Date().toLocaleDateString(LOCALE[lang], { weekday: "long", day: "numeric", month: "long" });
  const header = <PageHeader kicker={kicker} title={t("today")} description={t("tdDesc")} />;
  if (!d) return <>{header}<ErrorBox error={error} />{!error && <TodaySkeleton />}</>;

  const n = {
    fix: d.counts?.fix_before_submit ?? d.fix_before_submit.length,
    rejected: d.counts?.rejected ?? d.rejected.length,
    overdue: d.counts?.overdue ?? d.overdue.length,
  };
  const items = doNext(t, d, { markPaid, busy });
  const nothing = !items.length;

  return (
    <div className="space-y-8">
      {header}
      <ErrorBox error={error} />

      {/* tiles jump to their section and open it */}
      <div className={cx("grid grid-cols-2 gap-3", d.escalations.length ? "lg:grid-cols-5" : "lg:grid-cols-4")}
        onClickCapture={(e) => {
          const el = document.getElementById((e.target as HTMLElement).closest("a")?.getAttribute("href")?.slice(1) ?? "");
          if (!el) return;
          e.preventDefault(); e.stopPropagation();
          el.setAttribute("open", "");
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }}>
        <Stat tone="danger" label={t("tdStatFix")} value={n.fix} hint={t("tdHintFix")} href="#sec-fix" />
        <Stat tone="warn" label={t("tdStatOverdue")} value={n.overdue} hint={t("tdHintOverdue")} href="#sec-overdue" />
        <Stat tone="danger" label={t("tdStatRejected")} value={n.rejected} hint={t("tdHintRejected")} href="#sec-rejected" />
        <Stat tone="brand" label={t("tdStatPay")} value={d.payments_due.length} hint={t("tdHintPay")} href="#sec-pay" />
        {d.escalations.length > 0 && <Stat tone="warn" label={t("tdStatCalls")} value={d.escalations.length} hint={t("tdHintCalls")} href="#sec-calls" />}
      </div>

      {nothing ? (
        <EmptyState icon={<Sparkles className="size-5" />} title={t("tdAllClearTitle")} action={<LinkButton href="/claims/new">{t("newClaim")}</LinkButton>}>
          {t("tdAllClearBody")}
        </EmptyState>
      ) : (
        <section data-tour="inbox">
          <SectionTitle count={items.length}>{t("tdDoNext")}</SectionTitle>
          <p className="-mt-1 mb-3 text-sm text-ink-3">{t("tdDoNextHint")}</p>
          <Card>
            <ol className="divide-y divide-line">
              {items.map((it, i) => (
                <li key={it.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:flex-nowrap">
                  <span className="num w-5 shrink-0 self-start pt-0.5 text-right font-mono text-sm text-ink-3" aria-hidden>{i + 1}</span>
                  <span className={cx("w-[3px] shrink-0 self-stretch rounded",
                    { danger: "bg-danger", warn: "bg-warn", brand: "bg-brand", neutral: "bg-line-strong" }[it.tone])} aria-hidden />
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="font-semibold leading-snug">{it.who}</p>
                    <p className="leading-snug text-ink-2">{it.reason}</p>
                    <p className="mt-0.5 flex flex-wrap gap-x-2 text-sm text-ink-3">
                      {it.meta.filter(Boolean).map((m, j) => <span key={j} className={j ? "before:mr-2 before:content-['·']" : ""}>{m}</span>)}
                    </p>
                  </div>
                  <div className="ml-9 sm:ml-0">{it.action(i === 0)}</div>
                </li>
              ))}
            </ol>
          </Card>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="mb-3 font-mono text-xs font-medium uppercase tracking-[0.12em] text-ink-3">{t("tdAllSections")}</h2>

        <Section id="sec-fix" title={t("tdSecFix")} count={n.fix} shown={d.fix_before_submit.length} more="/claims?status=draft,checked"
          cols={[{ label: t("tdColWorker") }, { label: t("tdColForm") }, { label: t("tdColProblem") }, { label: t("tdColRisk") }, { label: "", className: "text-right" }]}
          rows={d.fix_before_submit.map((c) => claimRow(t, c, [<span key="p" className="text-ink-2">{issueLine(t, c)}</span>, <RiskMeter key="r" pct={c.risk_pct} compact />]))} />

        <Section id="sec-rejected" title={t("tdSecRejected")} count={n.rejected} shown={d.rejected.length} more="/claims?status=rejected"
          cols={[{ label: t("tdColWorker") }, { label: t("tdColForm") }, { label: t("tdColRemark") }, { label: "", className: "text-right" }]}
          rows={d.rejected.map((c) => claimRow(t, c, [<span key="r" className="font-mono text-sm text-ink-2">{c.rejection_remark ?? "—"}</span>]))} />

        <Section id="sec-overdue" title={t("tdSecOverdue")} count={n.overdue} shown={d.overdue.length} more="/claims?status=submitted,under_process,resubmitted"
          cols={[{ label: t("tdColWorker") }, { label: t("tdColForm") }, { label: t("tdColSubmitted") }, { label: t("tdColLikely") }, { label: "", className: "text-right" }]}
          rows={d.overdue.map((c) => {
            const by = overdueSince(c);
            return claimRow(t, c, [
              <span key="s" className="num font-mono text-sm">{fmtDate(c.submitted_at)}</span>,
              <span key="l" className="num font-mono text-sm">{fmtDate(by.toISOString())} <span className="text-warn">· {t("tdDaysLate", { n: daysSince(by) })}</span></span>,
            ], t("tdAPortal"));
          })} />

        <Section id="sec-salary" title={t("tdSecSalary")} count={d.salary_missing.length} more="/cycle"
          cols={[{ label: t("tdColCompany") }, { label: t("tdColMonth") }, { label: "", className: "text-right" }]}
          rows={d.salary_missing.map((s) => ({
            key: s.employer_id + s.wage_month,
            cells: [<span key="n" className="font-semibold">{s.name}</span>, <span key="m" className="num font-mono text-sm">{monthLabel(s.wage_month)}</span>,
              <CopyButton key="a" size="sm" label={t("tdACopy")} text={t("tdReminder", { m: monthLabel(s.wage_month) })} />],
          }))} />

        <Section id="sec-pay" title={t("tdSecPay")} count={d.payments_due.length} more="/cycle"
          cols={[{ label: t("tdColCompany") }, { label: t("tdColMonth") }, { label: t("tdColDue") }, { label: "", className: "text-right" }]}
          rows={d.payments_due.map((p) => ({
            key: p.employer_id + p.wage_month,
            cells: [<span key="n" className="font-semibold">{p.name}</span>, <span key="m" className="num font-mono text-sm">{monthLabel(p.wage_month)}</span>,
              <span key="d" className="num font-mono text-sm">{fmtDate(p.due_date)}</span>,
              <Button key="a" size="sm" variant="secondary" busy={busy === "pay" + p.employer_id} onClick={() => markPaid(p)}>{t("tdAPaid")}</Button>],
          }))} />

        {d.escalations.length > 0 && (
          <Section id="sec-calls" title={t("tdSecCalls")} count={d.escalations.length}
            cols={[{ label: t("tdColQuestion") }, { label: t("tdColAsked") }, { label: "", className: "text-right" }]}
            rows={d.escalations.map((e) => ({
              key: e.id, href: `/employees?focus=${e.ref_id}`,
              cells: [<span key="q">{e.title}</span>, <span key="d" className="num font-mono text-sm">{fmtDate(e.created_at)}</span>,
                <Button key="a" size="sm" variant="secondary" busy={busy === "task" + e.id} onClick={() => taskDone(e)}>{t("tdADone")}</Button>],
            }))} />
        )}
      </section>
    </div>
  );
}

type T = ReturnType<typeof useT>["t"];

/** Worker + form + extra cells + one action, linking to the claim. */
function claimRow(t: T, c: Claim, extra: ReactNode[], label?: string): Row {
  const a = claimAction(t, c);
  return {
    key: c.id, href: a.href,
    cells: [
      <span key="w" className="block leading-snug"><Link href={a.href} className="font-semibold hover:text-brand">{c.employee_name}</Link>
        <span className="block text-sm text-ink-3">{c.employer_name}</span></span>,
      <span key="f" className="num font-mono text-sm">Form {c.form}</span>,
      ...extra,
      <span key="a" className="flex justify-end"><LinkButton href={a.href} size="sm" variant="secondary">{label ?? a.label}</LinkButton></span>,
    ],
  };
}

/** Collapsed section: native <details>, opens when its stat tile is clicked (hash). */
function Section({ id, title, count, shown, more, cols, rows }: { id: string; title: string; count: number; shown?: number; more?: string; cols: Col[]; rows: Row[] }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  useEffect(() => { if (location.hash === "#" + id) setOpen(true); }, [id]);
  return (
    <details id={id} open={open} onToggle={(e) => setOpen(e.currentTarget.open)}
      className="group scroll-mt-20 rounded-lg border border-line bg-sheet shadow-[var(--shadow-card)] open:bg-paper [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-4 py-3 hover:bg-[#fcfbf8] group-open:hover:bg-transparent">
        <ChevronRight className="size-4 shrink-0 text-ink-3 transition-transform group-open:rotate-90" aria-hidden />
        <span className="flex-1 [&>div]:mb-0"><SectionTitle count={count}>{title}</SectionTitle></span>
        {count > 0 && more && <Link href={more} className="text-sm font-medium text-brand hover:underline">{t("tdSeeAll", { n: count })}</Link>}
      </summary>
      <div className="px-2 pb-2 sm:px-3 sm:pb-3">
        {rows.length === 0 ? <p className="px-2 pb-2 text-ink-3">{t("tdNone")}</p> : <>
          <Ledger cols={cols} rows={rows.slice(0, TOP)} />
          {count > TOP && <p className="mt-2 px-1 text-sm text-ink-3">{t("tdTopOf", { n: Math.min(TOP, shown ?? rows.length), total: count })}</p>}
        </>}
      </div>
    </details>
  );
}

/** Merge every section into one short list, most urgent first. Each kind gets a few slots, then free slots go in priority order. */
function doNext(t: T, d: Today, { markPaid, busy }: { markPaid: (p: Payment) => void; busy: string | null }): Item[] {
  const todayIso = new Date().toLocaleDateString("en-CA");
  const pay: Item[] = d.payments_due.map((p) => {
    const m = monthLabel(p.wage_month);
    const late = p.due_date < todayIso, isToday = p.due_date === todayIso;
    return {
      key: "pay" + p.employer_id, tone: late || isToday ? "danger" : "brand", who: p.name,
      reason: isToday ? t("tdRPayToday", { m }) : t(late ? "tdRPayLate" : "tdRPay", { m, d: fmtDate(p.due_date) }),
      meta: [t("tdStatPay")],
      action: (f) => <Button size="sm" variant={f ? "primary" : "secondary"} busy={busy === "pay" + p.employer_id} onClick={() => markPaid(p)}>{t("tdAPaid")}</Button>,
    };
  });
  const claimItem = (c: Claim, tone: Tone, reason: ReactNode, label: string, href: string, extra?: string): Item => ({
    key: c.id, tone, who: c.employee_name, reason,
    meta: [`Form ${c.form}`, c.employer_name, extra ?? ""],
    action: (f) => <LinkButton href={href} size="sm" variant={f ? "primary" : "secondary"}>{label}</LinkButton>,
  });
  const rejected = d.rejected.map((c) => claimItem(c, "danger",
    c.rejection_remark ? t("tdRRejected", { r: c.rejection_remark }) : t("tdRRejectedBare"), t("tdADecode"), `/claims/${c.id}#decoder`,
    c.submitted_at ? shortDate(c.submitted_at) : undefined));
  const fix = d.fix_before_submit.map((c) => claimItem(c, "danger", issueLine(t, c), t("tdAFix"), `/claims/${c.id}`,
    c.risk_pct != null ? `${t("tdColRisk")} ${Math.round(c.risk_pct * 100)}%` : undefined));
  const overdue = [...d.overdue].sort((a, b) => overdueSince(a).getTime() - overdueSince(b).getTime()).map((c) => {
    const by = overdueSince(c);
    return claimItem(c, "warn", t("tdROverdue", { d: fmtDate(by.toISOString()) }), t("tdAPortal"), `/claims/${c.id}`, t("tdDaysLate", { n: daysSince(by) }));
  });
  const salary: Item[] = d.salary_missing.map((s) => ({
    key: "sal" + s.employer_id, tone: "neutral", who: s.name, reason: t("tdRSalary", { m: monthLabel(s.wage_month) }), meta: [t("tdSecSalary")],
    action: (f) => <CopyButton size="sm" variant={f ? "primary" : "secondary"} label={t("tdACopy")} text={t("tdReminder", { m: monthLabel(s.wage_month) })} />,
  }));
  const calls: Item[] = d.escalations.map((e) => ({
    key: "call" + e.id, tone: "warn", who: t("tdHelpline"), reason: e.title, meta: [fmtDate(e.created_at)],
    action: (f) => <LinkButton href={`/employees?focus=${e.ref_id}`} size="sm" variant={f ? "primary" : "secondary"}>{t("tdACall")}</LinkButton>,
  }));

  const pools = [pay, rejected, fix, overdue, salary, calls];
  const picked = pools.map((p, i) => p.slice(0, [2, 2, 2, 1, 1, 1][i]));
  let left = 8 - picked.flat().length;
  pools.forEach((p, i) => {
    const extra = p.slice(picked[i].length, picked[i].length + Math.max(0, left));
    picked[i].push(...extra);
    left -= extra.length;
  });
  return picked.flat();
}

function TodaySkeleton() {
  return (
    <div className="space-y-8" aria-busy="true">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Card key={i} className="space-y-3 px-4 py-4"><Skeleton className="w-2/3" /><Skeleton className="h-7 w-12" /><Skeleton className="h-3 w-1/2" /></Card>)}
      </div>
      <div><Skeleton className="mb-3 h-5 w-28" /><Card className="p-4"><SkeletonRows rows={6} /></Card></div>
    </div>
  );
}
