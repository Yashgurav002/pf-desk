"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, post, fmtDate, FORMS } from "@/lib/api";
import { ErrorBox, Loading } from "@/lib/ui";

type Emp = {
  id: string; employer_id: string; employer_name: string; name_uan: string; uan_masked: string;
  preferred_language: string; date_of_exit: string | null; claim_count: number;
};
type Employer = { id: string; name: string };

export default function Employees() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [employer, setEmployer] = useState("");
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [rows, setRows] = useState<Emp[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api<Employer[]>("/v1/employers").then(setEmployers).catch(() => {}); }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      api<Emp[]>(`/v1/employees?${new URLSearchParams({ q, employer_id: employer })}`).then(setRows).catch((e) => setError(e.message));
    }, 250);
    return () => clearTimeout(t);
  }, [q, employer]);

  async function newClaim(employee_id: string, form: string) {
    setBusy(true); setError(null);
    try {
      const c = await post<{ id: string }>("/v1/claims", { employee_id, form });
      router.push(`/claims/${c.id}`);
    } catch (e: any) { setError(e.message); setBusy(false); }
  }

  return (
    <div>
      <h1>Employees</h1>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <input className="inp" placeholder="Search by name or UAN" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="inp" value={employer} onChange={(e) => setEmployer(e.target.value)}>
          <option value="">All employers</option>
          {employers.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>
      <ErrorBox error={error} />
      {!rows ? !error && <Loading /> : rows.length === 0 ? <p>No employees found.</p> : (
        <ul className="space-y-2">
          {rows.map((e) => (
            <li key={e.id} className="card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span><b>{e.name_uan}</b> · UAN {e.uan_masked}<br />
                  <span className="text-gray-700">{e.employer_name}{e.date_of_exit && ` · left ${fmtDate(e.date_of_exit)}`} · {e.claim_count} claim(s)</span></span>
                <button className="btn" onClick={() => setPicking(picking === e.id ? null : e.id)}>New claim</button>
              </div>
              {picking === e.id && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="font-semibold">Choose form:</span>
                  {FORMS.map((f) => <button key={f} className="btn2" disabled={busy} onClick={() => newClaim(e.id, f)}>Form {f}</button>)}
                  {busy && <Loading text="Creating claim…" />}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
