"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ErrorBox } from "@/lib/ui";

export default function Login() {
  const [passcode, setPasscode] = useState("");
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api<{ demo: boolean }>("/health", { noRedirect: true }).then((h) => setDemo(!!h.demo)).catch(() => {}); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api("/auth/login", { method: "POST", body: JSON.stringify({ passcode }), noRedirect: true });
      location.href = "/";
    } catch {
      setError("Wrong passcode. Please try again.");
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-10 max-w-sm space-y-4">
      <h1>PF Desk</h1>
      <label className="block font-semibold">Passcode
        <input type="password" className="inp mt-1" value={passcode} onChange={(e) => setPasscode(e.target.value)} autoFocus />
      </label>
      {demo && <p className="rounded-lg bg-yellow-100 p-2">demo passcode: <b>demo</b></p>}
      <ErrorBox error={error} />
      <button className="btn w-full" disabled={busy || !passcode}>{busy ? "Checking…" : "Log in"}</button>
    </form>
  );
}
