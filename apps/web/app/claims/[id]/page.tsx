"use client";
// Claim workspace: one worker's claim as a guided journey. Only the current step is open; finished steps fold to one line.
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronLeft } from "lucide-react";
import { api, post, fmtDate, NEXT_STATUS, type Rule } from "@/lib/api";
import { Card, ErrorBox, Mono, Notice, Skeleton, StatusStamp, Steps, cx, type StepState } from "@/lib/ui";
import { useT, type Key } from "@/lib/i18n";
import type { Decoded, Detail, Said } from "@/components/claim/types";
import { CheckPanel, DecodePanel, EtaLine, FixPanel, InformPanel, RemarkSlip, StatusChoices } from "@/components/claim/Panels";
import { WorkerRecord } from "@/components/claim/Record";

type StepKey = "check" | "fix" | "inform" | "submit" | "settle" | "decode" | "resubmit";
type Step = { key: StepKey; label: string; title: string; state: StepState; summary: string; panel: ReactNode };
const FILED = ["submitted", "under_process", "resubmitted", "settled", "closed"];

export default function ClaimPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useT();
  const [d, setD] = useState<Detail | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<{ k: string; msg: string } | null>(null);
  const [open, setOpen] = useState<StepKey | null>(null); // null = follow the current step
  const [rules, setRules] = useState<Record<string, string>>({});
  const [lang, setLang] = useState("hi");
  const [msg, setMsg] = useState<Said | null>(null);
  const [why, setWhy] = useState<Said | null>(null);
  const [dec, setDec] = useState<Decoded | null>(null);
  const [link, setLink] = useState<{ url: string; expires_at: string } | null>(null);
  const autoRan = useRef(false);

  const load = () => api<Detail>(`/v1/claims/${id}`).then((r) => {
    setD(r);
    if (r.claim.decoded?.category) setDec((x) => x ?? r.claim.decoded);
  }).catch((e) => setLoadErr(e.message));
  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    api<Rule[]>("/v1/rules").then((rs) => setRules(Object.fromEntries(rs.map((r) => [r.id, r.title])))).catch(() => {});
  }, []);
  const pref = (d?.employee.preferred_language as string | null) ?? null;
  useEffect(() => { if (pref === "hi" || pref === "mr" || pref === "en") setLang(pref); }, [pref]);

  async function run<T>(key: string, fn: () => Promise<T>, then: (r: T) => unknown) {
    setBusy(key); setErr(null);
    try { await then(await fn()); } catch (e: any) { setErr({ k: key, msg: e.message }); } finally { setBusy(null); }
  }
  const errOf = (k: string) => (err?.k === k ? err.msg : null);
  const precheck = () => run("pc", () => post(`/v1/claims/${id}/precheck`, {}), () => { setWhy(null); setOpen(null); return load(); });
  const changeStatus = (status: string, rejection_remark?: string) =>
    run("status", () => api(`/v1/claims/${id}`, { method: "PATCH", body: JSON.stringify({ status, rejection_remark }) }), () => { setOpen(null); return load(); });

  // Deep links: ?run=precheck runs it once; #decoder opens and scrolls to the decode step.
  useEffect(() => {
    if (!d) return;
    if (!autoRan.current && new URLSearchParams(location.search).get("run") === "precheck") {
      autoRan.current = true;
      history.replaceState(null, "", location.pathname + location.hash);
      precheck();
    }
    if (location.hash === "#decoder" && d.claim.status === "rejected") {
      setOpen("decode");
      requestAnimationFrame(() => document.getElementById("decoder")?.scrollIntoView({ block: "start" }));
    }
  }, [!!d]);

  if (!d) return loadErr ? <ErrorBox error={loadErr} /> : <PageSkeleton />;
  const { claim, employee } = d;
  const pc = d.precheck;
  const status = claim.status;
  const blockers = pc?.issues.filter((i) => i.severity === "blocker").length ?? 0;
  const warnings = (pc?.issues.length ?? 0) - blockers;
  const filed = FILED.includes(status) || status === "rejected";
  const rejectedFlow = status === "rejected" || (status === "closed" && !!claim.rejected_at && !claim.settled_at);
  const informed = !!msg || !!link;
  const settled = status === "settled" || (status === "closed" && !!claim.settled_at);

  const current: StepKey | null = rejectedFlow ? (status === "closed" ? null : dec ? "resubmit" : "decode")
    : status === "settled" ? "settle" : status === "closed" ? null : filed ? "settle"
    : !pc ? "check" : blockers > 0 || (warnings > 0 && !informed) ? "fix" : !informed ? "inform" : "submit";
  const shown = open ?? current;
  const st = (k: StepKey, done: boolean): StepState => (done ? "done" : current === k ? "current" : "todo");
  const date = (s: string | null) => fmtDate(s);
  const catWord = dec ? t(`clCat_${dec.category}` as Key) : "";

  const where = rejectedFlow
    ? status === "closed" ? t("clWhere_closed") : dec ? t("clWhere_resubmit") : t("clWhere_decode", { d: date(claim.rejected_at) })
    : settled ? t("clWhere_settled", { d: date(claim.settled_at) }) : status === "closed" ? t("clWhere_closed")
    : filed ? t("clWhere_track", { d: date(claim.submitted_at) }) : t(`clWhere_${current}` as Key, { n: blockers || (pc?.issues.length ?? 0) });

  const steps: Step[] = [
    { key: "check", label: t("clStepCheck"), title: t("clT_check"), state: st("check", !!pc), summary: pc ? t("clS_checked") : t("clS_notChecked"),
      panel: <CheckPanel ran={!!pc} busy={busy === "pc"} onRun={precheck} error={errOf("pc")} /> },
    { key: "fix", label: t("clStepFix"), title: t("clT_fix"), state: st("fix", !!pc && blockers === 0 && (warnings === 0 || informed)),
      summary: !pc ? t("clS_waitCheck") : blockers ? t("clS_mustFix", { n: blockers }) : warnings ? t("clS_toCheck", { n: warnings }) : t("clS_noProblems"),
      panel: pc ? <FixPanel pc={pc} emp={employee} rules={rules} filed={filed} why={why} explaining={busy === "why"} error={errOf("why")}
        onExplain={() => run("why", () => post<Said>(`/v1/claims/${id}/explain`, {}), setWhy)}
        onAskWorker={filed ? undefined : () => setOpen("inform")} />
        : <CheckPanel ran={false} busy={busy === "pc"} onRun={precheck} error={errOf("pc")} /> },
    { key: "inform", label: t("clStepInform"), title: t("clT_inform"), state: st("inform", informed || filed),
      summary: informed ? t("clS_informed") : t("clS_informSoft"),
      panel: <InformPanel hasIssues={!!pc?.issues.length} pref={pref} lang={lang} setLang={setLang} msg={msg} setMsg={setMsg}
        drafting={busy === "msg"} onDraft={() => run("msg", () => post<Said>(`/v1/claims/${id}/message`, { lang }), (r) => { setMsg(r); setOpen("inform"); })}
        link={link} linking={busy === "link"} errMsg={errOf("msg")} errLink={errOf("link")}
        onLink={() => run("link", () => post<{ url: string; expires_at: string }>(`/v1/help-links`, { employee_id: employee.id }),
          (r) => { setLink({ ...r, url: r.url.startsWith("http") ? r.url : location.origin + r.url }); setOpen("inform"); })} /> },
  ];
  if (rejectedFlow) {
    steps.push(
      { key: "submit", label: t("clStepRejected"), title: t("clT_rejected"), state: "bad", summary: t("clS_rejected", { d: date(claim.rejected_at) }),
        panel: claim.rejection_remark ? <RemarkSlip remark={claim.rejection_remark} /> : <p className="text-ink-2">{t("clS_rejected", { d: date(claim.rejected_at) })}</p> },
      { key: "decode", label: t("clStepDecode"), title: t("clT_decode"), state: st("decode", !!dec),
        summary: dec ? t("clS_decoded", { c: catWord }) : t("clS_notDecoded"),
        panel: <DecodePanel saved={claim.rejection_remark} dec={dec} pref={pref} busy={busy === "dec"} error={errOf("dec")}
          onDecode={(remark) => run("dec", () => post<Decoded>(`/v1/claims/${id}/decode`, { remark }), (r) => { setDec(r); setOpen("decode"); })} /> },
      { key: "resubmit", label: t("clStepResubmit"), title: t("clT_resubmit"), state: st("resubmit", status === "closed"), summary: t("clS_refile"),
        panel: <div className="space-y-4"><p className="max-w-prose text-ink-2">{t("clResubmitIntro")}</p>
          <StatusChoices choices={NEXT_STATUS[status] ?? []} busy={busy === "status"} onChange={changeStatus} error={errOf("status")} />
          <CheckPanel ran={!!pc} busy={busy === "pc"} onRun={precheck} error={errOf("pc")} /></div> },
    );
  } else {
    const next = NEXT_STATUS[status] ?? [];
    steps.push(
      { key: "submit", label: t("clStepSubmit"), title: t("clT_submit"), state: st("submit", filed),
        summary: filed ? t("clS_filed", { d: date(claim.submitted_at) }) : t("clS_notFiled"),
        panel: filed ? <p className="text-ink-2">{t("clFiledOn", { d: date(claim.submitted_at) })}</p> : (
          <div className="space-y-4">
            <p className="max-w-prose text-ink-2">{t("clSubmitIntro")}</p>
            {blockers > 0 && <Notice tone="warn" icon={<AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />}>{t("clStillProblems", { n: blockers })}</Notice>}
            <StatusChoices choices={next.filter((s) => s === "submitted")} primary="submitted" busy={busy === "status"} onChange={changeStatus} error={errOf("status")} />
          </div>) },
      { key: "settle", label: t("clStepSettle"), title: settled ? t("clT_settled") : t("clT_settle"), state: st("settle", settled),
        summary: settled ? t("clS_paid", { d: date(claim.settled_at) }) : filed ? t("clS_waiting") : t("clS_afterFiling"),
        panel: !filed ? <p className="text-ink-2">{t("clS_notFiled")}</p> : (
          <div className="space-y-4">
            {settled ? <p className="text-ink-2">{t("clPaidOn", { d: date(claim.settled_at) })}</p> : <>
              <EtaLine eta={pc?.eta ?? null} filed />
              <p className="text-ink-2">{t("clTrackIntro")}</p></>}
            {next.length > 0 && <StatusChoices choices={next} busy={busy === "status"} onChange={changeStatus} error={errOf("status")} />}
          </div>) },
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-4 border-b border-line pb-5">
        <Link href="/claims" className="inline-flex items-center gap-1 text-sm text-ink-3 hover:text-brand"><ChevronLeft className="size-4" aria-hidden />{t("clAllClaims")}</Link>
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <h1 className="text-[1.65rem] font-semibold leading-tight">{String(employee.name_uan ?? "—")}</h1>
            <p className="mt-1 text-ink-2">
              <span className="font-medium text-ink">{t("clForm", { f: claim.form })}</span>
              {t(`clFormName_${claim.form}` as Key) !== `clFormName_${claim.form}` && <> · {t(`clFormName_${claim.form}` as Key)}</>}
              <span className="text-ink-3"> · </span>{String(employee.employer_name ?? "")}
            </p>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <span className="text-sm text-ink-3">UAN <Mono className="text-ink-2">{String(employee.uan_masked ?? "—")}</Mono></span>
            <StatusStamp status={status} />
          </div>
        </div>
        <p className={cx("text-[1.05rem]", rejectedFlow && status !== "closed" ? "text-danger" : "text-ink")}>{where}</p>
        <div className="-mx-4 px-4 max-md:[&_li]:flex-none sm:mx-0 sm:px-0">
          <Steps steps={steps.map((s) => ({ label: s.label, state: s.state }))} />
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] xl:grid-cols-[minmax(0,1fr)_21rem]">
        <Card className="overflow-hidden">
          <ol>
            {steps.map((s, i) => {
              const isOpen = shown === s.key;
              return (
                <li key={s.key} id={s.key === "decode" ? "decoder" : undefined}
                  className={cx("scroll-mt-20 border-t border-line first:border-t-0", isOpen && "bg-sheet")}>
                  <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? (s.key === current ? s.key : null) : s.key)}
                    className={cx("flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5", !isOpen && "hover:bg-[#fcfbf8]", isOpen && "pb-2")}>
                    <Badge n={i + 1} state={s.state} />
                    <span className="min-w-0 flex-1">
                      <span className={cx("block font-semibold", isOpen ? "text-[1.1rem] text-ink" : s.state === "todo" ? "text-ink-2" : "text-ink", s.state === "bad" && "text-danger")}>{s.title}</span>
                      {!isOpen && <span className="block truncate text-sm text-ink-3">{s.summary}</span>}
                    </span>
                    {!isOpen && <span className="flex items-center gap-1 text-sm text-ink-3">{t("clOpen")}<ChevronDown className="size-4" aria-hidden /></span>}
                  </button>
                  {isOpen && <div className="px-4 pb-5 pl-[3.25rem] pt-1 max-sm:pl-4 sm:px-5 sm:pl-[3.5rem]">{s.panel}</div>}
                </li>
              );
            })}
          </ol>
        </Card>
        <aside className="lg:sticky lg:top-20">
          <WorkerRecord d={d} />
        </aside>
      </div>
    </div>
  );
}

function Badge({ n, state }: { n: number; state: StepState }) {
  return (
    <span aria-hidden className={cx("num flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-[13px] font-semibold",
      state === "done" && "border-ok/50 bg-ok-tint text-ok",
      state === "current" && "border-brand bg-brand text-white",
      state === "bad" && "border-danger/50 bg-danger-tint text-danger",
      state === "todo" && "border-line-strong bg-sheet text-ink-3")}>
      {state === "done" ? <Check className="size-4" /> : state === "bad" ? "!" : n}
    </span>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-3 border-b border-line pb-5">
        <Skeleton className="h-3 w-20" /><Skeleton className="h-8 w-72" /><Skeleton className="h-4 w-96 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" /><Skeleton className="mt-2 h-6 w-full" />
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <Card className="space-y-4 p-5">
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className="flex items-center gap-3"><Skeleton className="size-7 rounded-full" /><Skeleton className={i === 0 ? "h-5 w-1/2" : "h-4 w-1/3"} /></div>)}
          <Skeleton className="ml-10 h-24" />
        </Card>
        <Card className="space-y-3 p-4">{[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <Skeleton key={i} className={i % 3 ? "h-4 w-full" : "h-3 w-1/3"} />)}</Card>
      </div>
    </div>
  );
}
