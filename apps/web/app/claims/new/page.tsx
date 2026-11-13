"use client";
// New claim in two calm steps: find the worker, choose the form. Then the claim page runs Pre-check (?run=precheck).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, Upload } from "lucide-react";
import { api, post, fmtDate, FORMS } from "@/lib/api";
import { useT, type Key } from "@/lib/i18n";
import { Button, Card, ErrorBox, Field, Input, Mono, PageHeader, Skeleton, cx } from "@/lib/ui";

type Worker = { id: string; name_uan: string; employer_name: string; uan_masked: string; date_of_exit: string | null; claim_count: number };

export default function NewClaim() {
  const { t } = useT();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Worker[] | null>(null);
  const [worker, setWorker] = useState<Worker | null>(null);
  const [form, setForm] = useState("");
  const [purpose, setPurpose] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const term = q.trim(), ready = /^\d{4,}$/.test(term) || (term.length >= 2 && !/^\d+$/.test(term));
  useEffect(() => {
    if (!ready) { setFound(null); return; }
    setFound(null);
    const id = setTimeout(() => api<Worker[]>(`/v1/employees?q=${encodeURIComponent(term)}`).then((r) => setFound(r.slice(0, 8))).catch((e) => setError(e.message)), 250);
    return () => clearTimeout(id);
  }, [term, ready]);

  async function create() {
    if (!worker || !form) return setError(t("ncPickForm"));
    setBusy(true); setError(null);
    try {
      const c = await post<{ id: string }>("/v1/claims", { employee_id: worker.id, form, purpose: form === "31" ? purpose.trim() || null : null });
      router.push(`/claims/${c.id}?run=precheck`);
    } catch (e: any) { setError(e.message); setBusy(false); }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title={t("newClaim")} description={t("ncDesc")} />

      {/* step 1 */}
      <section className="mb-6">
        <h2 className="mb-2 text-[1.05rem] font-semibold">1. {t("ncStep1")}</h2>
        {worker ? (
          <Card className="flex items-center gap-3 px-4 py-3">
            <WorkerLine w={worker} />
            <Button variant="ghost" size="sm" onClick={() => { setWorker(null); setForm(""); }}>{t("ncChange")}</Button>
          </Card>
        ) : (
          <>
            <Field label={t("ncSearch")} hint={!ready ? t("ncSearchHint") : undefined}>
              <span className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
                <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} className="h-12 pl-9 text-[1.05rem]" autoComplete="off" />
              </span>
            </Field>
            {ready && (
              <Card className="mt-2 overflow-hidden">
                {!found ? <div className="space-y-3 p-4" aria-busy="true"><Skeleton className="w-2/3" /><Skeleton className="w-1/2" /></div>
                  : found.length === 0 ? <p className="px-4 py-3 text-ink-2">{t("ncNoMatch", { q: term })}</p>
                  : <ul className="divide-y divide-line">
                      {found.map((w) => (
                        <li key={w.id}>
                          <button onClick={() => setWorker(w)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#fcfbf8]">
                            <WorkerLine w={w} />
                          </button>
                        </li>
                      ))}
                    </ul>}
              </Card>
            )}
            <p className="mt-4 text-sm text-ink-3">
              <Upload className="mr-1.5 inline size-4 align-[-3px]" aria-hidden />{t("ncImportHint")}{" "}
              <Link href="/import" className="whitespace-nowrap font-medium text-brand hover:underline">{t("ncImportLink")}</Link>
            </p>
          </>
        )}
      </section>

      {/* step 2 */}
      {worker && (
        <section>
          <h2 className="mb-2 text-[1.05rem] font-semibold">2. {t("ncStep2")}</h2>
          <fieldset className="overflow-hidden rounded-lg border border-line bg-sheet shadow-[var(--shadow-card)]">
            <legend className="sr-only">{t("ncStep2")}</legend>
            {FORMS.map((f) => (
              <label key={f} className={cx("flex cursor-pointer items-start gap-3 border-t border-line px-4 py-3 first:border-t-0",
                form === f ? "bg-brand-tint" : "hover:bg-[#fcfbf8]")}>
                <input type="radio" name="form" value={f} checked={form === f} onChange={() => setForm(f)} className="mt-1 size-4 accent-[var(--color-brand)]" />
                <span>
                  <span className="num block font-mono font-semibold">Form {f}</span>
                  <span className="block text-ink-2">{t(`form_${f}` as Key)}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {form === "31" && (
            <div className="mt-4"><Field label={t("ncPurpose")} hint={t("ncPurposeHint")}>
              <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} />
            </Field></div>
          )}
          <ErrorBox error={error} />
          <Button size="lg" className="mt-5" busy={busy} disabled={!form} onClick={create}>{busy ? t("ncCreating") : t("ncCreate")}</Button>
        </section>
      )}
      {!worker && <ErrorBox error={error} />}
    </div>
  );
}

function WorkerLine({ w }: { w: Worker }) {
  const { t } = useT();
  return (
    <span className="min-w-0 flex-1">
      <span className="block font-semibold">{w.name_uan}</span>
      <span className="flex flex-wrap gap-x-3 text-sm text-ink-3">
        <Mono className="text-ink-2">UAN {w.uan_masked}</Mono><span>{w.employer_name}</span>
        {w.date_of_exit && <span>{t("ncLeft", { d: fmtDate(w.date_of_exit) })}</span>}
        {w.claim_count > 0 && <span>{t("ncClaimsCount", { n: w.claim_count })}</span>}
      </span>
    </span>
  );
}
