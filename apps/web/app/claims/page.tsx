"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, fmtDate, STATUSES, type ClaimRow } from "@/lib/api";
import { ErrorBox, Loading, RiskBadge } from "@/lib/ui";


export default function Claims() {
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<ClaimRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setRows(null);
    api<ClaimRow[]>(`/v1/claims${status ? `?status=${status}` : ""}`).then(setRows).catch((e) => setError(e.message));
  }, [status]);

  return (
    <div>
      <h1>Claims</h1>
      <p className="mb-4">To start a new claim, go to <Link className="underline" href="/employees">Employees</Link> and press “New claim”.</p>
      <label className="mb-4 block font-semibold">Status{" "}
        <select className="inp mt-1 max-w-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <ErrorBox error={error} />
      {!rows ? !error && <Loading /> : rows.length === 0 ? <p>No claims.</p> : (
        <ul className="space-y-2">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`/claims/${c.id}`} className="card flex flex-wrap items-center justify-between gap-2 hover:bg-gray-50">
                <span><b>{c.employee_name}</b> · Form {c.form} · {c.employer_name}<br />
                  <span className="text-gray-700">{c.status}{c.submitted_at && ` · submitted ${fmtDate(c.submitted_at)}`}</span></span>
                <RiskBadge pct={c.risk_pct} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
