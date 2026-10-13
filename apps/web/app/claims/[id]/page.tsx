"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, post, fmtDate, NEXT_STATUS, type Precheck } from "@/lib/api";
import { CopyButton, ErrorBox, Loading, RiskBadge } from "@/lib/ui";

type Detail = {
  claim: {
    id: string; form: string; purpose: string | null; status: string; submitted_at: string | null; settled_at: string | null;
    rejected_at: string | null; rejection_remark: string | null; decoded: unknown; risk_pct: number | null; risk_model: string | null;
    eta_days: number | null; eta_low: number | null; eta_high: number | null; eta_model: string | null;
  };
  employee: Record<string, string | boolean | null>;
  precheck: Precheck | null;
};
type Decoded = {
  category: string; fields_involved: string[]; fix_steps: { id: string; title: string }[];
  employee_message_hi: string; employee_message_mr: string; employee_message_en: string; confidence: number; model: string;
};

const FACTS: [string, string][] = [
  ["employer_name", "Employer"], ["uan_masked", "UAN"], ["name_uan", "Name (UAN)"], ["name_bank", "Name (bank)"],
  ["name_aadhaar", "Name (Aadhaar)"], ["father_name_uan", "Father's name (UAN)"], ["father_name_bank", "Father's name (bank)"],
  ["dob_uan", "Date of birth (UAN)"], ["dob_aadhaar", "Date of birth (Aadhaar)"], ["aadhaar_last4", "Aadhaar (last 4)"],
  ["aadhaar_linked", "Aadhaar linked to UAN"], ["bank_ifsc", "IFSC"], ["account_masked", "Bank account"],
  ["bank_verified", "Bank verified"], ["kyc_approved_by_employer", "KYC approved by employer"], ["phone_masked", "Phone"],
  ["date_of_joining", "Date of joining"], ["date_of_exit", "Date of exit"], ["preferred_language", "Language"],
];
const show = (v: unknown) => (v === true ? "Yes" : v === false ? "No ⚠️" : v == null || v === "" ? "—" : String(v));
const LANGS = [["hi", "Hindi"], ["mr", "Marathi"], ["en", "English"]] as const;

export default function ClaimDetail() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pc, setPc] = useState<Precheck | null>(null);
  const [lang, setLang] = useState("hi");
  const [msg, setMsg] = useState<{ text: string; model: string } | null>(null);
  const [remark, setRemark] = useState("");
  const [dec, setDec] = useState<Decoded | null>(null);
  const [link, setLink] = useState<{ url: string; expires_at: string } | null>(null);

  const load = () => api<Detail>(`/v1/claims/${id}`).then((r) => {
    setD(r); setPc((p) => p ?? r.precheck);
    setRemark((x) => x || r.claim.rejection_remark || "");
  }).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [id]);
  const pref = d?.employee.preferred_language;
  useEffect(() => { if (pref === "hi" || pref === "mr" || pref === "en") setLang(pref); }, [pref]);

  async function run<T>(key: string, fn: () => Promise<T>, then: (r: T) => void) {
    setBusy(key); setError(null);
    try { then(await fn()); } catch (e: any) { setError(e.message); } finally { setBusy(null); }
  }

  function changeStatus(status: string) {
    let rejection_remark: string | undefined;
    if (status === "rejected") {
      const r = prompt("Paste the EPFO rejection remark:");
      if (!r) return;
      rejection_remark = r;
      setRemark(r);
    }
    run("status", () => api(`/v1/claims/${id}`, { method: "PATCH", body: JSON.stringify({ status, rejection_remark }) }), () => load());
  }

  if (!d) return <><ErrorBox error={error} />{!error && <Loading />}</>;
  const { claim, employee } = d;

  return (
    <div className="space-y-6">
      <div>
        <h1>{show(employee.name_uan)} · Form {claim.form}</h1>
        <p className="text-lg">Status: <b className="rounded bg-gray-200 px-2">{claim.status}</b>
          {claim.submitted_at && <> · submitted {fmtDate(claim.submitted_at)}</>}
          {claim.purpose && <> · purpose: {claim.purpose}</>}</p>
        {claim.rejection_remark && <p className="mt-1">EPFO remark: <i>“{claim.rejection_remark}”</i></p>}
      </div>
      <ErrorBox error={error} />

      <section className="card">
        <h2 className="mt-0">Change status</h2>
        <div className="flex flex-wrap gap-2">
          {(NEXT_STATUS[claim.status] ?? []).map((s) => (
            <button key={s} className={s === "rejected" ? "btn2 border-red-700 text-red-800" : "btn2"} disabled={!!busy} onClick={() => changeStatus(s)}>
              Mark {s.replace("_", " ")}
            </button>
          ))}
          {busy === "status" && <Loading text="Saving…" />}
        </div>
      </section>

      <section className="card">
        <h2 className="mt-0">Pre-check</h2>
        <button className="btn" disabled={!!busy} onClick={() => run("pc", () => post<Precheck>(`/v1/claims/${id}/precheck`, {}), (r) => { setPc(r); load(); })}>
          Run Pre-check
        </button>
        {busy === "pc" && <Loading text="Checking records and predicting risk… (can take up to a minute)" />}
        {pc && busy !== "pc" && (
          <div className="mt-4 space-y-3">
            <p className="text-xl">Rejection risk: <RiskBadge pct={pc.risk_pct} band={pc.risk_band} /> <span className="text-sm text-gray-600">model: {pc.risk_model}</span></p>
            {pc.eta && (
              <p className="text-xl">Likely by <b>{pc.eta.likely_date}</b> (range {pc.eta.range[0]}–{pc.eta.range[1]}) <span className="text-sm text-gray-600">· about {pc.eta.days} days · model: {pc.eta.model}</span></p>
            )}
            {pc.issues.length === 0 ? <p className="text-lg font-semibold text-green-800">No problems found. ✓</p> : (
              <>
                <p className="text-lg font-semibold">{pc.issues.length} problem{pc.issues.length > 1 ? "s" : ""}:</p>
                <ol className="list-decimal space-y-2 pl-6">
                  {pc.issues.map((i, n) => (
                    <li key={n}>
                      <span className={`mr-2 rounded px-2 text-sm font-bold ${i.severity === "blocker" ? "bg-red-700 text-white" : "bg-amber-400"}`}>{i.severity === "blocker" ? "Must fix" : "Check"}</span>
                      {i.message} <b>Fix:</b> {i.fix} <span className="text-gray-600">[rule {i.rule_id}]</span>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="mt-0">WhatsApp message to employee</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select className="inp max-w-40" value={lang} onChange={(e) => setLang(e.target.value)}>
            {LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button className="btn" disabled={!!busy} onClick={() => run("msg", () => post<{ text: string; model: string }>(`/v1/claims/${id}/message`, { lang }), setMsg)}>Draft WhatsApp message</button>
        </div>
        {busy === "msg" && <Loading text="Writing the message…" />}
        {msg && (
          <div className="mt-3 space-y-2">
            <textarea className="inp h-40" value={msg.text} onChange={(e) => setMsg({ ...msg, text: e.target.value })} />
            <div className="flex items-center gap-3"><CopyButton text={msg.text} label="Copy WhatsApp message" /><span className="text-sm text-gray-600">model: {msg.model}</span></div>
          </div>
        )}
      </section>

      <section className="card" id="decoder">
        <h2 className="mt-0">Rejection Decoder</h2>
        <textarea className="inp h-24" placeholder="Paste the rejection remark from the EPFO portal" value={remark} onChange={(e) => setRemark(e.target.value)} />
        <button className="btn mt-2" disabled={!!busy || !remark.trim()} onClick={() => run("dec", () => post<Decoded>(`/v1/claims/${id}/decode`, { remark }), setDec)}>Decode</button>
        {busy === "dec" && <Loading text="Reading the remark…" />}
        {dec && (
          <div className="mt-3 space-y-2">
            <p><b>Category:</b> {dec.category} <span className="text-sm text-gray-600">· confidence {Math.round(dec.confidence * 100)}% · model: {dec.model}</span></p>
            <p><b>Fields involved:</b> {dec.fields_involved.join(", ") || "—"}</p>
            <div><b>Fix steps:</b>
              <ol className="list-decimal pl-6">{dec.fix_steps.map((s) => <li key={s.id}>{s.title} <span className="text-gray-600">[rule {s.id}]</span></li>)}</ol>
            </div>
            {([["Hindi", dec.employee_message_hi], ["Marathi", dec.employee_message_mr], ["English", dec.employee_message_en]] as const).map(([l, t]) => (
              <div key={l} className="rounded-lg bg-gray-100 p-3">
                <p className="font-semibold">{l}</p><p className="my-1 whitespace-pre-wrap">{t}</p><CopyButton text={t} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="mt-0">Help link for employee</h2>
        <p className="mb-2">A private page where the employee can ask about this claim in Hindi, Marathi or English.</p>
        <button className="btn" disabled={!!busy} onClick={() => run("link", () => post<{ url: string; expires_at: string }>(`/v1/help-links`, { employee_id: employee.id }), (r) => setLink({ ...r, url: r.url.startsWith("http") ? r.url : location.origin + r.url }))}>Create help link</button>
        {busy === "link" && <Loading text="Creating link…" />}
        {link && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="break-all rounded bg-gray-100 p-2">{link.url}</code><CopyButton text={link.url} />
            <span className="text-sm text-gray-600">expires {fmtDate(link.expires_at)}</span>
          </div>
        )}
      </section>

      <section>
        <h2>Employee facts</h2>
        <table className="w-full border-collapse">
          <tbody>
            {FACTS.map(([k, label]) => (
              <tr key={k} className="border-b border-gray-300"><th className="py-2 pr-4 text-left font-semibold">{label}</th><td className="py-2">{show(employee[k])}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
