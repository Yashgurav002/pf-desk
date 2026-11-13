"use client";
// Ledger table (DESIGN.md) for Today, Claims and Search: ruled table on desktop, stacked rows on phones.
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import type { ClaimRow, Issue } from "@/lib/api";
import type { Key } from "@/lib/i18n";
import { Card, cx } from "@/lib/ui";

export type Row = { key: string; href?: string; cells: ReactNode[] };
export type Col = { label: ReactNode; className?: string };

/** Rows link by `href` (whole row clickable). The first cell is the title on phones, the last cell is the action. */
export function Ledger({ cols, rows }: { cols: Col[]; rows: Row[] }) {
  const router = useRouter();
  const go = (e: React.MouseEvent, href?: string) => {
    if (!href || (e.target as HTMLElement).closest("a,button,input,summary")) return;
    router.push(href);
  };
  return (
    <Card className="overflow-hidden">
      <table className="hidden w-full text-[0.95rem] md:table">
        <thead className="bg-sunk text-left font-mono text-[11px] uppercase tracking-[0.1em] text-ink-3">
          <tr>{cols.map((c, i) => <th key={i} className={cx("px-4 py-2.5 font-medium", c.className)}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} onClick={(e) => go(e, r.href)} className={cx("border-t border-line align-middle hover:bg-[#fcfbf8]", r.href && "cursor-pointer")}>
              {r.cells.map((c, i) => <td key={i} className={cx("px-4 py-2.5", cols[i]?.className)}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="divide-y divide-line md:hidden">
        {rows.map((r) => {
          const [first, ...rest] = r.cells;
          const action = rest.pop();
          return (
            <li key={r.key} onClick={(e) => go(e, r.href)} className={cx("flex items-center gap-3 px-4 py-3", r.href && "cursor-pointer")}>
              <div className="min-w-0 flex-1">
                {first}
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">{rest.map((c, i) => c != null && c !== "" && <span key={i}>{c}</span>)}</div>
              </div>
              {action}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ---------- shared data helpers ----------
export type Claim = ClaimRow & { top_issue?: Issue | null; eta_days?: number | null };
type T = (k: Key, v?: Record<string, string | number>) => string;

const DAY = 86_400_000;
export const shortDate = (s: string | Date) => new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
export const monthLabel = (s: string) => new Date(s).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
export const addDays = (s: string, n: number) => new Date(new Date(s).getTime() + Math.round(n) * DAY);
export const daysSince = (d: Date) => Math.floor((Date.now() - d.getTime()) / DAY);
/** The API's overdue rule: submitted + eta_high (30 days if unknown). */
export const overdueSince = (c: Claim) => addDays(c.submitted_at!, c.eta_high ?? 30);

/** One plain line for a claim's top Pre-check problem, e.g. "Father's name doesn't match bank +1 more". */
export function issueLine(t: T, c: Claim) {
  const i = c.top_issue;
  if (!i) return c.issue_count ? t("tdRIssues", { n: c.issue_count }) : t("tdRHighRisk");
  const key = `td_iss_${i.code}` as Key;
  const text = t(key) === key ? i.message : t(key);
  return (c.issue_count ?? 1) > 1 ? `${text} ${t("tdRMore", { n: c.issue_count! - 1 })}` : text;
}

/** The single next step for a claim, by status. */
export function claimAction(t: T, c: Claim): { label: string; href: string } {
  const href = `/claims/${c.id}`;
  if (c.status === "rejected") return { label: t("tdADecode"), href: href + "#decoder" };
  if (c.status === "draft" || c.status === "checked") {
    if (c.issue_count) return { label: t("tdAFix"), href };
    if (c.risk_pct == null) return { label: t("tdACheck"), href: href + "?run=precheck" };
  }
  return { label: t("tdAOpen"), href };
}
