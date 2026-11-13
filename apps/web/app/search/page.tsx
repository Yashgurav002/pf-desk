"use client";
// Search results from the top bar: workers (name or UAN digits) and claims (worker, company or UAN digits).
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Card, EmptyState, ErrorBox, LinkButton, Mono, PageHeader, SectionTitle, SkeletonRows, StatusStamp } from "@/lib/ui";
import { Ledger, claimAction, type Claim } from "@/components/today/ledger";

type Worker = { id: string; name_uan: string; employer_name: string; uan_masked: string; claim_count: number };
const SHOW = 20;

export default function SearchPage() {
  return <Suspense><Results /></Suspense>;
}

function Results() {
  const { t } = useT();
  const q = (useSearchParams().get("q") ?? "").trim();
  const [res, setRes] = useState<{ workers: Worker[]; claims: Claim[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRes(null); setError(null);
    if (!q) return;
    const s = encodeURIComponent(q);
    Promise.all([api<Worker[]>(`/v1/employees?q=${s}`), api<Claim[]>(`/v1/claims?q=${s}`)])
      .then(([workers, claims]) => setRes({ workers, claims })).catch((e) => setError(e.message));
  }, [q]);

  const empty = res && !res.workers.length && !res.claims.length;
  return (
    <div className="space-y-8">
      <PageHeader title={q ? t("srFor", { q }) : t("srTitle")} />

      <ErrorBox error={error} />
      {!q || empty ? (
        <EmptyState icon={<Search className="size-5" />} title={q ? t("srNone", { q }) : t("srEmptyTitle")}>{t("srTips")}</EmptyState>
      ) : !res ? !error && <Card className="p-4"><SkeletonRows rows={6} /></Card> : (
        <>
          {res.workers.length > 0 && (
            <section>
              <SectionTitle count={res.workers.length}>{t("srWorkers")}</SectionTitle>
              <Ledger cols={[{ label: t("tdColWorker") }, { label: "UAN" }, { label: t("claims") }, { label: "", className: "text-right" }]}
                rows={res.workers.slice(0, SHOW).map((w) => ({
                  key: w.id, href: `/employees?focus=${w.id}`,
                  cells: [
                    <span key="w" className="block leading-snug"><Link href={`/employees?focus=${w.id}`} className="font-semibold hover:text-brand">{w.name_uan}</Link>
                      <span className="block text-sm text-ink-3">{w.employer_name}</span></span>,
                    <Mono key="u" className="text-sm">{w.uan_masked}</Mono>,
                    w.claim_count > 0
                      ? <Link key="c" href={`/claims?q=${encodeURIComponent(w.name_uan)}`} className="text-sm font-medium text-brand hover:underline">{t("ncClaimsCount", { n: w.claim_count })}</Link>
                      : <span key="c" className="text-sm text-ink-3">—</span>,
                    <span key="a" className="flex justify-end"><LinkButton href={`/employees?focus=${w.id}`} size="sm" variant="secondary">{t("srOpenWorker")}</LinkButton></span>,
                  ],
                }))} />
            </section>
          )}
          {res.claims.length > 0 && (
            <section>
              <SectionTitle count={res.claims.length}
                action={res.claims.length > SHOW && <Link href={`/claims?q=${encodeURIComponent(q)}`} className="text-sm font-medium text-brand hover:underline">{t("srAllClaims")}</Link>}>
                {t("srClaims")}
              </SectionTitle>
              <Ledger cols={[{ label: t("tdColWorker") }, { label: t("tdColForm") }, { label: t("status") }, { label: "", className: "text-right" }]}
                rows={res.claims.slice(0, SHOW).map((c) => {
                  const a = claimAction(t, c);
                  return {
                    key: c.id, href: `/claims/${c.id}`,
                    cells: [
                      <span key="w" className="block leading-snug"><Link href={`/claims/${c.id}`} className="font-semibold hover:text-brand">{c.employee_name}</Link>
                        <span className="block text-sm text-ink-3">{c.employer_name}</span></span>,
                      <span key="f" className="num font-mono text-sm">Form {c.form}</span>,
                      <StatusStamp key="s" status={c.status} />,
                      <span key="a" className="flex justify-end"><LinkButton href={a.href} size="sm" variant="secondary">{a.label}</LinkButton></span>,
                    ],
                  };
                })} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
