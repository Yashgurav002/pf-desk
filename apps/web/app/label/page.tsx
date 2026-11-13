"use client";
import { useEffect, useState } from "react";
import { Download, ShieldAlert, Trash2, Upload } from "lucide-react";
import { api, post, fmtDate, type Rule } from "@/lib/api";
import {
  Button, Card, ErrorBox, Field, Input, Notice, PageHeader, SectionTitle, SkeletonRows, Textarea, buttonClass, cx,
} from "@/lib/ui";
import { useT, type Key } from "@/lib/i18n";

type Vocab = { categories: Record<string, { fields: string[]; fix: string[] }>; fields: string[] };
type Row = { id: string; text: string; category: string; fields_involved: string[]; fix_step_ids: string[]; source: string; labelled_by: string | null; created_at: string };
type Data = { labels: Row[]; counts: Record<string, number>; total: number };

const NAME_KEY = "pfd.labelledBy";
const toggle = (xs: string[], x: string) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

export default function Label() {
  const { t } = useT();
  const nice = (prefix: string, k: string) => { const s = t(`${prefix}${k}` as Key); return s === `${prefix}${k}` ? k.replace(/_/g, " ") : s; };
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
  const select = (s: string) => { setText(s); setCat(""); setFields([]); setFix([]); setMsg(null); };

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
    if (!text.trim() || !cat) return setError(t("lbPickBoth"));
    setBusy(true); setError(null);
    try { localStorage.setItem(NAME_KEY, by.trim()); } catch {}
    try {
      await post("/v1/labels", { text, category: cat, fields_involved: fields, fix_step_ids: fix, labelled_by: by.trim() || undefined });
      select(queue?.find((q) => q.text !== text)?.text ?? "");
      setMsg(t("saved"));
      await load();
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  }

  async function del(id: string) {
    if (!confirm(t("lbDelConfirm"))) return;
    try { await api(`/v1/labels/${id}`, { method: "DELETE" }); await load(); } catch (err: any) { setError(err.message); }
  }

  async function importFile(f: File | undefined) {
    if (!f) return;
    setError(null);
    try {
      const r = await api<{ imported: number; skipped: number }>("/v1/labels/import", { method: "POST", body: await f.text(), headers: { "content-type": "application/x-ndjson" } });
      setMsg(t("lbImported", { n: r.imported, s: r.skipped }));
      await load();
    } catch (err: any) { setError(err.message); }
  }

  const check = "size-4 shrink-0 accent-[var(--color-brand)]";

  return (
    <div className="space-y-6">
      <PageHeader kicker={t("kTools")} title={t("labelTitle")} description={t("lbDesc")}
        actions={<>
          <a className={buttonClass("secondary", "sm")} href="/api/v1/labels/export" download="remark_labels.jsonl"><Download className="size-4" aria-hidden />{t("lbExport")}</a>
          <label className={cx(buttonClass("secondary", "sm"), "cursor-pointer")}><Upload className="size-4" aria-hidden />{t("lbImport")}
            <input type="file" accept=".jsonl,.ndjson,.txt,application/x-ndjson" className="sr-only" onChange={(e) => { importFile(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        </>} />
      <Notice tone="warn" icon={<ShieldAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />}><span className="font-medium">{t("noPii")}</span></Notice>
      <ErrorBox error={error} />
      {msg && <p className="font-medium text-ok" role="status">{msg}</p>}

      {!vocab ? !error && <Card className="p-5"><SkeletonRows rows={8} /></Card> : (
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div className="space-y-4">
            <div>
              <SectionTitle count={queue?.length}>{t("waitingRemarks")}</SectionTitle>
              {!queue ? <SkeletonRows rows={4} /> : queue.length === 0 ? <p className="text-ink-3">{t("noneWaiting")}</p> : (
                <Card className="max-h-96 divide-y divide-line overflow-y-auto">
                  {queue.map((q) => (
                    <button key={q.text} onClick={() => select(q.text)} aria-pressed={q.text === text}
                      className={cx("relative block w-full px-4 py-2.5 text-left", q.text === text ? "bg-brand-tint" : "hover:bg-[#fcfbf8]")}>
                      {q.text === text && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-brand" aria-hidden />}
                      <span className="block font-mono text-[0.85rem] leading-snug text-ink">{q.text}</span>
                      <span className="text-xs text-ink-3">{t("claimCount", { n: q.claim_count })}</span>
                    </button>
                  ))}
                </Card>
              )}
            </div>
            <Field label={t("orType")}>
              <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. FATHER NAME NOT MATCHING WITH UAN" className="font-mono text-[0.9rem]" />
            </Field>
          </div>

          <Card className="p-5">
            <form onSubmit={save} className="space-y-4">
              <div>
                <h2 className="text-[1.05rem] font-semibold">{t("lbReasonFor")}</h2>
                {!text.trim() ? <p className="mt-1 text-ink-3">{t("pickFirst")}</p>
                  : <p className="mt-2 break-words rounded-md border border-line bg-paper px-3 py-2 font-mono text-[0.85rem]">{text}</p>}
              </div>
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium text-ink-2">{t("whatReason")} <span className="font-normal text-ink-3">· {t("lbKeys")}</span></legend>
                <div className="grid gap-1 sm:grid-cols-2">
                  {cats.map((c, i) => (
                    <label key={c} className={cx("flex min-h-10 cursor-pointer items-center gap-2.5 rounded-md border px-2.5 py-1.5 text-[0.92rem]",
                      cat === c ? "border-brand bg-brand-tint font-medium" : "border-line hover:bg-sunk")}>
                      <input type="radio" name="cat" className={check} checked={cat === c} onChange={() => pick(c)} />
                      {i < 9 && <kbd className="rounded-sm border border-line-strong px-1 font-mono text-[10px] text-ink-3">{i + 1}</kbd>}
                      <span className="leading-snug">{nice("cat_", c)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {cat && (
                <>
                  <fieldset>
                    <legend className="mb-1.5 text-sm font-medium text-ink-2">{t("fieldsInvolved")}</legend>
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                      {vocab.fields.map((f) => (
                        <label key={f} className="flex items-center gap-1.5 text-[0.92rem]"><input type="checkbox" className={check} checked={fields.includes(f)} onChange={() => setFields(toggle(fields, f))} />{nice("fld_", f)}</label>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend className="mb-1.5 text-sm font-medium text-ink-2">{t("fixSteps")}</legend>
                    <div className="space-y-1">
                      {fixIds.map((id) => (
                        <label key={id} className="flex items-start gap-2 text-[0.92rem]"><input type="checkbox" className={cx(check, "mt-1")} checked={fix.includes(id)} onChange={() => setFix(toggle(fix, id))} />
                          <span>{rules[id] ?? id} <span className="font-mono text-xs text-ink-3">{id}</span></span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </>
              )}
              <Field label={t("labelledBy")}><Input value={by} onChange={(e) => setBy(e.target.value)} placeholder={t("yourName")} className="max-w-xs" /></Field>
              <Button type="submit" size="lg" busy={busy} disabled={!cat || !text.trim()}>{busy ? t("saving") : t("saveNext")}</Button>
            </form>
          </Card>
        </section>
      )}

      {vocab && (
        <section className="space-y-3">
          {!data ? <SkeletonRows rows={4} /> : (
            <>
              <SectionTitle>{t("labelledCount", { n: data.total })}</SectionTitle>
              <div className="h-1.5 w-full max-w-md overflow-hidden rounded-full bg-sunk" aria-hidden>
                <div className="h-full rounded-full bg-ok" style={{ width: `${Math.min(100, (data.total / 150) * 100)}%` }} />
              </div>
              <ul className="flex flex-wrap gap-1.5">
                {cats.map((c) => (
                  <li key={c} className="rounded-sm bg-sunk px-2 py-0.5 text-[0.82rem] text-ink-2">{nice("cat_", c)} <span className="num font-mono font-semibold text-ink">{data.counts[c] ?? 0}</span></li>
                ))}
              </ul>
              {data.labels.length > 0 && (
                <>
                  <h3 className="pt-3 text-[1.05rem] font-semibold">{t("lbHistory")}</h3>
                  <Card className="divide-y divide-line">
                    {data.labels.map((l) => (
                      <div key={l.id} className="flex items-start gap-3 px-4 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="break-words font-mono text-[0.85rem]">{l.text}</p>
                          <p className="text-sm text-ink-3">
                            <span className="font-medium text-ink-2">{nice("cat_", l.category)}</span>
                            {l.fix_step_ids.length > 0 && <span className="font-mono text-xs"> · {l.fix_step_ids.join(", ")}</span>}
                            {` · ${l.labelled_by ?? l.source} · ${fmtDate(l.created_at)}`}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" aria-label={t("del")} icon={<Trash2 className="size-4" />} onClick={() => del(l.id)}><span className="hidden sm:inline">{t("del")}</span></Button>
                      </div>
                    ))}
                  </Card>
                </>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
