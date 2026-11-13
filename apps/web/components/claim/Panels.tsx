"use client";
// The step panels of the claim workspace. Each panel has one primary action; state lives in the page.
import { useState, type ReactNode } from "react";
import { ArrowRight, Link2, MessageCircle, ScanSearch, Sparkles } from "lucide-react";
import { fmtDate, type Issue, type Precheck } from "@/lib/api";
import { Button, Chip, CopyButton, ErrorBox, Field, Input, Loading, Notice, RiskMeter, Select, Stamp, Textarea, Why, cx } from "@/lib/ui";
import { useT, type Key } from "@/lib/i18n";
import type { Decoded, Said } from "./types";

const short = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const Meta = ({ children }: { children: ReactNode }) => <p className="text-sm text-ink-3">{children}</p>;
const Intro = ({ children }: { children: ReactNode }) => <p className="max-w-prose text-ink-2">{children}</p>;
export const LANGS = [["hi", "langHi"], ["mr", "langMr"], ["en", "langEn"]] as const;

// ---------- 1 Check ----------
export function CheckPanel({ ran, busy, onRun, error }: { ran: boolean; busy: boolean; onRun: () => void; error: string | null }) {
  const { t } = useT();
  return (
    <div className="space-y-4">
      <Intro>{ran ? t("clRunAgainHint") : t("clCheckIntro")}</Intro>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant={ran ? "secondary" : "primary"} size={ran ? "md" : "lg"} busy={busy} onClick={onRun} icon={<ScanSearch className="size-4" aria-hidden />}>
          {ran ? t("clRunAgain") : t("runPrecheck")}
        </Button>
        {busy && <span className="text-sm text-ink-2" role="status">{t("clChecking")}</span>}
      </div>
      <ErrorBox error={error} />
    </div>
  );
}

// ---------- 2 Fix ----------
// Issue field -> the two employee values it compares (base on UAN).
const PAIRS: Record<string, [string, Key, string, Key, Key]> = {
  name_bank: ["name_uan", "clOnUan", "name_bank", "clOnBank", "clCat_name_mismatch"],
  name_aadhaar: ["name_uan", "clOnUan", "name_aadhaar", "clOnAadhaar", "clCat_name_mismatch"],
  father_name_bank: ["father_name_uan", "clOnUan", "father_name_bank", "clOnBank", "clCat_father_name_mismatch"],
  dob_aadhaar: ["dob_uan", "clOnUan", "dob_aadhaar", "clOnAadhaar", "clCat_dob_mismatch"],
};

function IssueCard({ n, issue, emp, ruleTitle }: { n: number; issue: Issue; emp: Record<string, unknown>; ruleTitle?: string }) {
  const { t } = useT();
  const pair = PAIRS[issue.field];
  const isDate = issue.field.startsWith("dob");
  const v = (k: string) => (emp[k] == null ? "—" : isDate ? fmtDate(String(emp[k])) : String(emp[k]));
  const blocker = issue.severity === "blocker";
  return (
    <li className="flex gap-3 border-t border-line py-4 first:border-t-0 first:pt-1">
      <span className={cx("num flex size-7 shrink-0 items-center justify-center rounded-md border font-mono text-sm font-semibold",
        blocker ? "border-danger/40 bg-danger-tint text-danger" : "border-warn/40 bg-warn-tint text-warn")}>{n}</span>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Stamp tone={blocker ? "danger" : "warn"}>{blocker ? t("clMustFix") : t("clWorthCheck")}</Stamp>
          <p className="font-semibold">{pair ? t(pair[4]) : issue.message}</p>
        </div>
        {pair && (
          <div className="grid gap-2 sm:grid-cols-2">
            {[[pair[0], pair[1], false], [pair[2], pair[3], true]].map(([k, label, other]) => (
              <div key={k as string} className={cx("rounded-md border px-3 py-2", other ? "border-danger/30 bg-danger-tint/60" : "border-line bg-sunk/60")}>
                <span className="block font-mono text-[11px] uppercase tracking-[0.1em] text-ink-3">{t(label as Key)}</span>
                <span className="font-medium">{v(k as string)}</span>
              </div>
            ))}
          </div>
        )}
        <p className="text-ink-2"><span className="font-semibold text-ink">{t("clFix")}:</span> {issue.fix}</p>
        <Chip title={issue.rule_id}>{t("clRule")}: {ruleTitle ?? issue.rule_id}{ruleTitle && <span className="ml-1 font-mono text-[11px] text-ink-3">{issue.rule_id}</span>}</Chip>
      </div>
    </li>
  );
}

export function EtaLine({ eta, filed }: { eta: Precheck["eta"]; filed: boolean }) {
  const { t } = useT();
  if (!eta) return null;
  return <p className="text-ink-2">{t(filed ? "clEtaFiled" : "clEtaToday", { d: short(eta.likely_date), a: short(eta.range[0]), b: short(eta.range[1]) })}</p>;
}

export function FixPanel({ pc, emp, rules, filed, why, explaining, onExplain, onAskWorker, error }: {
  pc: Precheck; emp: Record<string, unknown>; rules: Record<string, string>; filed: boolean;
  why: Said | null; explaining: boolean; onExplain: () => void; onAskWorker?: () => void; error: string | null;
}) {
  const { t } = useT();
  const blockers = pc.issues.filter((i) => i.severity === "blocker").length;
  const sorted = [...pc.issues].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "blocker" ? -1 : 1));
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-md bg-sunk/70 px-4 py-3">
        <div className="space-y-1">
          <p className="text-[1.05rem] font-semibold">{t(`clRisk_${pc.risk_band}` as Key)}</p>
          {/* a must-fix problem makes it High whatever the model says; don't show "High 23%" */}
          {blockers > 0 && pc.risk_pct < 0.5
            ? <p className="text-sm font-semibold text-danger">{t("clBlockerRisk", { n: blockers })}</p>
            : <RiskMeter pct={pc.risk_pct} band={pc.risk_band} />}
          <EtaLine eta={pc.eta} filed={filed} />
        </div>
        <Why label={t("clHowWorked")}>
          <dl className="space-y-1.5">
            <div><dt className="font-semibold text-ink">{t("clRiskModel")}</dt><dd>{Math.round(pc.risk_pct * 100)}% · {pc.risk_model}</dd></div>
            {pc.eta && <div><dt className="font-semibold text-ink">{t("clEtaModel")}</dt>
              <dd>{t("clEtaDays", { n: Math.round(pc.eta.days), a: Math.round(pc.eta.low), b: Math.round(pc.eta.high) })} · {pc.eta.model}</dd></div>}
          </dl>
        </Why>
      </div>

      {pc.issues.length === 0 ? <Notice tone="ok">{t("clAllClear")}</Notice> : (
        <div>
          <h3 className="mb-1 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-ink-3">{t("clIssuesTitle")} · {pc.issues.length}</h3>
          <ol>{sorted.map((i, n) => <IssueCard key={n} n={n + 1} issue={i} emp={emp} ruleTitle={rules[i.rule_id]} />)}</ol>
        </div>
      )}

      {why && !explaining && (
        <Notice icon={<Sparkles className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />}>
          <p className="whitespace-pre-wrap leading-relaxed">{why.text}</p>
          <p className="mt-1.5 text-sm text-ink-3">{t("clExplainMeta", { m: why.model })}</p>
        </Notice>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        {onAskWorker && pc.issues.length > 0 && <Button onClick={onAskWorker} icon={<MessageCircle className="size-4" aria-hidden />}>{t("clAskWorker")}</Button>}
        <Button variant="secondary" busy={explaining} onClick={onExplain}>{t("clExplain")}</Button>
        {explaining && <span className="text-sm text-ink-2" role="status">{t("clExplaining")}</span>}
      </div>
      <ErrorBox error={error} />
    </div>
  );
}

// ---------- 3 Inform ----------
export function InformPanel({ hasIssues, pref, lang, setLang, msg, setMsg, drafting, onDraft, link, linking, onLink, errMsg, errLink }: {
  hasIssues: boolean; pref: string | null; lang: string; setLang: (l: string) => void;
  msg: Said | null; setMsg: (m: Said) => void; drafting: boolean; onDraft: () => void;
  link: { url: string; expires_at: string } | null; linking: boolean; onLink: () => void; errMsg: string | null; errLink: string | null;
}) {
  const { t } = useT();
  return (
    <div className="space-y-5">
      <Intro>{hasIssues ? t("clInformIntro") : t("clInformIntroOk")}</Intro>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-80">
          <Field label={t("clLang")}>
            <Select value={lang} onChange={(e) => setLang(e.target.value)}>
              {LANGS.map(([v, l]) => <option key={v} value={v}>{v === pref ? t("clWorkerLang", { l: t(l) }) : t(l)}</option>)}
            </Select>
          </Field>
        </div>
        <Button variant={msg ? "secondary" : "primary"} busy={drafting} onClick={onDraft} icon={<MessageCircle className="size-4" aria-hidden />}>
          {msg ? t("clRedraft") : t("clDraft")}
        </Button>
      </div>
      {drafting && <Loading text={t("clWriting")} />}
      <ErrorBox error={errMsg} />
      {msg && !drafting && (
        <div className="space-y-2">
          <Textarea rows={7} value={msg.text} onChange={(e) => setMsg({ ...msg, text: e.target.value })} aria-label={t("waTitle")} lang={lang} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CopyButton text={msg.text} label={t("copyWa")} variant="primary" />
            <Meta>{t("clEditHint")} {t("clMsgMeta", { m: msg.model })}</Meta>
          </div>
        </div>
      )}

      <div className="border-t border-line pt-4">
        <h3 className="font-semibold">{t("clHelpTitle")}</h3>
        <p className="mb-3 max-w-prose text-sm text-ink-2">{t("clHelpBody")}</p>
        {link ? (
          <div className="space-y-1.5">
            <div className="flex gap-2">
              <Input readOnly value={link.url} onFocus={(e) => e.currentTarget.select()} className="font-mono text-sm" aria-label={t("helpLinkTitle")} />
              <CopyButton text={link.url} />
            </div>
            <Meta>{t("clExpires", { d: fmtDate(link.expires_at) })}</Meta>
          </div>
        ) : (
          <Button variant="secondary" busy={linking} onClick={onLink} icon={<Link2 className="size-4" aria-hidden />}>{linking ? t("clCreatingLink") : t("clCreateLink")}</Button>
        )}
        <ErrorBox error={errLink} />
      </div>
    </div>
  );
}

// ---------- 4/5 Status choices ----------
/** Status changes as plain choices. "rejected" asks for the EPFO remark inline before saving. */
export function StatusChoices({ choices, primary, busy, onChange, error }: {
  choices: string[]; primary?: string; busy: boolean; onChange: (status: string, remark?: string) => void; error: string | null;
}) {
  const { t } = useT();
  const [asking, setAsking] = useState(false);
  const [remark, setRemark] = useState("");
  const rest = choices.filter((s) => s !== primary);
  if (asking) return (
    <div className="space-y-3 rounded-md border border-danger/30 bg-danger-tint/40 p-4">
      <Field label={t("clRemarkLabel")} hint={t("clRemarkHint")}>
        <Textarea autoFocus rows={3} value={remark} onChange={(e) => setRemark(e.target.value)} className="font-mono text-[0.95rem]" />
      </Field>
      <div className="flex gap-2">
        <Button busy={busy} disabled={!remark.trim()} onClick={() => onChange("rejected", remark.trim())}>{busy ? t("clSaving") : t("clSaveRejected")}</Button>
        <Button variant="ghost" onClick={() => setAsking(false)}>{t("clCancel")}</Button>
      </div>
      <ErrorBox error={error} />
    </div>
  );
  const pick = (s: string) => (s === "rejected" ? setAsking(true) : onChange(s));
  return (
    <div className="space-y-3">
      {primary && <Button size="lg" busy={busy} onClick={() => pick(primary)} icon={<ArrowRight className="size-4" aria-hidden />}>{t(`clChoice_${primary}` as Key)}</Button>}
      {rest.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-md border border-line-strong bg-sheet">
          {rest.map((s) => (
            <li key={s}>
              <button disabled={busy} onClick={() => pick(s)}
                className={cx("flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors disabled:opacity-50",
                  s === "rejected" ? "hover:bg-danger-tint" : "hover:bg-sunk")}>
                <span>
                  <span className={cx("block font-semibold", s === "rejected" ? "text-danger" : "text-ink")}>{t(`clChoice_${s}` as Key)}</span>
                  <span className="block text-sm text-ink-3">{t(`clHint_${s}` as Key)}</span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-ink-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {busy && <Loading text={t("clSaving")} />}
      <ErrorBox error={error} />
    </div>
  );
}

// ---------- Rejected: decode ----------
export function RemarkSlip({ remark }: { remark: string }) {
  const { t } = useT();
  return (
    <figure className="relative rounded-sm border border-line-strong border-l-[3px] border-l-danger bg-[#fbfaf5] px-4 py-3 shadow-[var(--shadow-card)]">
      <figcaption className="mb-1 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-ink-3">{t("clRemarkSlip")}</figcaption>
      <blockquote className="font-mono text-[0.98rem] leading-relaxed text-ink">“{remark}”</blockquote>
    </figure>
  );
}

export function DecodePanel({ saved, dec, pref, busy, onDecode, error }: {
  saved: string | null; dec: Decoded | null; pref: string | null; busy: boolean; onDecode: (remark: string) => void; error: string | null;
}) {
  const { t } = useT();
  const [editing, setEditing] = useState(!saved);
  const [remark, setRemark] = useState(saved ?? "");
  const [tab, setTab] = useState(pref === "mr" || pref === "en" ? pref : "hi");
  const msgs: Record<string, string> = dec ? { hi: dec.employee_message_hi, mr: dec.employee_message_mr, en: dec.employee_message_en } : {};
  return (
    <div className="space-y-5">
      {editing ? (
        <Field label={t("clPasteRemark")} hint={saved ? undefined : t("clNoRemark")}>
          <Textarea rows={3} value={remark} onChange={(e) => setRemark(e.target.value)} className="font-mono text-[0.95rem]" />
        </Field>
      ) : (
        <div className="space-y-1.5">
          <RemarkSlip remark={remark} />
          <button className="text-sm text-ink-3 underline-offset-2 hover:text-brand hover:underline" onClick={() => setEditing(true)}>{t("edit")}</button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant={dec ? "secondary" : "primary"} size={dec ? "md" : "lg"} busy={busy} disabled={!remark.trim()} onClick={() => onDecode(remark.trim())}
          icon={<ScanSearch className="size-4" aria-hidden />}>{dec ? t("clDecodeAgain") : t("clDecodeBtn")}</Button>
        {busy && <span className="text-sm text-ink-2" role="status">{t("clDecoding")}</span>}
      </div>
      <ErrorBox error={error} />

      {dec && !busy && (
        <div className="space-y-4 border-t border-line pt-4">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
            <dt className="text-sm text-ink-3">{t("clProblem")}</dt>
            <dd className="text-[1.1rem] font-semibold">{t(`clCat_${dec.category}` as Key) || dec.category}</dd>
            {dec.fields_involved.length > 0 && <>
              <dt className="text-sm text-ink-3">{t("clRecordsInvolved")}</dt>
              <dd className="flex flex-wrap gap-1.5">{dec.fields_involved.map((f) => <Chip key={f}>{t(`clFld_${f}` as Key) || f}</Chip>)}</dd>
            </>}
            {dec.fix_steps.length > 0 && <>
              <dt className="text-sm text-ink-3">{t("clWhatToDo")}</dt>
              <dd><ol className="list-decimal space-y-1 pl-5">{dec.fix_steps.map((s) => (
                <li key={s.id}>{s.title} <span className="font-mono text-[11px] text-ink-3">{s.id}</span></li>
              ))}</ol></dd>
            </>}
          </dl>
          <div>
            <div className="flex items-end justify-between gap-2 border-b border-line">
              <h3 className="pb-2 font-semibold">{t("clMsgWorker")}</h3>
              <div role="tablist" className="flex">
                {LANGS.map(([v, l]) => (
                  <button key={v} role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
                    className={cx("-mb-px border-b-2 px-3 py-2 text-sm font-medium", tab === v ? "border-brand text-brand" : "border-transparent text-ink-3 hover:text-ink")}>{t(l)}</button>
                ))}
              </div>
            </div>
            <div role="tabpanel" className="space-y-3 pt-3">
              <p className="whitespace-pre-wrap rounded-md bg-sunk/70 px-3.5 py-3 leading-relaxed" lang={tab}>{msgs[tab] || "—"}</p>
              {msgs[tab] && <CopyButton text={msgs[tab]} label={t("copyWa")} />}
            </div>
          </div>
          <Meta>{t("clReadBy", { m: dec.model })}</Meta>
        </div>
      )}
    </div>
  );
}
