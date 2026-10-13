"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ErrorBox, Loading } from "@/lib/ui";

type Preview = { headers: string[]; rows: string[][]; suggested: Record<string, string>; fields: string[] };
type Result = { inserted: number; skipped: number; aadhaar_dropped: number };

export default function Import() {
  const [employers, setEmployers] = useState<{ id: string; name: string }[]>([]);
  const [employer, setEmployer] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pv, setPv] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api<{ id: string; name: string }[]>("/v1/employers").then(setEmployers).catch((e) => setError(e.message)); }, []);

  async function send<T>(key: string, path: string, fd: FormData): Promise<T | null> {
    setBusy(key); setError(null);
    try { return await api<T>(path, { method: "POST", body: fd }); }
    catch (e: any) { setError(e.message); return null; }
    finally { setBusy(null); }
  }

  async function preview() {
    if (!file) return;
    const fd = new FormData(); fd.append("file", file);
    setResult(null);
    const r = await send<Preview>("pv", "/v1/import/preview", fd);
    if (r) { setPv(r); setMapping(Object.fromEntries(r.headers.map((h) => [h, r.suggested[h] ?? ""]))); }
  }

  async function doImport() {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file); fd.append("employer_id", employer);
    fd.append("mapping", JSON.stringify(Object.fromEntries(Object.entries(mapping).filter(([, v]) => v))));
    const r = await send<Result>("imp", "/v1/import", fd);
    if (r) setResult(r);
  }

  return (
    <div className="space-y-4">
      <h1>Import employees</h1>
      <p className="rounded-lg border-2 border-blue-700 bg-blue-50 p-3">Full Aadhaar numbers are dropped on import; only the last 4 digits are kept.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="font-semibold">Employer
          <select className="inp mt-1" value={employer} onChange={(e) => setEmployer(e.target.value)}>
            <option value="">Choose employer…</option>
            {employers.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </label>
        <label className="font-semibold">Excel or CSV file
          <input type="file" accept=".xlsx,.csv" className="inp mt-1" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPv(null); setResult(null); }} />
        </label>
      </div>
      <button className="btn" disabled={!file || !!busy} onClick={preview}>Preview</button>
      {busy === "pv" && <Loading text="Reading file…" />}
      <ErrorBox error={error} />

      {pv && (
        <>
          <h2>Match columns</h2>
          <table className="w-full border-collapse">
            <thead><tr className="border-b-2 border-gray-800 text-left"><th className="py-2">Column in your file</th><th>PF Desk field</th></tr></thead>
            <tbody>
              {pv.headers.map((h) => (
                <tr key={h} className="border-b border-gray-300">
                  <td className="py-2 pr-3 font-semibold">{h}</td>
                  <td>
                    <select className="inp" value={mapping[h] ?? ""} onChange={(e) => setMapping({ ...mapping, [h]: e.target.value })}>
                      <option value="">— skip —</option>
                      {pv.fields.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>First 5 rows</h2>
          <div className="overflow-x-auto">
            <table className="border-collapse text-base">
              <thead><tr>{pv.headers.map((h) => <th key={h} className="border border-gray-400 bg-gray-100 px-2 py-1 text-left">{mapping[h] || <s>{h}</s>}</th>)}</tr></thead>
              <tbody>
                {pv.rows.slice(0, 5).map((r, i) => (
                  <tr key={i}>{pv.headers.map((h, j) => <td key={h} className={`border border-gray-400 px-2 py-1 ${mapping[h] ? "" : "text-gray-400"}`}>{r[j]}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>

          <button className="btn" disabled={!employer || !!busy} onClick={doImport}>{employer ? "Import" : "Choose an employer first"}</button>
          {busy === "imp" && <Loading text="Importing…" />}
        </>
      )}

      {result && (
        <div className="card border-green-700 bg-green-50 text-lg">
          <p><b>{result.inserted}</b> employees imported · <b>{result.skipped}</b> rows skipped · <b>{result.aadhaar_dropped}</b> full Aadhaar numbers dropped</p>
        </div>
      )}
    </div>
  );
}
