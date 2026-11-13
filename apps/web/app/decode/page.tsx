"use client";
import { useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { post } from "@/lib/api";
import { Button, Card, EmptyState, ErrorBox, Loading, PageHeader, Textarea } from "@/lib/ui";
import { useT } from "@/lib/i18n";
import { DecodeResult, type Decoded } from "@/components/tools/DecodeResult";

// real remark wording seen on the EPFO portal
const EXAMPLES = [
  "F/H NAME NOT MATCHING WITH BANK A/C. PL SUBMIT CORRECTED CHQ",
  "PENSION CONTRIBUTIONS RECEIVED AFTER 58 YEARS ,CLARIFY",
  "DATE OF EXIT NOT AVAILABLE",
  "CONTRIBUTION MISSING FOR A FEW MONTHS IN BETWEEN DOJ AND DOE",
];

export default function DecodePage() {
  const { t } = useT();
  const [remark, setRemark] = useState("");
  const [d, setD] = useState<Decoded | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  async function decode(text = remark) {
    if (!text.trim()) return;
    setBusy(true); setError(null); setD(null);
    try { setD(await post<Decoded>("/v1/decode", { remark: text })); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <PageHeader kicker={t("kTools")} title={t("decodeRemark")} description={t("dcDesc")} />

      <Card className="p-5">
        <form onSubmit={(e) => { e.preventDefault(); decode(); }} className="space-y-3">
          <label htmlFor="remark" className="block text-sm font-medium text-ink-2">{t("dcLabel")}</label>
          <Textarea id="remark" ref={box} rows={3} value={remark} onChange={(e) => setRemark(e.target.value)}
            placeholder={t("dcPlaceholder")} className="font-mono text-[0.95rem]" maxLength={2000} />
          <div>
            <p className="mb-1.5 text-sm text-ink-3">{t("dcExamples")}</p>
            <ul className="flex flex-wrap gap-2">
              {EXAMPLES.map((x) => (
                <li key={x}>
                  <button type="button" disabled={busy} onClick={() => { setRemark(x); decode(x); }}
                    className="rounded-md border border-line bg-paper px-2.5 py-1.5 text-left font-mono text-[0.8rem] leading-snug text-ink-2 hover:border-brand/50 hover:text-brand disabled:opacity-50">
                    {x}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
            <Button type="submit" busy={busy} disabled={!remark.trim()}>{t("dcBtn")}</Button>
            <span className="flex items-center gap-1.5 text-sm text-ink-3"><ShieldCheck className="size-4" aria-hidden />{t("dcPrivacy")}</span>
          </div>
        </form>
      </Card>

      <ErrorBox error={error} />
      {busy ? <Card className="p-5"><Loading text={t("dcBusy")} /></Card>
        : d ? (
          <div className="space-y-3">
            <DecodeResult d={d} msgHint={t("dcMsgHint")} />
            <Button variant="ghost" size="sm" onClick={() => { setD(null); setRemark(""); box.current?.focus(); }}>{t("dcAgain")}</Button>
          </div>
        ) : !error && <EmptyState title={t("dcEmptyTitle")}>{t("dcEmpty")}</EmptyState>}
    </div>
  );
}
