"use client";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, Lock, SendHorizontal } from "lucide-react";
import { api, fmtDate } from "@/lib/api";
import { Card, SkeletonRows, StatusStamp, cx } from "@/lib/ui";
import { LangToggle, useT, type Key } from "@/lib/i18n";
import { Mark } from "@/components/landing/mark";
import Voice from "./voice";

type Info = { first_name: string; language: string; claims: { form: string; status: string; submitted_at: string | null; likely_date: string | null; range: [string, string] | null }[] };
type Msg = { role: "user" | "assistant"; content: string };

// Quick questions are sent to the API as typed, so they stay here rather than in the UI dictionary.
const CHIPS = {
  hi: ["Mera PF kab aayega?", "Claim reject kyun hua?", "Kaun se documents chahiye?"],
  mr: ["Maza PF kevha yeil?", "Claim reject ka zala?", "Konte documents lagtil?"],
  en: ["When will my PF arrive?", "Why was my claim rejected?", "Which documents do I need?"],
};

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-line bg-paper">
        <div className="mx-auto flex h-14 max-w-xl items-center justify-between gap-3 px-4">
          <Mark href={null} small />
          <LangToggle />
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 pb-10 pt-5">{children}</main>
    </div>
  );
}

export default function Help() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<Info | null>(null);
  const [bad, setBad] = useState<Key | null>(null);
  const { t, lang, setDefault } = useT();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDefault("hi"); // until we know the employee's preferred language
    fetch(`/api/v1/help/${token}`).then(async (r) => {
      if (r.status === 404 || r.status === 410) return setBad("badLink");
      if (!r.ok) return setBad("wentWrong");
      const d: Info = await r.json();
      setInfo(d);
      if (d.language === "hi" || d.language === "mr" || d.language === "en") setDefault(d.language);
    }).catch(() => setBad("noNet"));
  }, [token]);
  useEffect(() => { if (msgs.length || busy) end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, busy]);

  async function ask(q: string) {
    if (!q.trim() || busy) return;
    const history = msgs;
    setMsgs([...history, { role: "user", content: q }]); setText(""); setBusy(true);
    try {
      const r = await api<{ answer: string; escalated: boolean }>(`/v1/help/${token}/message`, { method: "POST", noRedirect: true, body: JSON.stringify({ text: q, history }) });
      setMsgs((m) => [...m, { role: "assistant", content: r.answer + (r.escalated ? `\n\n${t("escalated")}` : "") }]);
    } catch (e: any) {
      setMsgs((m) => [...m, { role: "assistant", content: `⚠️ ${e.message}` }]);
    } finally { setBusy(false); }
  }

  if (bad) return (
    <Frame>
      <p className="mt-6 flex items-start gap-3 rounded-lg border border-danger/30 bg-danger-tint p-4 text-[1.05rem] text-ink" role="alert">
        <AlertTriangle className="mt-1 size-5 shrink-0 text-danger" aria-hidden />{t(bad)}
      </p>
    </Frame>
  );
  if (!info) return <Frame><div className="mt-4"><SkeletonRows rows={6} /></div></Frame>;

  return (
    <Frame>
      <h1 className="text-[1.65rem] font-semibold leading-tight">{t("hello", { n: info.first_name })}</h1>
      <p className="mt-1 flex items-start gap-1.5 text-sm text-ink-3"><Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />{t("hpPrivate")}</p>

      <section className="mt-5" aria-labelledby="claims-h">
        <h2 id="claims-h" className="mb-2 font-mono text-xs font-medium uppercase tracking-[0.12em] text-ink-3">{t("yourClaims")}</h2>
        {info.claims.length === 0 ? <Card className="p-4 text-ink-2">{t("hpNoClaims")}</Card> : (
          <div className="space-y-3">
            {info.claims.map((c, i) => (
              <Card key={i} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[1.1rem] font-semibold">{t("hpForm", { f: c.form })}</p>
                    {c.submitted_at && <p className="text-sm text-ink-3">{t("hpFiled", { d: fmtDate(c.submitted_at) })}</p>}
                  </div>
                  <StatusStamp status={c.status} />
                </div>
                {c.likely_date && (
                  <div className="mt-3 border-t border-line pt-3">
                    <p className="text-sm text-ink-2">{t("hpPaidBy")}</p>
                    <p className="num text-[1.4rem] font-semibold leading-tight text-ink">{fmtDate(c.likely_date)}</p>
                    {c.range && <p className="text-sm text-ink-3">{t("hpBetween", { a: fmtDate(c.range[0]), b: fmtDate(c.range[1]) })}</p>}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      <div className="mt-4"><Voice token={token} /></div>

      <section className="mt-7" aria-labelledby="ask-h">
        <h2 id="ask-h" className="text-[1.15rem] font-semibold">{t("hpAskTitle")}</h2>
        <p className="mt-0.5 text-[0.95rem] text-ink-2">{t("hpAskSub")}</p>

        {(msgs.length > 0 || busy) && (
          <div className="mt-4 space-y-3" aria-live="polite">
            {msgs.map((m, i) => (
              <div key={i} className={cx("max-w-[88%] whitespace-pre-wrap rounded-lg px-3.5 py-2.5 text-[1.05rem] leading-relaxed",
                m.role === "user" ? "ml-auto bg-brand text-white" : "border border-line bg-sheet text-ink shadow-[var(--shadow-card)]")}>{m.content}</div>
            ))}
            {busy && <p className="flex items-center gap-2 text-ink-2" role="status"><Loader2 className="size-4 animate-spin text-brand" aria-hidden />{t("thinking")}</p>}
            <div ref={end} />
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2">
          {CHIPS[lang].map((c) => (
            <button key={c} disabled={busy} onClick={() => ask(c)}
              className="min-h-11 rounded-md border border-line-strong bg-sheet px-3.5 py-2 text-left text-[1.02rem] text-brand hover:border-brand hover:bg-brand-tint disabled:opacity-50">
              {c}
            </button>
          ))}
        </div>
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(text); }}>
          <input aria-label={t("ask")} placeholder={t("ask")} value={text} onChange={(e) => setText(e.target.value)}
            className="h-12 min-w-0 flex-1 rounded-md border border-line-strong bg-sheet px-3.5 text-[1.05rem] text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15" />
          <button disabled={busy || !text.trim()} className="inline-flex h-12 shrink-0 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-white hover:bg-brand-hover disabled:opacity-50">
            <SendHorizontal className="size-4" aria-hidden />{t("send")}
          </button>
        </form>
      </section>

      <p className="mt-10 border-t border-line pt-4 text-xs leading-relaxed text-ink-3">{t("footer")}</p>
    </Frame>
  );
}
