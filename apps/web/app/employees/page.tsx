"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, Users } from "lucide-react";
import { api, post, fmtDate, FORMS } from "@/lib/api";
import { Button, Card, EmptyState, ErrorBox, Input, Loading, Mono, PageHeader, Select, SkeletonRows, Stamp, cx } from "@/lib/ui";
import { useT, type Key } from "@/lib/i18n";

type Emp = {
  id: string; employer_id: string; employer_name: string; name_uan: string; uan_masked: string;
  preferred_language: string; date_of_exit: string | null; claim_count: number;
};
type Employer = { id: string; name: string; employee_count: number; open_claims?: number };
const TONE = { waiting_sheet: "neutral", validating: "warn", awaiting_payment: "brand", paid: "ok" } as const;
const LANG: Record<string, Key> = { hi: "langHi", mr: "langMr", en: "langEn" };
const LIMIT = 200;

export default function Employees() {
  const router = useRouter();
  const { t } = useT();
  const [q, setQ] = useState("");
  const [employer, setEmployer] = useState("");
  const [employers, setEmployers] = useState<Employer[] | null>(null);
  const [cycle, setCycle] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<Emp[] | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Employer[]>("/v1/employers").then(setEmployers).catch((e) => setError(e.message));
    api<{ employers: { id: string; state: string }[] }>("/v1/cycles").then((d) => setCycle(Object.fromEntries(d.employers.map((e) => [e.id, e.state])))).catch(() => {});
    // ?focus=<employeeId> (from search): open that worker's company and highlight the row
    const f = new URLSearchParams(location.search).get("focus");
    if (f) api<{ id: string; employer_id: string }>(`/v1/employees/${encodeURIComponent(f)}`).then((e) => { setEmployer(e.employer_id); setFocus(e.id); }).catch(() => {});
  }, []);
  useEffect(() => {
    setRows(null);
    const h = setTimeout(() => {
      api<Emp[]>(`/v1/employees?${new URLSearchParams({ q, employer_id: employer })}`).then(setRows).catch((e) => setError(e.message));
    }, 250);
    return () => clearTimeout(h);
  }, [q, employer]);
  useEffect(() => {
    if (!focus || !rows?.some((r) => r.id === focus)) return;
    [`w-${focus}`, `w-${focus}-m`].map((i) => document.getElementById(i)).find((el) => el?.offsetParent)?.scrollIntoView({ block: "center" });
  }, [focus, rows]);

  async function newClaim(employee_id: string, form: string) {
    setBusy(true); setError(null);
    try {
      const c = await post<{ id: string }>("/v1/claims", { employee_id, form });
      router.push(`/claims/${c.id}`);
    } catch (e: any) { setError(e.message); setBusy(false); }
  }

  const current = employers?.find((e) => e.id === employer);
  const total = employers?.reduce((s, e) => s + e.employee_count, 0);
  const claimsHref = (e: Emp) => `/claims?q=${encodeURIComponent(e.name_uan)}`;

  const formPicker = (e: Emp) => picking === e.id && (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-ink-2">{t("chooseForm")}</span>
      {FORMS.map((f) => <Button key={f} variant="secondary" size="sm" disabled={busy} onClick={() => newClaim(e.id, f)}>Form {f}</Button>)}
      {busy && <Loading text={t("creatingClaim")} />}
    </div>
  );
  const newBtn = (e: Emp) => (
    <Button variant="ghost" size="sm" className="whitespace-nowrap" aria-expanded={picking === e.id} onClick={() => setPicking(picking === e.id ? null : e.id)}>{t("newClaim")}</Button>
  );

  const CompanyBtn = ({ id, name, workers, open, state }: { id: string; name: string; workers?: number; open?: number; state?: string }) => {
    const on = employer === id;
    return (
      <button onClick={() => { setEmployer(id); setFocus(null); }} aria-current={on ? "true" : undefined}
        className={cx("relative block w-full rounded-md px-3 py-2.5 text-left transition-colors", on ? "bg-sheet shadow-[var(--shadow-card)]" : "hover:bg-sunk")}>
        {on && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-brand" aria-hidden />}
        <span className={cx("block leading-snug", on ? "font-semibold text-ink" : "text-ink-2")}>{name}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.82rem] text-ink-3">
          {workers != null && <span>{t("emWorkers", { n: workers })}</span>}
          {open != null && <span className={cx(open > 0 && "text-ink-2")}>· {open > 0 ? t("emOpen", { n: open }) : t("emNoOpen")}</span>}
          {state && <Stamp tone={TONE[state as keyof typeof TONE] ?? "neutral"} className="text-[10px]">{t(`cySt_${state}` as Key)}</Stamp>}
        </span>
      </button>
    );
  };

  return (
    <div>
      <PageHeader kicker={t("kClients")} title={t("companies")} description={t("emDesc")} />
      <ErrorBox error={error} />

      <div className="grid gap-6 md:grid-cols-[15rem_minmax(0,1fr)]">
        {/* companies */}
        <aside>
          <div className="md:hidden">
            <Select aria-label={t("employer")} value={employer} onChange={(e) => { setEmployer(e.target.value); setFocus(null); }}>
              <option value="">{t("emAll")}</option>
              {employers?.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.employee_count})</option>)}
            </Select>
          </div>
          <nav className="hidden space-y-0.5 md:block" aria-label={t("companies")}>
            {!employers ? <SkeletonRows rows={6} /> : <>
              <CompanyBtn id="" name={t("emAll")} workers={total} />
              <div className="my-2 border-t border-line" />
              {employers.map((e) => <CompanyBtn key={e.id} id={e.id} name={e.name} workers={e.employee_count} open={e.open_claims} state={cycle[e.id]} />)}
            </>}
          </nav>
        </aside>

        {/* workers */}
        <section className="min-w-0">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[1.05rem] font-semibold">{current?.name ?? t("emAll")}</h2>
              {rows && <p className="text-sm text-ink-3">{t("emWorkers", { n: rows.length })}{cycle[employer] && <> · {t("emCycle")}: {t(`cySt_${cycle[employer]}` as Key)}</>}</p>}
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
              <Input className="pl-9" placeholder={t("emFilter")} aria-label={t("emFilter")} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>

          {!rows ? <Card className="p-4"><SkeletonRows rows={8} /></Card> : rows.length === 0 ? (
            <EmptyState icon={<Users className="size-5" />} title={t("noEmployees")} />
          ) : (
            <Card className="overflow-hidden">
              {/* desktop ledger */}
              <table className="hidden w-full text-[0.95rem] md:table">
                <thead className="bg-sunk text-left font-mono text-[11px] uppercase tracking-[0.1em] text-ink-3">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">{t("emName")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("emUan")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("emLang")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("emExit")}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{t("emClaims")}</th>
                    <th className="px-4 py-2.5"><span className="sr-only">{t("newClaim")}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <FocusRows key={e.id} on={focus === e.id} id={e.id} extra={picking === e.id && <td colSpan={6} className="px-4 pb-3">{formPicker(e)}</td>}>
                      <td className="px-4 py-2.5">
                        <Link href={claimsHref(e)} className="font-medium text-ink hover:text-brand">{e.name_uan}</Link>
                        {!employer && <span className="block text-sm text-ink-3">{e.employer_name}</span>}
                      </td>
                      <td className="px-4 py-2.5"><Mono className="text-ink-2">{e.uan_masked}</Mono></td>
                      <td className="px-4 py-2.5 text-ink-2">{LANG[e.preferred_language] ? t(LANG[e.preferred_language]) : e.preferred_language}</td>
                      <td className="px-4 py-2.5">{e.date_of_exit ? <span className="num whitespace-nowrap font-mono text-sm text-ink-2">{fmtDate(e.date_of_exit)}</span> : <span className="text-sm text-ink-3">{t("emWorking")}</span>}</td>
                      <td className="px-4 py-2.5 text-right">
                        {e.claim_count > 0
                          ? <Link href={claimsHref(e)} className="whitespace-nowrap text-sm font-medium text-brand hover:underline">{t("emSeeClaims")} <Mono>({e.claim_count})</Mono></Link>
                          : <span className="num font-mono text-sm text-ink-3">0</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right">{newBtn(e)}</td>
                    </FocusRows>
                  ))}
                </tbody>
              </table>
              {/* phone list */}
              <ul className="divide-y divide-line md:hidden">
                {rows.map((e) => (
                  <li key={e.id} id={`w-${e.id}-m`} className={cx("space-y-2 px-4 py-3", focus === e.id && "bg-brand-tint")}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link href={claimsHref(e)} className="font-medium">{e.name_uan}</Link>
                        <p className="text-sm text-ink-3"><Mono>{e.uan_masked}</Mono> · {LANG[e.preferred_language] ? t(LANG[e.preferred_language]) : e.preferred_language}
                          {e.date_of_exit && <> · {t("leftOn", { d: fmtDate(e.date_of_exit) })}</>}</p>
                        {!employer && <p className="text-sm text-ink-3">{e.employer_name}</p>}
                      </div>
                      {newBtn(e)}
                    </div>
                    {e.claim_count > 0 && <Link href={claimsHref(e)} className="inline-flex min-h-10 items-center text-sm font-medium text-brand">{t("emSeeClaims")} ({e.claim_count})</Link>}
                    {formPicker(e)}
                  </li>
                ))}
              </ul>
              {rows.length >= LIMIT && <p className="border-t border-line px-4 py-2.5 text-sm text-ink-3">{t("emShowing", { n: LIMIT })}</p>}
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}

function FocusRows({ id, on, children, extra }: { id: string; on: boolean; children: React.ReactNode; extra: React.ReactNode }) {
  return (
    <>
      <tr id={`w-${id}`} className={cx("border-t border-line", on ? "bg-brand-tint" : "hover:bg-[#fcfbf8]")}>{children}</tr>
      {extra && <tr className={on ? "bg-brand-tint" : undefined}>{extra}</tr>}
    </>
  );
}
