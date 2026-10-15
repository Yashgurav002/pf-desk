"use client";
import { useEffect, useState } from "react";
import { api, post, fmtDate } from "@/lib/api";
import { ErrorBox, Loading, CopyButton } from "@/lib/ui";
import { useT, type Key } from "@/lib/i18n";

type Flag = { code: string; message: string };
type VRow = { key: string; emp_code: string; uan_masked: string; name: string; days?: number | null; epf_wages?: number; employee?: number; eps?: number; employer_epf?: number; edli?: number; flags: Flag[] };
type Validation = { rows: VRow[]; missing: VRow[]; totals: Record<string, number>; flag_count: number; summary: string };
type Emp = { id: string; name: string; due_date: string; state: string; upload_status: string | null; uploaded_at: string | null; validation: Validation | null; workflow: string | null };
type Task = { id: string; kind: string; ref_id: string; title: string; body: string | null; due_at: string | null };
type Data = { wage_month: string; employers: Emp[]; tasks: Task[] };

const STATE: Record<string, { key: Key; cls: string }> = {
  waiting_sheet: { key: "stWaiting", cls: "bg-gray-200 text-gray-900" },
  validating: { key: "stValidating", cls: "bg-amber-400 text-black" },
  awaiting_payment: { key: "stAwaiting", cls: "bg-blue-700 text-white" },
  paid: { key: "stPaid", cls: "bg-green-700 text-white" },
};
const rs = (n: number | undefined) => (n == null ? "—" : `₹${n.toLocaleString("en-IN")}`);

export default function Cycle() {
  const { t } = useT();
  const [month, setMonth] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = (m = month) => api<Data>(`/v1/cycles${m ? `?wage_month=${m}` : ""}`).then((d) => { setData(d); setMonth(d.wage_month.slice(0, 7)); }).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key); setError(null);
    try { await fn(); await load(); } catch (e: any) { setError(e.message); } finally { setBusy(null); }
  }
  const upload = (id: string, file: File) => run(`up-${id}`, async () => {
    const fd = new FormData(); fd.append("file", file); fd.append("wage_month", month);
    await api(`/v1/employers/${id}/salary`, { method: "POST", body: fd });
    setOpen(id);
  });

  if (!data) return <><Loading text={t("loading")} /><ErrorBox error={error} /></>;
  return (
    <div className="space-y-4">
      <h1>{t("cycle")}</h1>
      <label className="block font-semibold">{t("wageMonth")}
        <input type="month" className="inp mt-1 max-w-xs" value={month} onChange={(e) => { setMonth(e.target.value); load(e.target.value); }} />
      </label>
      <ErrorBox error={error} />

      <h2>{t("openTasks")}</h2>
      {data.tasks.length === 0 ? <p className="text-gray-700">{t("noTasks")}</p> : (
        <ul className="space-y-2">
          {data.tasks.map((k) => (
            <li key={k.id} className={`card ${k.title.startsWith("URGENT") ? "border-red-700" : ""}`}>
              <p className="font-semibold">{k.title}</p>
              {k.due_at && <p className="text-gray-700">{t("due")} {fmtDate(k.due_at)}</p>}
              {k.body && <p className="my-2 whitespace-pre-wrap rounded-lg bg-gray-100 p-2">{k.body}</p>}
              <div className="flex gap-2">
                {k.body && <CopyButton text={k.body} label={t("copy")} />}
                <button className="btn2" disabled={!!busy} onClick={() => run(`t-${k.id}`, () => post(`/v1/tasks/${k.id}/done`, {}))}>{t("done")}</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2>{t("employer")}</h2>
      {data.employers.map((e) => {
        const s = STATE[e.state] ?? STATE.waiting_sheet;
        const v = e.validation;
        return (
          <div key={e.id} className="card space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xl font-bold">{e.name}</span>
              <span className={`rounded-full px-3 py-1 font-bold ${s.cls}`}>{t(s.key)}</span>
              <span className="text-gray-700">{t("due")} {fmtDate(e.due_date)}</span>
              {e.workflow && <span className="text-sm text-gray-600">Temporal: {e.workflow}</span>}
            </div>
            {v && <p>{v.summary} {v.flag_count > 0 && <b className="text-red-800">{t("toReview", { n: v.flag_count })}</b>}</p>}
            <div className="flex flex-wrap gap-2">
              <label className="btn cursor-pointer">
                {busy === `up-${e.id}` ? t("uploading") : t("uploadSheet")}
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={!!busy}
                  onChange={(ev) => { const f = ev.target.files?.[0]; ev.target.value = ""; if (f) upload(e.id, f); }} />
              </label>
              {!e.workflow && <button className="btn2" disabled={!!busy} onClick={() => run(`s-${e.id}`, () => post(`/v1/employers/${e.id}/cycle/start`, { wage_month: month }))}>{t("startCycle")}</button>}
              {e.state === "awaiting_payment" && <button className="btn2" disabled={!!busy} onClick={() => run(`p-${e.id}`, () => post(`/v1/employers/${e.id}/cycle/paid`, { wage_month: month }))}>{t("markPaid")}</button>}
              {v && <button className="btn2" onClick={() => setOpen(open === e.id ? null : e.id)}>{open === e.id ? t("hideTable") : t("showTable")}</button>}
            </div>
            {v && open === e.id && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-base">
                  <thead>
                    <tr className="border-b-2 border-gray-800 text-left">
                      <th className="py-2 pr-2">Employee</th><th className="pr-2">Days</th><th className="pr-2">EPF wages</th><th className="pr-2">Employee 12%</th>
                      <th className="pr-2">EPS</th><th className="pr-2">Employer EPF</th><th className="pr-2">EDLI</th><th>Check</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...v.rows, ...v.missing].map((r) => (
                      <tr key={r.key} className={`border-b border-gray-300 align-top ${r.flags.length ? "bg-red-50" : ""}`}>
                        <td className="py-2 pr-2"><b>{r.name}</b><br /><span className="text-sm text-gray-600">{r.emp_code} {r.uan_masked}</span></td>
                        <td className="pr-2">{r.days ?? "—"}</td><td className="pr-2">{rs(r.epf_wages)}</td><td className="pr-2">{rs(r.employee)}</td>
                        <td className="pr-2">{rs(r.eps)}</td><td className="pr-2">{rs(r.employer_epf)}</td><td className="pr-2">{rs(r.edli)}</td>
                        <td>{r.flags.length ? r.flags.map((f) => <p key={f.code} className="text-red-900">⚠ {f.message}</p>) : "✓"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-800 font-bold">
                      <td className="py-2">{v.totals.employees}</td><td /><td>{rs(v.totals.epf_wages)}</td><td>{rs(v.totals.employee)}</td>
                      <td>{rs(v.totals.eps)}</td><td>{rs(v.totals.employer_epf)}</td><td>{rs(v.totals.edli)}</td>
                      <td>Admin {rs(v.totals.admin)} · {t("totalPayable")} {rs(v.totals.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
