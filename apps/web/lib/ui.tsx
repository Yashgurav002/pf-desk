"use client";
import { useState } from "react";

export function Loading({ text = "Loading…" }: { text?: string }) {
  return <p className="animate-pulse py-4 text-lg text-gray-700">⏳ {text}</p>;
}

export function ErrorBox({ error }: { error: string | null }) {
  return error ? <p className="my-2 rounded-lg border-2 border-red-700 bg-red-50 p-3 text-red-900">{error}</p> : null;
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button className="btn2" onClick={async () => { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000); }}>
      {done ? "Copied ✓" : label}
    </button>
  );
}

export function RiskBadge({ pct, band }: { pct: number | null; band?: string }) {
  if (pct == null) return <span className="text-gray-600">not checked</span>;
  // pct is a 0..1 fraction from the API; bands match the API (>=50% High, >=20% Medium; any blocker = High via `band`)
  const b = band ?? (pct >= 0.5 ? "High" : pct >= 0.2 ? "Medium" : "Low");
  const cls = b === "High" ? "bg-red-700 text-white" : b === "Medium" ? "bg-amber-400 text-black" : "bg-green-700 text-white";
  return <span className={`rounded-full px-3 py-1 font-bold ${cls}`}>{b} {Math.round(pct * 100)}%</span>;
}
