"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Upload } from "lucide-react";
import { api, post, fmtDate } from "@/lib/api";
import {
  Button, Card, CopyButton, ErrorBox, Mono, PageHeader, SectionTitle, Skeleton, SkeletonRows, Stamp, buttonClass, cx, inputClass,
} from "@/lib/ui";
import { useT, type Key } from "@/lib/i18n";

type Flag = { code: string; message: string };
type VRow = { key: string; emp_code: string; uan_masked: string; name: string; days?: number | null; epf_wages?: number; employee?: number; eps?: number; employer_epf?: number; edli?: number; flags: Flag[] };
type Validation = { rows: VRow[]; missing: VRow[]; totals: Record<string, number>; flag_count: number; summary: string };
type Emp = { id: string; name: string; due_day: number; due_date: string | null; state: string; upload_status: string | null; uploaded_at: string | null; validation: Validation | null; workflow: string | null };
type Task = { id: string; kind: string; ref_id: string; title: string; body: string | null; due_at: string | null };
type Data = { wage_month: string; employers: Emp[]; tasks: Task[] };
type Employer = { id: string; contact_name: string | null };

const TONE = { waiting_sheet: "neutral", validating: "warn", awaiting_payment: "brand", paid: "ok" } as const;
// most urgent first: money to pay, sheets to check, sheets to chase, done
const ORDER = ["awaiting_payment", "validating", "waiting_sheet", "paid"];
const rs = (n: number | undefined) => (n == null ? "—" : `₹${n.toLocaleString("en-IN")}`);
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
// challan is due on due_day of the month after the wage month
const dueOf = (wm: string, day: number) => {
  const d = new Date(wm.slice(0, 7) + "-01T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() + 1, day || 15);
  return d.toISOString().slice(0, 10);
};
const monthName = (wm: string) => new Date(wm.slice(0, 7) + "-01T00:00:00Z").toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

export default function Cycle() {
  const { t } = useT();
  const [month, setMonth] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [contacts, setContacts] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = (m = month) => api<Data>(`/v1/cycles${m ? `?wage_month=${m}` : ""}`).then((d) => { setData(d); setMonth(d.wage_month.slice(0, 7)); }).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    api<Employer[]>("/v1/employers").then((es) => setContacts(Object.fromEntries(es.map((e) => [e.id, e.contact_name ?? ""])))).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key); setError(null);
    try { await fn(); await load(); } catch (e: any) { setError(e.message); } finally { setBusy(null); }
  }
  const upload = (id: string, file: File) => run(`up-${id}`, async () => {
    const fd = new FormData(); fd.append("file", file); fd.append("wage_month", month);
    await api(`/v1/employers/${id}/salary`, { method: "POST", body: fd });
    setOpen(id);
  });

  const UploadBtn = ({ e, variant }: { e: Emp; variant: "primary" | "secondary" | "ghost" }) => (
    <label className={cx(buttonClass(variant, variant === "ghost" ? "sm" : "md"), "cursor-pointer", busy && "pointer-events-none opacity-50")}>
      <Upload className="size-4" aria-hidden />{busy === `up-${e.id}` ? t("uploading") : e.upload_status ? t("cyReupload") : t("uploadSheet")}
      <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" disabled={!!busy}
        onChange={(ev) => { const f = ev.target.files?.[0]; ev.target.value = ""; if (f) upload(e.id, f); }} />
    </label>
  );

  const counts = (s: string) => data?.employers.filter((e) => e.state === s).length ?? 0;

  return (
    <div className="space-y-8">
      <PageHeader kicker={t("kClients")} title={t("cycle")} description={t("cyDesc")}
        actions={
          <label className="flex items-center gap-2 whitespace-nowrap text-sm font-medium text-ink-2">
            {t("wageMonth")}
            <input type="month" className={cx(inputClass, "w-44 font-mono")} value={month}
              onChange={(e) => { setMonth(e.target.value); if (e.target.value) { setData(null); load(e.target.value); } }} />
          </label>
        } />
      <ErrorBox error={error} />

      <section>
        {!data ? (
          <Card className="divide-y divide-line">
            {[0, 1, 2, 3].map((i) => <div key={i} className="flex items-center gap-4 p-4"><Skeleton className="h-5 w-48" /><Skeleton className="ml-auto h-9 w-36" /></div>)}
          </Card>
        ) : (
          <>
            <SectionTitle count={data.employers.length}>{monthName(data.wage_month)}</SectionTitle>
            <p className="mb-3 text-sm text-ink-3">
              {[t("cyCountWaiting", { n: counts("waiting_sheet") }), t("cyCountDue", { n: counts("awaiting_payment") }), t("cyCountPaid", { n: counts("paid") })].join(" · ")}
            </p>
            <Card className="divide-y divide-line">
              {[...data.employers].sort((a, b) => ORDER.indexOf(a.state) - ORDER.indexOf(b.state)).map((e) => {
                const v = e.validation;
                const due = dueOf(data.wage_month, e.due_day);
                const late = e.state !== "paid" && due < today();
                const isOpen = open === e.id && !!v;
                const reminder = t("cyReminder", { who: `${contacts[e.id] ?? ""} ${t("cyReminderWho")}`.trim(), m: monthName(data.wage_month), d: fmtDate(due) });
                const toggle = v && (
                  <Button variant={e.state === "validating" && v.flag_count ? "primary" : "secondary"} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : e.id)}
                    icon={<ChevronDown className={cx("size-4 transition-transform", isOpen && "rotate-180")} aria-hidden />}>
                    {isOpen ? t("hideTable") : t("cyReview")}
                  </Button>
                );
                return (
                  <div key={e.id}>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
                      <div className="min-w-0 flex-1 basis-64">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-semibold">{e.name}</span>
                          <Stamp tone={TONE[e.state as keyof typeof TONE] ?? "neutral"}>{t(`cySt_${e.state}` as Key)}</Stamp>
                        </div>
                        <p className="mt-1 text-sm text-ink-3">
                          <span className={cx(late && "font-medium text-danger")}>{late ? t("cyOverdue", { d: fmtDate(due) }) : t("cyDueOn", { d: fmtDate(due) })}</span>
                          {e.uploaded_at && <> · {t("cyUploadedOn", { d: fmtDate(e.uploaded_at) })}</>}
                        </p>
                        {v ? (
                          <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm">
                            {v.flag_count
                              ? <span className="inline-flex items-center gap-1 font-medium text-warn"><AlertTriangle className="size-3.5" aria-hidden />{t("cyFlagged", { n: v.flag_count })}</span>
                              : <span className="inline-flex items-center gap-1 text-ok"><Check className="size-3.5" aria-hidden />{t("cyAllOk", { n: v.totals.employees })}</span>}
                            <span className="text-ink-2">{t("totalPayable")} <Mono className="font-semibold text-ink">{rs(v.totals.total)}</Mono></span>
                          </p>
                        ) : e.upload_status ? <p className="mt-1 text-sm text-ink-2">{t("cyCheckingNow")}</p> : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {e.state === "waiting_sheet" && <>
                          <CopyButton text={reminder} label={t("copyReminder")} variant="ghost" />
                          <UploadBtn e={e} variant="primary" />
                        </>}
                        {e.state === "validating" && <>{!v && <UploadBtn e={e} variant="secondary" />}{toggle}</>}
                        {e.state === "awaiting_payment" && <>
                          {toggle}
                          <Button busy={busy === `p-${e.id}`} disabled={!!busy} icon={<Check className="size-4" aria-hidden />}
                            onClick={() => run(`p-${e.id}`, () => post(`/v1/employers/${e.id}/cycle/paid`, { wage_month: month }))}>{t("markPaid")}</Button>
                        </>}
                        {e.state === "paid" && v && (
                          <Button variant="ghost" size="sm" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : e.id)}>{isOpen ? t("hideTable") : t("showTable")}</Button>
                        )}
                      </div>
                    </div>
                    {(e.state === "waiting_sheet" && !e.workflow) || (e.upload_status && e.state !== "paid" && v) ? (
                      <div className="-mt-2 flex flex-wrap gap-1 px-4 pb-3">
                        {e.state === "waiting_sheet" && !e.workflow && (
                          <Button variant="ghost" size="sm" disabled={!!busy} busy={busy === `s-${e.id}`}
                            onClick={() => run(`s-${e.id}`, () => post(`/v1/employers/${e.id}/cycle/start`, { wage_month: month }))}>{t("startCycle")}</Button>
                        )}
                        {e.upload_status && e.state !== "paid" && v && <UploadBtn e={e} variant="ghost" />}
                      </div>
                    ) : null}
                    {isOpen && v && <Ledger v={v} />}
                  </div>
                );
              })}
            </Card>
          </>
        )}
      </section>

      <section>
        <SectionTitle count={data?.tasks.length}>{t("openTasks")}</SectionTitle>
        <p className="mb-3 text-sm text-ink-3">{t("cyTasksHint")}</p>
        {!data ? <SkeletonRows rows={2} /> : data.tasks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line-strong px-4 py-3 text-ink-2">{t("noTasks")}</p>
        ) : (
          <Card className="divide-y divide-line">
            {data.tasks.map((k) => (
              <div key={k.id} className="flex flex-wrap items-start gap-3 p-4">
                <div className="min-w-0 flex-1 basis-64">
                  <p className={cx("font-medium", k.title.startsWith("URGENT") && "text-danger")}>{k.title}</p>
                  {k.due_at && <p className="text-sm text-ink-3">{t("due")} {fmtDate(k.due_at)}</p>}
                  {k.body && <p className="mt-2 whitespace-pre-wrap rounded-md bg-paper px-3 py-2 text-[0.95rem] text-ink-2">{k.body}</p>}
                </div>
                <div className="flex gap-2">
                  {k.body && <CopyButton text={k.body} size="sm" />}
                  <Button variant="secondary" size="sm" disabled={!!busy} onClick={() => run(`t-${k.id}`, () => post(`/v1/tasks/${k.id}/done`, {}))}>{t("done")}</Button>
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}

function Ledger({ v }: { v: Validation }) {
  const { t } = useT();
  const th = "px-3 py-2 font-medium";
  const num = "num px-3 py-2 text-right font-mono text-[0.9rem]";
  return (
    <div className="overflow-x-auto border-t border-line bg-[#fcfbf8]">
      <table className="w-full min-w-[760px] text-[0.92rem]">
        <thead className="bg-sunk text-left font-mono text-[11px] uppercase tracking-[0.1em] text-ink-3">
          <tr>
            <th className={th}>{t("cyColWorker")}</th><th className={cx(th, "text-right")}>{t("cyColDays")}</th>
            <th className={cx(th, "text-right")}>{t("cyColWages")}</th><th className={cx(th, "text-right")}>{t("cyColEe")}</th>
            <th className={cx(th, "text-right")}>{t("cyColEps")}</th><th className={cx(th, "text-right")}>{t("cyColEr")}</th>
            <th className={cx(th, "text-right")}>{t("cyColEdli")}</th><th className={th}>{t("cyColCheck")}</th>
          </tr>
        </thead>
        <tbody>
          {[...v.rows, ...v.missing].map((r) => {
            const bad = r.flags.length > 0;
            return (
              <tr key={r.key} className={cx("border-t border-line align-top", bad && "bg-warn-tint/60")}>
                <td className="px-3 py-2">
                  <span className="font-medium">{r.name}</span>
                  <span className="block font-mono text-xs text-ink-3">{r.emp_code} · {r.uan_masked}</span>
                </td>
                <td className={num}>{r.days ?? "—"}</td><td className={num}>{rs(r.epf_wages)}</td><td className={num}>{rs(r.employee)}</td>
                <td className={num}>{rs(r.eps)}</td><td className={num}>{rs(r.employer_epf)}</td><td className={num}>{rs(r.edli)}</td>
                <td className="max-w-72 px-3 py-2">
                  {bad ? r.flags.map((f) => (
                    <p key={f.code} className="flex gap-1.5 text-[0.88rem] text-warn"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />{f.message}</p>
                  )) : <span className="inline-flex items-center gap-1 text-sm text-ok"><Check className="size-3.5" aria-hidden />{t("cyOk")}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="border-t-2 border-line-strong font-semibold">
          <tr>
            <td className="px-3 py-2.5">{t("cyTotal")} <span className="font-mono text-sm font-normal text-ink-3">· {t("cyWorkers", { n: v.totals.employees })}</span></td>
            <td /><td className={num}>{rs(v.totals.epf_wages)}</td><td className={num}>{rs(v.totals.employee)}</td>
            <td className={num}>{rs(v.totals.eps)}</td><td className={num}>{rs(v.totals.employer_epf)}</td><td className={num}>{rs(v.totals.edli)}</td>
            <td className="px-3 py-2.5 text-sm font-normal text-ink-2">
              {t("cyAdmin")} <Mono>{rs(v.totals.admin)}</Mono><br />
              <span className="font-semibold text-ink">{t("totalPayable")} <Mono>{rs(v.totals.total)}</Mono></span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

