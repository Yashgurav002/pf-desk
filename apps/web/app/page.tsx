"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, post, fmtDate, type ClaimRow } from "@/lib/api";
import { CopyButton, ErrorBox, Loading, RiskBadge } from "@/lib/ui";
import { useT } from "@/lib/i18n";

type Today = {
  fix_before_submit: ClaimRow[]; rejected: ClaimRow[]; overdue: ClaimRow[];
  salary_missing: { employer_id: string; name: string; wage_month: string }[];
  payments_due: { employer_id: string; name: string; wage_month: string; due_date: string }[];
  escalations: { id: string; title: string; ref_id: string; created_at: string }[];
};

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  const { t } = useT();
  return (
    <section className="mb-6">
      <h2>{title} <span className="ml-1 rounded-full bg-gray-800 px-3 text-lg text-white">{count}</span></h2>
      {count === 0 ? <p className="text-gray-600">{t("nothingHere")}</p> : <ul className="space-y-2">{children}</ul>}
    </section>
  );
}

function Row({ children, action }: { children: React.ReactNode; action: React.ReactNode }) {
  return (
    <li className="card flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 flex-1">{children}</div>
      <div>{action}</div>
    </li>
  );
}

const who = (c: ClaimRow) => <><b>{c.employee_name}</b> · Form {c.form} · {c.employer_name}</>;

export default function TodayPage() {
  const { t } = useT();
  const [d, setD] = useState<Today | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => api<Today>("/v1/today").then(setD).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function act(fn: () => Promise<unknown>) {
    try { await fn(); await load(); } catch (e: any) { setError(e.message); }
  }

  if (!d) return <><h1>{t("today")}</h1><ErrorBox error={error} />{!error && <Loading />}</>;
  return (
    <div>
      <h1>{t("today")}</h1>
      <ErrorBox error={error} />

      <Section title={t("secFix")} count={d.fix_before_submit.length}>
        {d.fix_before_submit.map((c) => (
          <Row key={c.id} action={<Link className="btn" href={`/claims/${c.id}`}>{t("fix")}</Link>}>
            {who(c)}<div className="mt-1"><RiskBadge pct={c.risk_pct} /> {c.issue_count != null && <span className="ml-2">{t("problems", { n: c.issue_count })}</span>}</div>
          </Row>
        ))}
      </Section>

      <Section title={t("secRejected")} count={d.rejected.length}>
        {d.rejected.map((c) => (
          <Row key={c.id} action={<Link className="btn" href={`/claims/${c.id}#decoder`}>{t("decode")}</Link>}>
            {who(c)}{c.rejection_remark && <div className="mt-1 italic text-gray-800">“{c.rejection_remark}”</div>}
          </Row>
        ))}
      </Section>

      <Section title={t("secOverdue")} count={d.overdue.length}>
        {d.overdue.map((c) => (
          <Row key={c.id} action={<Link className="btn" href={`/claims/${c.id}`}>{t("open")}</Link>}>
            {who(c)}<div className="mt-1">{t("submittedOn", { d: fmtDate(c.submitted_at) })}{c.eta_high != null && <> · {t("expectedWithin", { n: c.eta_high })}</>}</div>
          </Row>
        ))}
      </Section>

      <Section title={t("secSalary")} count={d.salary_missing.length}>
        {d.salary_missing.map((s) => (
          <Row key={s.employer_id + s.wage_month} action={<CopyButton label={t("copyReminder")} text={`Namaste, please send the salary sheet for ${s.wage_month} so we can prepare the PF return. Thank you.`} />}>
            <b>{s.name}</b> · {t("wageMonth")} {s.wage_month}
          </Row>
        ))}
      </Section>

      <Section title={t("secPayments")} count={d.payments_due.length}>
        {d.payments_due.map((p) => (
          <Row key={p.employer_id + p.wage_month} action={<button className="btn" onClick={() => act(() => post(`/v1/employers/${p.employer_id}/cycle/paid`, { wage_month: p.wage_month }))}>{t("markPaid")}</button>}>
            <b>{p.name}</b> · {p.wage_month} · {t("due")} <b>{fmtDate(p.due_date)}</b>
          </Row>
        ))}
      </Section>

      <Section title={t("secQuestions")} count={d.escalations.length}>
        {d.escalations.map((task) => (
          <Row key={task.id} action={<button className="btn" onClick={() => act(() => post(`/v1/tasks/${task.id}/done`, {}))}>{t("done")}</button>}>
            <b>{task.title}</b><div className="text-gray-700">{fmtDate(task.created_at)}</div>
          </Row>
        ))}
      </Section>
    </div>
  );
}
