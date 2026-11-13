"use client";
// Side column of the claim page: the worker's records as a compact ledger, then the claim's dates.
import type { ReactNode } from "react";
import { AlertTriangle, Check, X } from "lucide-react";
import { fmtDate } from "@/lib/api";
import { Card, Mono, cx } from "@/lib/ui";
import { useT, type Key } from "@/lib/i18n";
import type { Detail } from "./types";

const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const LANG: Record<string, Key> = { hi: "langHi", mr: "langMr", en: "langEn" };

function Group({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="border-t border-line px-4 py-3 first:border-t-0">
      <h3 className="mb-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-ink-3">{title}</h3>
      <dl className="text-[0.92rem]">{children}</dl>
    </div>
  );
}

function Row({ label, children, bad, note }: { label: ReactNode; children: ReactNode; bad?: boolean; note?: ReactNode }) {
  return (
    <div className={cx("grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 py-1", bad && "-mx-2 rounded-sm bg-danger-tint px-2")}>
      <dt className="text-ink-3">{label}</dt>
      <dd className={cx("min-w-0 break-words", bad && "text-danger")}>
        {children}
        {note && <span className="flex items-center gap-1 text-[0.8rem] font-semibold"><AlertTriangle className="size-3.5" aria-hidden />{note}</span>}
      </dd>
    </div>
  );
}

function YesNo({ v, yes, no }: { v: unknown; yes: string; no: string }) {
  if (v == null) return <span className="text-ink-3">—</span>;
  return v ? <span className="inline-flex items-center gap-1 text-ok"><Check className="size-3.5" aria-hidden />{yes}</span>
    : <span className="inline-flex items-center gap-1 font-semibold text-danger"><X className="size-3.5" aria-hidden />{no}</span>;
}

export function WorkerRecord({ d }: { d: Detail }) {
  const { t } = useT();
  const e = d.employee, c = d.claim;
  const dash = <span className="text-ink-3">—</span>;
  const val = (v: unknown) => (v == null || v === "" ? dash : String(v));
  // Rows compared against the UAN value; a difference is tinted and named, never colour alone.
  const vs = (base: unknown, v: unknown) => base != null && v != null && norm(base) !== norm(v);
  const names: [Key, unknown][] = [["clOnUan", e.name_uan], ["clOnBank", e.name_bank], ["clOnAadhaar", e.name_aadhaar]];
  const fathers: [Key, unknown][] = [["clOnUan", e.father_name_uan], ["clOnBank", e.father_name_bank]];
  const dobs: [Key, unknown][] = [["clOnUan", e.dob_uan], ["clOnAadhaar", e.dob_aadhaar]];
  const pairRows = (rows: [Key, unknown][], fmt: (v: unknown) => ReactNode = val) => rows.map(([k, v], i) => {
    const bad = i > 0 && vs(rows[0][1], v);
    return <Row key={k} label={t(k)} bad={bad} note={bad ? t("clDiffers") : undefined}>{fmt(v)}</Row>;
  });
  const date = (v: unknown) => (v ? fmtDate(String(v)) : dash);
  const timeline: [Key, string | null, string][] = [
    ["clCreated", c.created_at, "bg-line-strong"],
    ["clFiled", c.submitted_at, "bg-brand"],
    ...(c.settled_at ? [["clSettled", c.settled_at, "bg-ok"] as [Key, string, string]] : []),
    ...(c.rejected_at ? [["clRejected", c.rejected_at, "bg-danger"] as [Key, string, string]] : []),
  ];

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="border-b border-line px-4 py-3 text-[1.05rem] font-semibold">{t("clRecord")}</h2>
        <Group title={t("clName")}>{pairRows(names)}</Group>
        <Group title={t("clFather")}>{pairRows(fathers)}</Group>
        <Group title={t("clDob")}>{pairRows(dobs, date)}</Group>
        <Group title={t("clBank")}>
          <Row label={t("f_bank_ifsc")}><Mono>{val(e.bank_ifsc)}</Mono></Row>
          <Row label={t("f_account_masked")}><Mono>{val(e.account_masked)}</Mono></Row>
          <Row label={t("f_bank_verified")} bad={e.bank_verified === false}><YesNo v={e.bank_verified} yes={t("clVerified")} no={t("clNotVerified")} /></Row>
        </Group>
        <Group title={t("clKyc")}>
          <Row label="UAN"><Mono>{val(e.uan_masked)}</Mono></Row>
          <Row label={t("clOnAadhaar")}><Mono>{e.aadhaar_last4 ? `XXXX${e.aadhaar_last4}` : "—"}</Mono>{" "}
            <YesNo v={e.aadhaar_linked} yes={t("clLinked")} no={t("clNotLinked")} /></Row>
          <Row label="KYC" bad={e.kyc_approved_by_employer === false}><YesNo v={e.kyc_approved_by_employer} yes={t("clApproved")} no={t("clPending")} /></Row>
          <Row label={t("f_phone_masked")}><Mono>{val(e.phone_masked)}</Mono></Row>
          <Row label={t("f_preferred_language")}>{LANG[String(e.preferred_language)] ? t(LANG[String(e.preferred_language)]) : val(e.preferred_language)}</Row>
        </Group>
        <Group title={t("clJob")}>
          <Row label={t("f_date_of_joining")}>{date(e.date_of_joining)}</Row>
          <Row label={t("f_date_of_exit")}>{e.date_of_exit ? date(e.date_of_exit) : <span className="text-ink-3">{t("clStillWorking")}</span>}</Row>
        </Group>
      </Card>

      <Card className="px-4 py-3">
        <h2 className="mb-2 text-[1.05rem] font-semibold">{t("clTimeline")}</h2>
        <ol className="relative space-y-2.5 border-l border-line pl-4">
          {timeline.map(([k, at, dot]) => (
            <li key={k} className="relative flex items-baseline justify-between gap-3 text-[0.92rem]">
              <span aria-hidden className={cx("absolute -left-[21px] top-1.5 size-2.5 rounded-full ring-2 ring-sheet", at ? dot : "bg-sunk border border-line-strong")} />
              <span className={at ? "text-ink" : "text-ink-3"}>{t(k)}</span>
              <span className="num font-mono text-sm text-ink-2">{at ? fmtDate(at) : "—"}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
