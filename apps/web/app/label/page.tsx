"use client";
import { useEffect, useState } from "react";
import { api, post, fmtDate, type Rule } from "@/lib/api";
import { ErrorBox, Loading } from "@/lib/ui";

type Vocab = { categories: Record<string, { fields: string[]; fix: string[] }>; fields: string[] };
type Row = { id: string; text: string; category: string; fields_involved: string[]; fix_step_ids: string[]; source: string; labelled_by: string | null; created_at: string };
type Data = { labels: Row[]; counts: Record<string, number>; total: number };

const CAT_LABEL: Record<string, string> = {
  name_mismatch: "Name mismatch", father_name_mismatch: "Father's name mismatch", dob_mismatch: "Date of birth mismatch",
  bank_details_invalid: "Bank account / IFSC wrong", bank_not_verified: "Bank not verified", cheque_image_unclear: "Cheque / passbook image unclear",
  kyc_not_approved: "KYC not approved by employer", aadhaar_not_linked: "Aadhaar not linked", exit_date_missing: "Date of exit missing",
  service_ineligible: "Not enough service", waiting_period: "Waiting period not over", purpose_ineligible: "Purpose not allowed (advance)",
  duplicate_claim: "Duplicate claim", signature_or_photo: "Signature or photo problem", other: "Other",
};
const FIELD_LABEL: Record<string, string> = {
  name: "Name", father_name: "Father's name", dob: "Date of birth", bank_account: "Bank account", ifsc: "IFSC", cheque_image: "Cheque image",
  kyc: "KYC", aadhaar: "Aadhaar", date_of_exit: "Date of exit", service_period: "Service period", purpose: "Purpose", claim: "Claim",
  signature: "Signature", photo: "Photo",
};
const nice = (k: string, m: Record<string, string>) => m[k] ?? k.replace(/_/g, " ");
const NAME_KEY = "pfd.labelledBy";
const toggle = (xs: string[], x: string) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

export default function Label() {
  const [vocab, setVocab] = useState<Vocab | null>(null);
  const [rules, setRules] = useState<Record<string, string>>({});
  const [queue, setQueue] = useState<{ text: string; claim_count: number }[] | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [text, setText] = useState("");
  const [cat, setCat] = useState("");
  const [fields, setFields] = useState<string[]>([]);
  const [fix, setFix] = useState<string[]>([]);
  const [by, setBy] = useState("");

  const cats = vocab ? Object.keys(vocab.categories) : [];
  const fixIds = vocab ? [...new Set(Object.values(vocab.categories).flatMap((c) => c.fix))] : [];

  const load = () => Promise.all([
    api<{ text: string; claim_count: number }[]>("/v1/labels/queue").then(setQueue),
    api<Data>("/v1/labels").then(setData),
  ]).catch((e) => setError(e.message));

  useEffect(() => {
    try { setBy(localStorage.getItem(NAME_KEY) ?? ""); } catch {}
    api<Vocab>("/v1/labels/vocab").then(setVocab).catch((e) => setError(e.message));
    api<Rule[]>("/v1/rules").then((rs) => setRules(Object.fromEntries(rs.map((r) => [r.id, r.title])))).catch(() => {});
    load();
  }, []);

  const pick = (c: string) => {
    if (!vocab) return;
    setCat(c); setFields(vocab.categories[c].fields); setFix(vocab.categories[c].fix);
  };
  const select = (t: string) => { setText(t); setCat(""); setFields([]); setFix([]); setMsg(null); };

  // Number keys 1–9 pick a category when focus isn't in a text field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest?.("input[type=text], input:not([type]), textarea, select, [contenteditable]") || e.ctrlKey || e.metaKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 9 && cats[n - 1]) { e.preventDefault(); pick(cats[n - 1]); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !cat) return setError("Pick a remark and a reason first.");
    setBusy(true); setError(null);
    try { localStorage.setItem(NAME_KEY, by.trim()); } catch {}
    try {
      await post("/v1/labels", { text, category: cat, fields_involved: fields, fix_step_ids: fix, labelled_by: by.trim() || undefined });
      select(queue?.find((q) => q.text !== text)?.text ?? "");
      setMsg("Saved ✓");
      await load();
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  }

  async function del(id: string) {
    if (!confirm("Delete this label?")) return;
    try { await api(`/v1/labels/${id}`, { method: "DELETE" }); await load(); } catch (err: any) { setError(err.message); }
  }

  async function importFile(f: File | undefined) {
    if (!f) return;
    setError(null);
    try {
      const r = await api<{ imported: number; skipped: number }>("/v1/labels/import", { method: "POST", body: await f.text(), headers: { "content-type": "application/x-ndjson" } });
      setMsg(`Imported ${r.imported}, skipped ${r.skipped}.`);
      await load();
    } catch (err: any) { setError(err.message); }
  }

  if (!vocab) return error ? <ErrorBox error={error} /> : <Loading />;

  return (
    <div className="space-y-6 text-lg">
      <h1>Label rejection remarks</h1>
      <p className="rounded-lg border-2 border-amber-500 bg-amber-50 p-3 font-semibold">
        Don&apos;t include names, UAN, Aadhaar or bank numbers — remarks only.
      </p>
      <ErrorBox error={error} />
      {msg && <p className="font-semibold text-green-800">{msg}</p>}

      <section className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <h2 className="mt-0">Remarks waiting for a label</h2>
          {!queue ? <Loading /> : queue.length === 0 ? <p className="text-gray-700">None waiting. Type one below.</p> : (
            <ul className="max-h-96 space-y-2 overflow-y-auto">
              {queue.map((q) => (
                <li key={q.text}>
                  <button className={`card w-full text-left ${q.text === text ? "border-blue-700 bg-blue-50" : "hover:bg-gray-50"}`} onClick={() => select(q.text)}>
                    {q.text} <span className="text-base text-gray-600">· {q.claim_count} claim{q.claim_count === 1 ? "" : "s"}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label className="block font-semibold">Or type / paste a remark from the portal
            <textarea className="inp mt-1 h-28" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. FATHER NAME NOT MATCHING WITH UAN" />
          </label>
        </div>

        <form onSubmit={save} className="card space-y-4 bg-gray-50">
          <h2 className="mt-0">What is the reason?</h2>
          {!text.trim() ? <p className="text-gray-700">Pick a remark (or type one) first.</p> : <p className="break-words rounded bg-white p-2 font-mono">{text}</p>}
          <fieldset className="grid gap-2">
            <legend className="sr-only">Reason</legend>
            {cats.map((c, i) => (
              <label key={c} className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 ${cat === c ? "border-blue-700 bg-blue-50" : "border-gray-300 bg-white"}`}>
                <input type="radio" name="cat" className="h-6 w-6" checked={cat === c} onChange={() => pick(c)} />
                <span className="font-semibold">{i < 9 && <kbd className="mr-2 rounded bg-gray-200 px-2">{i + 1}</kbd>}{nice(c, CAT_LABEL)}</span>
              </label>
            ))}
          </fieldset>
          {cat && (
            <>
              <fieldset>
                <legend className="font-bold">Fields involved</legend>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {vocab.fields.map((f) => (
                    <label key={f} className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={fields.includes(f)} onChange={() => setFields(toggle(fields, f))} />{nice(f, FIELD_LABEL)}</label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="font-bold">Fix steps (Rule Book)</legend>
                {fixIds.map((id) => (
                  <label key={id} className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={fix.includes(id)} onChange={() => setFix(toggle(fix, id))} />
                    <code className="rounded bg-gray-200 px-1 text-base">{id}</code> {rules[id] ?? ""}
                  </label>
                ))}
              </fieldset>
            </>
          )}
          <label className="block font-semibold">Labelled by<input className="inp mt-1" value={by} onChange={(e) => setBy(e.target.value)} placeholder="Your name" /></label>
          <button className="btn w-full text-xl" disabled={busy || !cat || !text.trim()}>{busy ? "Saving…" : "Save → next"}</button>
        </form>
      </section>

      <section className="space-y-3">
        {!data ? <Loading /> : (
          <>
            <h2>{data.total} labelled — aim for 150+</h2>
            <div className="h-4 w-full overflow-hidden rounded-full bg-gray-200"><div className="h-full bg-green-700" style={{ width: `${Math.min(100, (data.total / 150) * 100)}%` }} /></div>
            <ul className="flex flex-wrap gap-2">
              {cats.map((c) => <li key={c} className="rounded-full border-2 border-gray-300 px-3 py-1">{nice(c, CAT_LABEL)}: <b>{data.counts[c] ?? 0}</b></li>)}
            </ul>
            <div className="flex flex-wrap gap-2">
              <a className="btn2" href="/api/v1/labels/export" download="remark_labels.jsonl">Export JSONL</a>
              <label className="btn2 cursor-pointer">Import JSONL
                <input type="file" accept=".jsonl,.ndjson,.txt,application/x-ndjson" className="sr-only" onChange={(e) => { importFile(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
            </div>
            <ul className="space-y-2">
              {data.labels.map((l) => (
                <li key={l.id} className="card flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-mono">{l.text}</p>
                    <p className="text-base text-gray-700">
                      <b>{nice(l.category, CAT_LABEL)}</b>{l.fix_step_ids.length > 0 && ` · ${l.fix_step_ids.join(", ")}`}
                      {` · ${l.labelled_by ?? l.source} · ${fmtDate(l.created_at)}`}
                    </p>
                  </div>
                  <button className="btn2" onClick={() => del(l.id)}>Delete</button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
