"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, FileSpreadsheet, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Card, ErrorBox, Field, LinkButton, Notice, PageHeader, Select, Steps, cx, inputClass, type StepState } from "@/lib/ui";
import { useT } from "@/lib/i18n";

type Preview = { headers: string[]; rows: string[][]; suggested: Record<string, string>; fields: string[] };
type Result = { inserted: number; skipped: number; aadhaar_dropped: number };

export default function Import() {
  const { t } = useT();
  const [employers, setEmployers] = useState<{ id: string; name: string }[]>([]);
  const [employer, setEmployer] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pv, setPv] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [step, setStep] = useState(1);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api<{ id: string; name: string }[]>("/v1/employers").then(setEmployers).catch((e) => setError(e.message)); }, []);

  async function send<T>(key: string, path: string, fd: FormData): Promise<T | null> {
    setBusy(key); setError(null);
    try { return await api<T>(path, { method: "POST", body: fd }); }
    catch (e: any) { setError(e.message); return null; }
    finally { setBusy(null); }
  }

  async function preview() {
    if (!file) return;
    const fd = new FormData(); fd.append("file", file);
    setResult(null);
    const r = await send<Preview>("pv", "/v1/import/preview", fd);
    if (r) { setPv(r); setMapping(Object.fromEntries(r.headers.map((h) => [h, r.suggested[h] ?? ""]))); setStep(2); }
  }

  async function doImport() {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file); fd.append("employer_id", employer);
    fd.append("mapping", JSON.stringify(Object.fromEntries(Object.entries(mapping).filter(([, v]) => v))));
    const r = await send<Result>("imp", "/v1/import", fd);
    if (r) { setResult(r); setStep(4); }
  }
  const restart = () => { setFile(null); setPv(null); setResult(null); setStep(1); };

  const st = (n: number): StepState => (step > n ? "done" : step === n ? "current" : "todo");
  const matched = Object.values(mapping).filter(Boolean).length;
  const empName = employers.find((e) => e.id === employer)?.name;

  return (
    <div className="space-y-6">
      <PageHeader kicker={t("kTools")} title={t("importTitle")} description={t("imDesc")} />
      <Notice icon={<ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />}>{t("aadhaarNote")}</Notice>
      {step < 4 && <p className="font-mono text-sm text-ink-2 sm:hidden">{t("imStepOf", { n: step, s: t(`imStep${step}` as "imStep1") })}</p>}
      <Card className="hidden px-5 py-4 sm:block"><Steps steps={[{ label: t("imStep1"), state: st(1) }, { label: t("imStep2"), state: st(2) }, { label: t("imStep3"), state: st(3) }]} /></Card>
      <ErrorBox error={error} />

      {step === 1 && (
        <Card className="max-w-xl space-y-4 p-5">
          <Field label={t("employer")}>
            <Select value={employer} onChange={(e) => setEmployer(e.target.value)}>
              <option value="">{t("chooseEmployer")}</option>
              {employers.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
          </Field>
          <Field label={t("fileLabel")} hint={t("imFileHint")}>
            <input type="file" accept=".xlsx,.csv" className={cx(inputClass, "h-auto py-2 file:mr-3 file:rounded file:border-0 file:bg-sunk file:px-3 file:py-1.5 file:font-medium file:text-ink")}
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPv(null); setResult(null); }} />
          </Field>
          <Button busy={busy === "pv"} disabled={!file || !employer} onClick={preview}>{busy === "pv" ? t("readingFile") : t("imNext2")}</Button>
        </Card>
      )}

      {step === 2 && pv && (
        <section className="space-y-3">
          <p className="flex flex-wrap items-center gap-2 text-ink-2"><FileSpreadsheet className="size-4 text-ink-3" aria-hidden /><span className="font-medium text-ink">{file?.name}</span> → {empName}</p>
          <p className="text-ink-2">{t("imMatchHint")}</p>
          <Card className="overflow-hidden">
            <table className="w-full text-[0.95rem]">
              <thead className="bg-sunk text-left font-mono text-[11px] uppercase tracking-[0.1em] text-ink-3">
                <tr><th className="px-4 py-2.5 font-medium">{t("colInFile")}</th><th className="px-4 py-2.5 font-medium">{t("pfField")}</th></tr>
              </thead>
              <tbody>
                {pv.headers.map((h) => (
                  <tr key={h} className="border-t border-line">
                    <td className="px-4 py-2 font-medium">{h}</td>
                    <td className="px-4 py-2">
                      <Select aria-label={h} value={mapping[h] ?? ""} onChange={(e) => setMapping({ ...mapping, [h]: e.target.value })}
                        className={cx("max-w-xs font-mono text-sm", !mapping[h] && "text-ink-3")}>
                        <option value="">{t("skip")}</option>
                        {pv.fields.map((f) => <option key={f} value={f}>{f}</option>)}
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="ghost" onClick={() => setStep(1)}>{t("imBack")}</Button>
            <Button disabled={!matched} onClick={() => setStep(3)}>{t("imNext3")}</Button>
            <span className="font-mono text-sm text-ink-3">{t("imMatched", { n: matched, m: pv.headers.length })}</span>
          </div>
        </section>
      )}

      {step === 3 && pv && (
        <section className="space-y-3">
          <p className="text-ink-2">{t("imPreviewHint")}</p>
          <Card className="overflow-x-auto">
            <table className="w-full text-[0.9rem]">
              <thead className="bg-sunk text-left font-mono text-[11px] uppercase tracking-[0.1em] text-ink-3">
                <tr>{pv.headers.map((h) => <th key={h} className={cx("whitespace-nowrap px-3 py-2.5 font-medium", !mapping[h] && "text-ink-3/50 line-through")}>{mapping[h] || h}</th>)}</tr>
              </thead>
              <tbody>
                {pv.rows.slice(0, 5).map((r, i) => (
                  <tr key={i} className="border-t border-line">
                    {pv.headers.map((h, j) => <td key={h} className={cx("whitespace-nowrap px-3 py-2 font-mono text-[0.85rem]", mapping[h] ? "text-ink" : "text-ink-3/50")}>{r[j]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="ghost" onClick={() => setStep(2)}>{t("imBack")}</Button>
            <Button busy={busy === "imp"} disabled={!employer} onClick={doImport}>{busy === "imp" ? t("importing") : employer ? `${t("importBtn")} → ${empName}` : t("chooseEmployerFirst")}</Button>
          </div>
        </section>
      )}

      {step === 4 && result && (
        <Card className="max-w-xl p-5">
          <p className="flex items-center gap-2 text-[1.05rem] font-semibold text-ok"><CheckCircle2 className="size-5" aria-hidden />{t("imDone")}</p>
          <ul className="mt-3 space-y-1 text-ink-2">
            <li>{t("imported", { n: result.inserted })}</li>
            {result.skipped > 0 && <li>{t("rowsSkipped", { n: result.skipped })}</li>}
            {result.aadhaar_dropped > 0 && <li>{t("aadhaarDropped", { n: result.aadhaar_dropped })}</li>}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <LinkButton href="/employees">{t("imSeeWorkers")}</LinkButton>
            <Button variant="secondary" onClick={restart}>{t("imAnother")}</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

