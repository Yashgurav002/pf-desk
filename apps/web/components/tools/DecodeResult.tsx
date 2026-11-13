"use client";
// Rejection Decoder result: reason in plain words, fix steps, fields, worker message in hi/mr/en.
// Shape returned by POST /v1/decode and POST /v1/claims/:id/decode.
import Link from "next/link";
import { useState } from "react";
import { Card, Chip, CopyButton, cx } from "@/lib/ui";
import { useT, type Key } from "@/lib/i18n";

export type Decoded = {
  category: string; fields_involved: string[]; fix_steps: { id: string; title: string }[];
  employee_message_hi: string; employee_message_mr: string; employee_message_en: string; model: string;
};
const LANGS = [["hi", "langHi"], ["mr", "langMr"], ["en", "langEn"]] as const;

export function DecodeResult({ d, msgHint }: { d: Decoded; msgHint?: string }) {
  const { t, lang } = useT();
  const [tab, setTab] = useState<"hi" | "mr" | "en">(lang === "en" ? "hi" : lang);
  const tk = (k: string) => { const s = t(k as Key); return s === k ? null : s; };
  const msg = d[`employee_message_${tab}`];
  return (
    <Card className="divide-y divide-line">
      <div className="p-5">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-ink-3">{t("dcReason")}</p>
        <h2 className="mt-1 text-[1.3rem] font-semibold leading-snug">{tk(`cat_${d.category}`) ?? d.category.replaceAll("_", " ")}</h2>
        {tk(`catm_${d.category}`) && <p className="mt-1 max-w-2xl text-ink-2">{tk(`catm_${d.category}`)}</p>}
        {d.fields_involved.length > 0 && (
          <p className="mt-3 flex flex-wrap items-center gap-1.5 text-sm text-ink-3">
            <span className="mr-1">{t("dcFields")}:</span>
            {d.fields_involved.map((f) => <Chip key={f}>{tk(`fld_${f}`) ?? f.replaceAll("_", " ")}</Chip>)}
          </p>
        )}
      </div>

      <div className="p-5">
        <h3 className="text-[1.05rem] font-semibold">{t("dcSteps")}</h3>
        {d.fix_steps.length === 0 ? <p className="mt-1 text-ink-2">{t("dcNoSteps")}</p> : (
          <ol className="mt-2 space-y-2">
            {d.fix_steps.map((s, i) => (
              <li key={s.id} className="flex gap-3">
                <span className="num mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-line-strong font-mono text-xs text-ink-2">{i + 1}</span>
                <span className="min-w-0">
                  {s.title}
                  <Link href={`/rules?q=${encodeURIComponent(s.id)}`} className="ml-2 font-mono text-xs text-ink-3 hover:text-brand">{s.id}</Link>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[1.05rem] font-semibold">{t("dcMsg")}</h3>
          <div className="inline-flex rounded-md border border-line-strong bg-sheet p-0.5" role="tablist">
            {LANGS.map(([l, k]) => (
              <button key={l} role="tab" aria-selected={tab === l} onClick={() => setTab(l)}
                className={cx("h-8 rounded-[4px] px-3 text-sm font-semibold", tab === l ? "bg-ink text-white" : "text-ink-2 hover:bg-sunk")}>{t(k)}</button>
            ))}
          </div>
        </div>
        <p lang={tab} className="mt-3 whitespace-pre-wrap rounded-md border border-line bg-paper px-4 py-3 leading-relaxed">{msg || "—"}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {msg && <CopyButton text={msg} label={t("copyWa")} />}
          {msgHint && <span className="text-sm text-ink-3">{msgHint}</span>}
        </div>
      </div>

      <p className="px-5 py-2.5 text-xs text-ink-3">{t("dcModel", { m: d.model })}</p>
    </Card>
  );
}
