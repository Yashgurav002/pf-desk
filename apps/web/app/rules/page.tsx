"use client";
import { useEffect, useState } from "react";
import { api, fmtDate, type Rule } from "@/lib/api";
import { ErrorBox, Loading } from "@/lib/ui";
import { useT } from "@/lib/i18n";

function RuleForm({ rule, onSaved, onCancel }: { rule: Rule | null; onSaved: () => void; onCancel: () => void }) {
  const { t } = useT();
  const [f, setF] = useState({
    id: rule?.id ?? "", title: rule?.title ?? "", body: rule?.body ?? "", source: rule?.source ?? "",
    applies_to: rule?.applies_to.join(", ") ?? "", params: rule?.params ? JSON.stringify(rule.params, null, 2) : "", verified_by: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    let params: object | null = null;
    try { params = f.params.trim() ? JSON.parse(f.params) : null; } catch { return setError("Params is not valid JSON."); }
    const body: Partial<Rule> = {
      title: f.title, body: f.body, source: f.source, params,
      applies_to: f.applies_to.split(",").map((s) => s.trim()).filter(Boolean),
      ...(f.verified_by.trim() && { last_verified_by: f.verified_by.trim(), last_verified_at: new Date().toISOString() }),
    };
    setBusy(true); setError(null);
    try {
      if (rule) await api(`/v1/rules/${encodeURIComponent(rule.id)}`, { method: "PATCH", body: JSON.stringify(body) });
      else await api("/v1/rules", { method: "POST", body: JSON.stringify({ ...body, id: f.id.trim() }) });
      onSaved();
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={save} className="card space-y-3 bg-gray-50">
      <h2 className="mt-0">{rule ? t("editRule", { id: rule.id }) : t("newRule")}</h2>
      {!rule && <label className="block font-semibold">{t("ruleId")}<input className="inp mt-1" required value={f.id} onChange={set("id")} /></label>}
      <label className="block font-semibold">{t("title")}<input className="inp mt-1" required value={f.title} onChange={set("title")} /></label>
      <label className="block font-semibold">{t("ruleText")}<textarea className="inp mt-1 h-32" required value={f.body} onChange={set("body")} /></label>
      <label className="block font-semibold">{t("sourceLong")}<input className="inp mt-1" value={f.source} onChange={set("source")} /></label>
      <label className="block font-semibold">{t("appliesLong")}<input className="inp mt-1" value={f.applies_to} onChange={set("applies_to")} /></label>
      <label className="block font-semibold">{t("params")}<textarea className="inp mt-1 h-24 font-mono text-base" value={f.params} onChange={set("params")} /></label>
      <label className="block font-semibold">{t("verifiedByInput")}<input className="inp mt-1" value={f.verified_by} onChange={set("verified_by")} /></label>
      <ErrorBox error={error} />
      <div className="flex gap-2">
        <button className="btn" disabled={busy}>{busy ? t("saving") : t("save")}</button>
        <button type="button" className="btn2" onClick={onCancel}>{t("cancel")}</button>
      </div>
    </form>
  );
}

export default function Rules() {
  const { t } = useT();
  const [q, setQ] = useState("");
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Rule | "new" | null>(null);

  const load = (query = q) => {
    setRules(null); setError(null);
    api<Rule[]>(query.trim() ? `/v1/rules/search?q=${encodeURIComponent(query)}` : "/v1/rules").then(setRules).catch((e) => setError(e.message));
  };
  useEffect(() => { load(""); }, []);

  return (
    <div className="space-y-4">
      <h1>{t("rules")}</h1>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); load(); }}>
        <input className="inp" placeholder={t("rulesSearch")} value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn">{t("search")}</button>
      </form>
      <button className="btn2" onClick={() => setEditing("new")}>+ {t("newRule")}</button>
      {editing === "new" && <RuleForm rule={null} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      <ErrorBox error={error} />
      {!rules ? !error && <Loading /> : rules.length === 0 ? <p>{t("noRules")}</p> : (
        <ul className="space-y-3">
          {rules.map((r) => editing !== "new" && editing?.id === r.id ? (
            <li key={r.id}><RuleForm rule={r} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} /></li>
          ) : (
            <li key={r.id} className="card">
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded bg-gray-200 px-2 font-bold">{r.id}</code>
                <b className="text-lg">{r.title}</b>
                {r.last_verified_by
                  ? <span className="text-sm text-green-800">✓ {t("verifiedBy", { who: r.last_verified_by })} {r.last_verified_at && t("onDate", { d: fmtDate(r.last_verified_at) })}</span>
                  : <span className="rounded bg-amber-400 px-2 text-sm font-bold">{t("unverified")}</span>}
                {r.score != null && <span className="text-sm text-gray-600">{t("match")} {r.score.toFixed(2)}</span>}
              </div>
              <p className="my-2 whitespace-pre-wrap">{r.body}</p>
              <p className="text-gray-700">{t("source")}: {r.source || "—"}{r.applies_to.length > 0 && ` · ${t("appliesTo")}: ${r.applies_to.join(", ")}`}</p>
              <button className="btn2 mt-2" onClick={() => setEditing(r)}>{t("edit")}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
