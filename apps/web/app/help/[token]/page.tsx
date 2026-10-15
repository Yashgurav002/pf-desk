"use client";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, fmtDate } from "@/lib/api";
import { Loading } from "@/lib/ui";
import { useT, type Key } from "@/lib/i18n";
import Voice from "./voice";

type Info = { first_name: string; language: string; claims: { form: string; status: string; submitted_at: string | null; likely_date: string | null; range: [string, string] | null }[] };
type Msg = { role: "user" | "assistant"; content: string };

// Quick questions are sent to the API as typed, so they stay here rather than in the UI dictionary.
const CHIPS = {
  hi: ["Mera PF kab aayega?", "Claim reject kyun hua?", "Kaun se documents chahiye?"],
  mr: ["Maza PF kevha yeil?", "Claim reject ka zala?", "Konte documents lagtil?"],
  en: ["When will my PF arrive?", "Why was my claim rejected?", "Which documents do I need?"],
};

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
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

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

  if (bad) return <p className="mx-auto mt-10 max-w-md rounded-xl border-2 border-red-700 p-4 text-lg">{t(bad)}</p>;
  if (!info) return <Loading />;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="mb-0">{t("hello", { n: info.first_name })}</h1>

      <Voice token={token} />
      <section className="card">
        <h2 className="mt-0">{t("yourClaims")}</h2>
        {info.claims.length === 0 ? <p>—</p> : info.claims.map((c, i) => (
          <p key={i} className="border-b border-gray-200 py-2 last:border-0">
            <b>Form {c.form}</b> · {c.status}{c.submitted_at && ` · ${fmtDate(c.submitted_at)}`}
            {c.likely_date && <><br />{t("likely")}: <b>{c.likely_date}</b>{c.range && ` (${c.range[0]}–${c.range[1]})`}</>}
          </p>
        ))}
      </section>

      <div className="space-y-3">
        {msgs.map((m, i) => (
          <div key={i} className={`max-w-[85%] whitespace-pre-wrap rounded-2xl p-3 text-lg ${m.role === "user" ? "ml-auto bg-blue-700 text-white" : "bg-gray-100"}`}>{m.content}</div>
        ))}
        {busy && <Loading text={t("thinking")} />}
        <div ref={end} />
      </div>

      <div className="flex flex-wrap gap-2">
        {CHIPS[lang].map((c) => <button key={c} className="rounded-full border-2 border-blue-700 px-3 py-1 text-blue-800" disabled={busy} onClick={() => ask(c)}>{c}</button>)}
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(text); }}>
        <input className="inp" placeholder={t("ask")} value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn" disabled={busy || !text.trim()}>{t("send")}</button>
      </form>
    </div>
  );
}
