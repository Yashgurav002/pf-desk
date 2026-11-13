"use client";
import { useEffect, useState } from "react";
import { BookOpenText, Check, Pencil, Plus, Search, X } from "lucide-react";
import { api, fmtDate, FORMS, type Rule } from "@/lib/api";
import { Button, Card, Chip, EmptyState, ErrorBox, Field, Input, PageHeader, SkeletonRows, Stamp, Textarea, cx } from "@/lib/ui";
import { useT } from "@/lib/i18n";

type Filter = "all" | "verified" | "unverified";
const IS_ID = /^R-[A-Z0-9-]+$/i;

// source text mixes citations and URLs: make the URLs links
function Source({ text }: { text: string }) {
  return <>{text.split(/(https?:\/\/[^\s;,)]+)/g).map((p, i) => i % 2
    ? <a key={i} href={p} target="_blank" rel="noreferrer" className="text-brand hover:underline">{new URL(p).hostname.replace(/^www\./, "")}</a>
    : p)}</>;
}

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
    try { params = f.params.trim() ? JSON.parse(f.params) : null; } catch { return setError(t("ruBadParams")); }
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
    <form onSubmit={save} className="space-y-4">
      {!rule && <Field label={t("ruleId")}><Input required value={f.id} onChange={set("id")} className="font-mono" /></Field>}
      <Field label={t("title")}><Input required value={f.title} onChange={set("title")} /></Field>
      <Field label={t("ruleText")}><Textarea required rows={8} value={f.body} onChange={set("body")} /></Field>
      <Field label={t("sourceLong")}><Textarea rows={3} value={f.source} onChange={set("source")} className="min-h-0 text-sm" /></Field>
      <Field label={t("appliesLong")}><Input value={f.applies_to} onChange={set("applies_to")} className="font-mono" /></Field>
      <Field label={t("params")}><Textarea rows={3} value={f.params} onChange={set("params")} className="min-h-0 font-mono text-sm" /></Field>
      <div className="rounded-md border border-ok/30 bg-ok-tint/50 p-3">
        <Field label={t("verifiedByInput")} hint={t("ruVerifyHint")}><Input value={f.verified_by} onChange={set("verified_by")} placeholder={t("yourName")} /></Field>
      </div>
      <ErrorBox error={error} />
      <div className="flex gap-2">
        <Button type="submit" busy={busy}>{busy ? t("saving") : t("save")}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>{t("cancel")}</Button>
      </div>
    </form>
  );
}

export default function Rules() {
  const { t } = useT();
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(""); // query the results are for
  const [all, setAll] = useState<Rule[] | null>(null);
  const [hits, setHits] = useState<Rule[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Rule | "new" | null>(null);

  const loadAll = () => api<Rule[]>("/v1/rules").then((r) => { setAll(r); return r; });
  const search = async (query: string) => {
    setError(null); setShown(query.trim());
    if (!query.trim() || IS_ID.test(query.trim())) return setHits(null);
    setSearching(true);
    try { setHits(await api<Rule[]>(`/v1/rules/search?q=${encodeURIComponent(query)}`)); } catch (e: any) { setError(e.message); } finally { setSearching(false); }
  };
  useEffect(() => {
    const q0 = new URLSearchParams(location.search).get("q") ?? "";
    setQ(q0);
    loadAll().catch((e) => setError(e.message));
    if (q0) search(q0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!editing) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setEditing(null);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [editing]);

  const saved = async () => { setEditing(null); await loadAll(); if (shown) search(shown); };
  const base = shown && IS_ID.test(shown) ? (all ?? []).filter((r) => r.id.toLowerCase() === shown.toLowerCase()) : hits ?? all;
  const list = base?.filter((r) => filter === "all" || (filter === "verified") === !!r.last_verified_by);
  const v = all?.filter((r) => r.last_verified_by).length ?? 0;

  return (
    <div>
      <PageHeader kicker={t("kTools")} title={t("rules")} description={t("ruDesc")}
        actions={<Button variant="secondary" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>{t("newRule")}</Button>} />

      <form className="flex gap-2" role="search" onSubmit={(e) => { e.preventDefault(); search(q); }}>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input className="h-11 pl-9" placeholder={t("rulesSearch")} aria-label={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button type="submit" className="h-11">{t("search")}</Button>
      </form>

      <div className="mb-3 mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border border-line-strong bg-sheet p-0.5" role="group">
          {([["all", "ruAll"], ["verified", "ruOnlyVerified"], ["unverified", "ruOnlyUnverified"]] as const).map(([k, l]) => (
            <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}
              className={cx("h-8 rounded-[4px] px-3 text-sm font-semibold", filter === k ? "bg-ink text-white" : "text-ink-2 hover:bg-sunk")}>{t(l)}</button>
          ))}
        </div>
        <p className="text-sm text-ink-3">
          {shown ? <>{t("ruResults", { n: list?.length ?? 0, q: shown })} · <button className="text-brand hover:underline" onClick={() => { setQ(""); search(""); }}>{t("ruClear")}</button></>
            : all && <span className="font-mono">{t("ruCount", { v, u: all.length - v })}</span>}
        </p>
      </div>

      <ErrorBox error={error} />
      {!list || searching ? <Card className="p-5"><SkeletonRows rows={6} /></Card>
        : list.length === 0 ? <EmptyState icon={<BookOpenText className="size-5" />} title={t("noRules")} /> : (
          <Card className="divide-y divide-line">
            {list.map((r) => {
              const open = expanded.has(r.id);
              return (
                <article key={r.id} className="grid gap-x-5 gap-y-2 p-4 sm:grid-cols-[minmax(0,1fr)_11rem] sm:p-5">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-ink-3">{r.id}{r.score != null && <span className="ml-2">· {t("match")} {r.score.toFixed(2)}</span>}</p>
                    <h2 className="mt-0.5 text-[1.05rem] font-semibold leading-snug">{r.title}</h2>
                    <p className={cx("mt-1.5 whitespace-pre-wrap text-[0.95rem] leading-relaxed text-ink-2", !open && "line-clamp-3")}>{r.body}</p>
                    {r.body.length > 240 && (
                      <button className="mt-1 text-sm text-brand hover:underline" aria-expanded={open}
                        onClick={() => setExpanded((s) => { const n = new Set(s); if (open) n.delete(r.id); else n.add(r.id); return n; })}>
                        {t(open ? "ruLess" : "ruMore")}
                      </button>
                    )}
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      {r.applies_to.map((f) => <Chip key={f} className="font-mono text-[0.78rem]">{FORMS.includes(f) ? `Form ${f}` : f}</Chip>)}
                    </div>
                    {r.source && <p className="mt-2 line-clamp-2 break-words text-xs leading-relaxed text-ink-3">{t("source")}: <Source text={r.source} /></p>}
                  </div>
                  <div className="flex items-start justify-between gap-2 sm:flex-col sm:items-end sm:text-right">
                    {r.last_verified_by ? (
                      <div>
                        <Stamp tone="ok"><Check className="size-3" aria-hidden />{t("ruVerified")}</Stamp>
                        <p className="mt-1 text-xs text-ink-3">{t("ruBy", { who: r.last_verified_by, d: fmtDate(r.last_verified_at) })}</p>
                      </div>
                    ) : <Stamp tone="warn">{t("unverified")}</Stamp>}
                    <Button variant="ghost" size="sm" icon={<Pencil className="size-3.5" />} onClick={() => setEditing(r)}>{t("edit")}</Button>
                  </div>
                </article>
              );
            })}
          </Card>
        )}

      {editing && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="rule-drawer-title">
          <button className="absolute inset-0 bg-ink/25" aria-label={t("close")} onClick={() => setEditing(null)} />
          <div className="relative flex h-full w-full max-w-lg flex-col bg-sheet shadow-[var(--shadow-pop)]">
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
              <h2 id="rule-drawer-title" className="text-[1.05rem] font-semibold">
                {editing === "new" ? t("newRule") : <>{t("edit")} <span className="font-mono text-sm font-normal text-ink-3">{editing.id}</span></>}
              </h2>
              <Button variant="ghost" size="sm" aria-label={t("close")} onClick={() => setEditing(null)}><X className="size-4" /></Button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <RuleForm key={editing === "new" ? "new" : editing.id} rule={editing === "new" ? null : editing} onCancel={() => setEditing(null)} onSaved={saved} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
