"use client";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, fmtDate } from "@/lib/api";
import { Loading } from "@/lib/ui";

type Info = { first_name: string; language: string; claims: { form: string; status: string; submitted_at: string | null; likely_date: string | null; range: [string, string] | null }[] };
type Msg = { role: "user" | "assistant"; content: string };
type Lang = "hi" | "mr" | "en";

const T: Record<Lang, { hello: (n: string) => string; claims: string; likely: string; ask: string; send: string; chips: string[]; thinking: string; escalated: string }> = {
  hi: {
    hello: (n) => `नमस्ते ${n} जी`, claims: "आपके PF क्लेम", likely: "संभावित तारीख", ask: "अपना सवाल लिखें…", send: "भेजें",
    chips: ["Mera PF kab aayega?", "Claim reject kyun hua?", "Kaun se documents chahiye?"], thinking: "जवाब तैयार हो रहा है…",
    escalated: "आपका सवाल आपके PF सलाहकार को भेज दिया गया है। वे आपसे संपर्क करेंगे।",
  },
  mr: {
    hello: (n) => `नमस्कार ${n}`, claims: "तुमचे PF क्लेम", likely: "अपेक्षित तारीख", ask: "तुमचा प्रश्न लिहा…", send: "पाठवा",
    chips: ["Maza PF kevha yeil?", "Claim reject ka zala?", "Konte documents lagtil?"], thinking: "उत्तर तयार होत आहे…",
    escalated: "तुमचा प्रश्न तुमच्या PF सल्लागारांना पाठवला आहे. ते तुमच्याशी संपर्क करतील.",
  },
  en: {
    hello: (n) => `Hello ${n}`, claims: "Your PF claims", likely: "Likely by", ask: "Type your question…", send: "Send",
    chips: ["When will my PF arrive?", "Why was my claim rejected?", "Which documents do I need?"], thinking: "Preparing an answer…",
    escalated: "Your question has been sent to your PF consultant. They will contact you.",
  },
};

export default function Help() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<Info | null>(null);
  const [bad, setBad] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>("hi");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/v1/help/${token}`).then(async (r) => {
      if (r.status === 404 || r.status === 410) return setBad("This help link is not valid or has expired. Please ask your PF consultant for a new link.");
      if (!r.ok) return setBad("Something went wrong. Please try again later.");
      const d: Info = await r.json();
      setInfo(d);
      if (d.language === "hi" || d.language === "mr" || d.language === "en") setLang(d.language);
    }).catch(() => setBad("Could not connect. Please check your internet and try again."));
  }, [token]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  async function ask(q: string) {
    if (!q.trim() || busy) return;
    const history = msgs;
    setMsgs([...history, { role: "user", content: q }]); setText(""); setBusy(true);
    try {
      const r = await api<{ answer: string; escalated: boolean }>(`/v1/help/${token}/message`, { method: "POST", noRedirect: true, body: JSON.stringify({ text: q, history }) });
      setMsgs((m) => [...m, { role: "assistant", content: r.answer + (r.escalated ? `\n\n${T[lang].escalated}` : "") }]);
    } catch (e: any) {
      setMsgs((m) => [...m, { role: "assistant", content: `⚠️ ${e.message}` }]);
    } finally { setBusy(false); }
  }

  if (bad) return <p className="mx-auto mt-10 max-w-md rounded-xl border-2 border-red-700 p-4 text-lg">{bad}</p>;
  if (!info) return <Loading />;
  const t = T[lang];

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="mb-0">{t.hello(info.first_name)}</h1>
        <div className="flex gap-1">
          {(["hi", "mr", "en"] as const).map((l) => (
            <button key={l} onClick={() => setLang(l)} className={`rounded-lg px-3 py-1 font-semibold ${lang === l ? "bg-blue-700 text-white" : "border-2 border-gray-500"}`}>
              {{ hi: "हिं", mr: "मरा", en: "EN" }[l]}
            </button>
          ))}
        </div>
      </div>

      <section className="card">
        <h2 className="mt-0">{t.claims}</h2>
        {info.claims.length === 0 ? <p>—</p> : info.claims.map((c, i) => (
          <p key={i} className="border-b border-gray-200 py-2 last:border-0">
            <b>Form {c.form}</b> · {c.status}{c.submitted_at && ` · ${fmtDate(c.submitted_at)}`}
            {c.likely_date && <><br />{t.likely}: <b>{c.likely_date}</b>{c.range && ` (${c.range[0]}–${c.range[1]})`}</>}
          </p>
        ))}
      </section>

      <div className="space-y-3">
        {msgs.map((m, i) => (
          <div key={i} className={`max-w-[85%] whitespace-pre-wrap rounded-2xl p-3 text-lg ${m.role === "user" ? "ml-auto bg-blue-700 text-white" : "bg-gray-100"}`}>{m.content}</div>
        ))}
        {busy && <Loading text={t.thinking} />}
        <div ref={end} />
      </div>

      <div className="flex flex-wrap gap-2">
        {t.chips.map((c) => <button key={c} className="rounded-full border-2 border-blue-700 px-3 py-1 text-blue-800" disabled={busy} onClick={() => ask(c)}>{c}</button>)}
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(text); }}>
        <input className="inp" placeholder={t.ask} value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn" disabled={busy || !text.trim()}>{t.send}</button>
      </form>
    </div>
  );
}
