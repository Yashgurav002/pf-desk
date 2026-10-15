"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, post, fmtDate, NEXT_STATUS, type Precheck } from "@/lib/api";
import { CopyButton, ErrorBox, Loading, RiskBadge } from "@/lib/ui";
import { useT, type Key } from "@/lib/i18n";

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
  employee_message_hi: string; employee_message_mr: string; employee_message_en: string; model: string;
};

// Employee fields shown in the facts table; labels are i18n keys "f_<field>".
const FACTS = [
  "employer_name", "uan_masked", "name_uan", "name_bank", "name_aadhaar", "father_name_uan", "father_name_bank", "dob_uan", "dob_aadhaar",
  "aadhaar_last4", "aadhaar_linked", "bank_ifsc", "account_masked", "bank_verified", "kyc_approved_by_employer", "phone_masked",
  "date_of_joining", "date_of_exit", "preferred_language",
] as const;
const show = (v: unknown, yes = "Yes", no = "No") => (v === true ? yes : v === false ? `${no} ⚠️` : v == null || v === "" ? "—" : String(v));
const LANGS = [["hi", "langHi"], ["mr", "langMr"], ["en", "langEn"]] as const;

export default function ClaimDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useT();
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pc, setPc] = useState<Precheck | null>(null);
  const [lang, setLang] = useState("hi");
  const [msg, setMsg] = useState<{ text: string; model: string } | null>(null);
  const [why, setWhy] = useState<{ text: string; model: string } | null>(null);
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
      const r = prompt(t("pasteRemarkPrompt"));
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
        <p className="text-lg">{t("status")}: <b className="rounded bg-gray-200 px-2">{claim.status}</b>
          {claim.submitted_at && <> · {t("submittedOn", { d: fmtDate(claim.submitted_at) })}</>}
          {claim.purpose && <> · {t("purpose")}: {claim.purpose}</>}</p>
        {claim.rejection_remark && <p className="mt-1">{t("epfoRemark")} <i>“{claim.rejection_remark}”</i></p>}
      </div>
      <ErrorBox error={error} />

      <section className="card">
        <h2 className="mt-0">{t("changeStatus")}</h2>
        <div className="flex flex-wrap gap-2">
          {(NEXT_STATUS[claim.status] ?? []).map((s) => (
            <button key={s} className={s === "rejected" ? "btn2 border-red-700 text-red-800" : "btn2"} disabled={!!busy} onClick={() => changeStatus(s)}>
              {t("markAs", { s: s.replace("_", " ") })}
            </button>
          ))}
          {busy === "status" && <Loading text={t("saving")} />}
        </div>
      </section>

      <section className="card">
        <h2 className="mt-0">{t("precheck")}</h2>
        <button className="btn" disabled={!!busy} onClick={() => run("pc", () => post<Precheck>(`/v1/claims/${id}/precheck`, {}), (r) => { setPc(r); setWhy(null); load(); })}>
          {t("runPrecheck")}
        </button>
        {busy === "pc" && <Loading text={t("checkingRisk")} />}
        {pc && busy !== "pc" && (
          <div className="mt-4 space-y-3">
            <p className="text-xl">{t("rejectionRisk")} <RiskBadge pct={pc.risk_pct} band={pc.risk_band} /> <span className="text-sm text-gray-600">model: {pc.risk_model}</span></p>
            {pc.eta && (
              <p className="text-xl">{t("likely")}: <b>{pc.eta.likely_date}</b> ({t("range")} {pc.eta.range[0]}–{pc.eta.range[1]}) <span className="text-sm text-gray-600">· {t("aboutDays", { n: Math.round(pc.eta.days) })} · model: {pc.eta.model}</span></p>
            )}
            {pc.issues.length === 0 ? <p className="text-lg font-semibold text-green-800">{t("noProblems")}</p> : (
              <>
                <p className="text-lg font-semibold">{t("problems", { n: pc.issues.length })}:</p>
                <ol className="list-decimal space-y-2 pl-6">
                  {pc.issues.map((i, n) => (
                    <li key={n}>
                      <span className={`mr-2 rounded px-2 text-sm font-bold ${i.severity === "blocker" ? "bg-red-700 text-white" : "bg-amber-400"}`}>{i.severity === "blocker" ? t("mustFix") : t("check")}</span>
                      {i.message} <b>{t("fixColon")}</b> {i.fix} <span className="text-gray-600">[{t("rule")} {i.rule_id}]</span>
                    </li>
                  ))}
                </ol>
              </>
            )}
            <button className="btn2" disabled={!!busy} onClick={() => run("why", () => post<{ text: string; model: string }>(`/v1/claims/${id}/explain`, {}), setWhy)}>{t("explain")}</button>
            {busy === "why" && <Loading text={t("explaining")} />}
            {why && busy !== "why" && <p className="rounded bg-blue-50 p-3 text-lg">{why.text} <span className="block text-sm text-gray-600">model: {why.model} · {t("checkRules")}</span></p>}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="mt-0">{t("waTitle")}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select className="inp max-w-40" value={lang} onChange={(e) => setLang(e.target.value)}>
            {LANGS.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
          </select>
          <button className="btn" disabled={!!busy} onClick={() => run("msg", () => post<{ text: string; model: string }>(`/v1/claims/${id}/message`, { lang }), setMsg)}>{t("draftWa")}</button>
        </div>
        {busy === "msg" && <Loading text={t("writingMsg")} />}
        {msg && (
          <div className="mt-3 space-y-2">
            <textarea className="inp h-40" value={msg.text} onChange={(e) => setMsg({ ...msg, text: e.target.value })} />
            <div className="flex items-center gap-3"><CopyButton text={msg.text} label={t("copyWa")} /><span className="text-sm text-gray-600">model: {msg.model}</span></div>
          </div>
        )}
      </section>

      <section className="card" id="decoder">
        <h2 className="mt-0">{t("decoder")}</h2>
        <textarea className="inp h-24" placeholder={t("pasteRemark")} value={remark} onChange={(e) => setRemark(e.target.value)} />
        <button className="btn mt-2" disabled={!!busy || !remark.trim()} onClick={() => run("dec", () => post<Decoded>(`/v1/claims/${id}/decode`, { remark }), setDec)}>{t("decode")}</button>
        {busy === "dec" && <Loading text={t("readingRemark")} />}
        {dec && (
          <div className="mt-3 space-y-2">
            <p><b>{t("category")}</b> {dec.category} <span className="text-sm text-gray-600">· model: {dec.model}</span></p>
            <p><b>{t("fieldsInvolved")}:</b> {dec.fields_involved.join(", ") || "—"}</p>
            <div><b>{t("fixSteps")}:</b>
              <ol className="list-decimal pl-6">{dec.fix_steps.map((s) => <li key={s.id}>{s.title} <span className="text-gray-600">[{t("rule")} {s.id}]</span></li>)}</ol>
            </div>
            {([[t("langHi"), dec.employee_message_hi], [t("langMr"), dec.employee_message_mr], [t("langEn"), dec.employee_message_en]] as const).map(([l, t]) => (
              <div key={l} className="rounded-lg bg-gray-100 p-3">
                <p className="font-semibold">{l}</p><p className="my-1 whitespace-pre-wrap">{t}</p><CopyButton text={t} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="mt-0">{t("helpLinkTitle")}</h2>
        <p className="mb-2">{t("helpLinkDesc")}</p>
        <button className="btn" disabled={!!busy} onClick={() => run("link", () => post<{ url: string; expires_at: string }>(`/v1/help-links`, { employee_id: employee.id }), (r) => setLink({ ...r, url: r.url.startsWith("http") ? r.url : location.origin + r.url }))}>{t("createLink")}</button>
        {busy === "link" && <Loading text={t("creatingLink")} />}
        {link && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="break-all rounded bg-gray-100 p-2">{link.url}</code><CopyButton text={link.url} />
            <span className="text-sm text-gray-600">{t("expires", { d: fmtDate(link.expires_at) })}</span>
          </div>
        )}
      </section>

      <section>
        <h2>{t("facts")}</h2>
        <table className="w-full border-collapse">
          <tbody>
            {FACTS.map((k) => (
              <tr key={k} className="border-b border-gray-300"><th className="py-2 pr-4 text-left font-semibold">{t(`f_${k}` as Key)}</th><td className="py-2">{show(employee[k], t("yes"), t("no"))}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
