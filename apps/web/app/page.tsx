"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, post, fmtDate, type ClaimRow } from "@/lib/api";
import { CopyButton, ErrorBox, Loading, RiskBadge } from "@/lib/ui";

type Today = {
  fix_before_submit: ClaimRow[]; rejected: ClaimRow[]; overdue: ClaimRow[];
  salary_missing: { employer_id: string; name: string; wage_month: string }[];
  payments_due: { employer_id: string; name: string; wage_month: string; due_date: string }[];
  escalations: { id: string; title: string; ref_id: string; created_at: string }[];
};

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2>{title} <span className="ml-1 rounded-full bg-gray-800 px-3 text-lg text-white">{count}</span></h2>
      {count === 0 ? <p className="text-gray-600">Nothing here. 👍</p> : <ul className="space-y-2">{children}</ul>}
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
  const [d, setD] = useState<Today | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => api<Today>("/v1/today").then(setD).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function act(fn: () => Promise<unknown>) {
    try { await fn(); await load(); } catch (e: any) { setError(e.message); }
  }

  if (!d) return <><h1>Today</h1><ErrorBox error={error} />{!error && <Loading />}</>;
  return (
    <div>
      <h1>Today</h1>
      <ErrorBox error={error} />

      <Section title="Fix before submitting" count={d.fix_before_submit.length}>
        {d.fix_before_submit.map((c) => (
          <Row key={c.id} action={<Link className="btn" href={`/claims/${c.id}`}>Fix</Link>}>
            {who(c)}<div className="mt-1"><RiskBadge pct={c.risk_pct} /> {c.issue_count != null && <span className="ml-2">{c.issue_count} problem(s)</span>}</div>
          </Row>
        ))}
      </Section>

      <Section title="Rejected — decode and resubmit" count={d.rejected.length}>
        {d.rejected.map((c) => (
          <Row key={c.id} action={<Link className="btn" href={`/claims/${c.id}#decoder`}>Decode</Link>}>
            {who(c)}{c.rejection_remark && <div className="mt-1 italic text-gray-800">“{c.rejection_remark}”</div>}
          </Row>
        ))}
      </Section>

      <Section title="Overdue — past expected date" count={d.overdue.length}>
        {d.overdue.map((c) => (
          <Row key={c.id} action={<Link className="btn" href={`/claims/${c.id}`}>Open</Link>}>
            {who(c)}<div className="mt-1">Submitted {fmtDate(c.submitted_at)}{c.eta_high != null && <> · expected within {c.eta_high} days</>}</div>
          </Row>
        ))}
      </Section>

      <Section title="Salary data not received" count={d.salary_missing.length}>
        {d.salary_missing.map((s) => (
          <Row key={s.employer_id + s.wage_month} action={<CopyButton label="Copy reminder" text={`Namaste, please send the salary sheet for ${s.wage_month} so we can prepare the PF return. Thank you.`} />}>
            <b>{s.name}</b> · wage month {s.wage_month}
          </Row>
        ))}
      </Section>

      <Section title="PF payments due soon" count={d.payments_due.length}>
        {d.payments_due.map((p) => (
          <Row key={p.employer_id + p.wage_month} action={<button className="btn" onClick={() => act(() => post(`/v1/employers/${p.employer_id}/cycle/paid`, { wage_month: p.wage_month }))}>Mark paid</button>}>
            <b>{p.name}</b> · {p.wage_month} · due <b>{fmtDate(p.due_date)}</b>
          </Row>
        ))}
      </Section>

      <Section title="Employee questions needing you" count={d.escalations.length}>
        {d.escalations.map((t) => (
          <Row key={t.id} action={<button className="btn" onClick={() => act(() => post(`/v1/tasks/${t.id}/done`, {}))}>Done</button>}>
            <b>{t.title}</b><div className="text-gray-700">{fmtDate(t.created_at)}</div>
          </Row>
        ))}
      </Section>
    </div>
  );
}
