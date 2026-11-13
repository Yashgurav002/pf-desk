"use client";
// Claims ledger. URL state: ?status= (one status or a comma list) and ?q=, so links from Today and Search land filtered.
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ListChecks, Plus, Search } from "lucide-react";
import { api, fmtDate } from "@/lib/api";
import { useT, type Key } from "@/lib/i18n";
import { Button, EmptyState, ErrorBox, Input, LinkButton, PageHeader, RiskMeter, Skeleton, StatusStamp, cx } from "@/lib/ui";
import { Ledger, addDays, claimAction, type Claim } from "@/components/today/ledger";

const TABS: { label: Key; status: string }[] = [
  { label: "clTabAll", status: "" },
  { label: "clTabCheck", status: "draft,checked" },
  { label: "clTabSubmitted", status: "submitted,under_process,resubmitted" },
  { label: "clTabRejected", status: "rejected" },
  { label: "clTabSettled", status: "settled" },
];
const LIMIT = 300; // the API returns the newest 300

export default function ClaimsPage() {
  return <Suspense><Claims /></Suspense>;
}

function Claims() {
  const { t } = useT();
  const router = useRouter(), path = usePathname(), params = useSearchParams();
  const status = params.get("status") ?? "", q = params.get("q") ?? "";
  const [text, setText] = useState(q);
  const [rows, setRows] = useState<Claim[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(params.toString());
    if (v) p.set(k, v); else p.delete(k);
    router.replace(`${path}${p.size ? "?" + p : ""}`, { scroll: false });
  };

  // typing updates ?q= after a short pause
  useEffect(() => {
    if (text.trim() === q) return;
    const id = setTimeout(() => setParam("q", text.trim()), 300);
    return () => clearTimeout(id);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setRows(null); setError(null);
    const qs = new URLSearchParams({ ...(status && { status }), ...(q && { q }) });
    api<Claim[]>(`/v1/claims?${qs}`).then(setRows).catch((e) => setError(e.message));
  }, [status, q]);
  useEffect(() => {
    api<Record<string, number>>(`/v1/claims/counts?q=${encodeURIComponent(q)}`).then(setCounts).catch(() => setCounts(null)); // older API: tabs without counts
  }, [q]);

  const count = (s: string) => counts && (s ? s.split(",") : Object.keys(counts)).reduce((n, k) => n + (counts[k] ?? 0), 0);

  return (
    <div>
      <PageHeader title={t("claims")} description={t("clDesc")}
        actions={<LinkButton href="/claims/new" icon={<Plus className="size-4" />}>{t("newClaim")}</LinkButton>} />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <nav className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 lg:mx-0 lg:px-0" aria-label={t("status")}>
          {TABS.map((tab) => {
            const on = tab.status === status, n = count(tab.status);
            return (
              <button key={tab.label} data-tab ref={on ? (el) => el?.scrollIntoView({ block: "nearest", inline: "nearest" }) : undefined} onClick={() => setParam("status", tab.status)} aria-current={on ? "page" : undefined}
                className={cx("-mb-px flex h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-[0.95rem] transition-colors",
                  on ? "border-brand font-semibold text-ink" : "border-transparent text-ink-2 hover:text-ink")}>
                {t(tab.label)}
                {n != null && <span className={cx("num rounded-sm px-1.5 font-mono text-xs", on ? "bg-brand-tint text-brand" : "bg-sunk text-ink-3")}>{n}</span>}
              </button>
            );
          })}
        </nav>
        <label className="relative block w-full lg:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("clFilter")} aria-label={t("clFilter")} className="pl-9" />
        </label>
      </div>

      <ErrorBox error={error} />
      {!rows ? !error && <TableSkeleton /> : rows.length === 0 ? (
        <EmptyState icon={<ListChecks className="size-5" />} title={t("clNone")}
          action={(q || status) && <Button variant="secondary" onClick={() => { setText(""); router.replace(path); }}>{t("clClear")}</Button>}>
          {t("clNoneHint")}
        </EmptyState>
      ) : (
        <>
          <Ledger
            cols={[{ label: t("tdColWorker") }, { label: t("tdColForm") }, { label: t("status"), className: "whitespace-nowrap" }, { label: t("tdColRisk") },
              { label: t("tdColSubmitted") }, { label: t("tdColLikely") }, { label: <span className="sr-only">{t("clAction")}</span>, className: "text-right" }]}
            rows={rows.map((c) => {
              const a = claimAction(t, c), eta = c.eta_days ?? c.eta_high;
              return {
                key: c.id, href: a.href,
                cells: [
                  <span key="w" className="block leading-snug"><Link href={`/claims/${c.id}`} className="font-semibold hover:text-brand">{c.employee_name}</Link>
                    <span className="block text-sm text-ink-3">{c.employer_name}</span></span>,
                  <span key="f" className="num whitespace-nowrap font-mono text-sm">Form {c.form}</span>,
                  <StatusStamp key="s" status={c.status} />,
                  c.risk_pct == null && c.status !== "draft" && c.status !== "checked" ? null : <RiskMeter key="r" pct={c.risk_pct} compact />,
                  c.submitted_at ? <span key="d" className="num whitespace-nowrap font-mono text-sm">{fmtDate(c.submitted_at)}</span> : null,
                  <span key="l" className="num whitespace-nowrap font-mono text-sm text-ink-2">{likely(t, c, eta)}</span>,
                  <span key="a" className="flex justify-end"><LinkButton href={a.href} size="sm" variant="secondary">{a.label}</LinkButton></span>,
                ],
              };
            })} />
          {rows.length >= LIMIT && <p className="mt-3 text-sm text-ink-3">{t("clLatest", { n: LIMIT })}</p>}
        </>
      )}
    </div>
  );
}

function likely(t: ReturnType<typeof useT>["t"], c: Claim, eta: number | null | undefined) {
  if (["settled", "rejected", "closed"].includes(c.status) || eta == null) return "";
  return c.submitted_at ? fmtDate(addDays(c.submitted_at, eta).toISOString()) : t("clAfterFiling", { n: Math.round(eta) });
}

function TableSkeleton() {
  return (
    <div className="space-y-px overflow-hidden rounded-lg border border-line bg-sheet" aria-busy="true">
      <div className="h-9 bg-sunk" />
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-6 border-t border-line px-4 py-3.5">
          <Skeleton className="w-48" /><Skeleton className="w-16" /><Skeleton className="w-20" /><Skeleton className="hidden w-24 md:block" /><Skeleton className="ml-auto w-16" />
        </div>
      ))}
    </div>
  );
}
