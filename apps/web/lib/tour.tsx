"use client";
// First-run guided tour. Mounted by the shell on app pages. Opens on ?tour=1, on the first visit
// (no localStorage "pfd.tour.done"), and whenever the window fires "pfd:tour" (the "?" button).
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useT, type Key } from "@/lib/i18n";
import { Button } from "@/lib/ui";

const DONE = "pfd.tour.done";
const STEPS: { target: string; title: Key; body: Key }[] = [
  { target: "nav-today", title: "tr1t", body: "tr1d" },
  { target: "nav-claims", title: "tr2t", body: "tr2d" },
  { target: "new-claim", title: "tr3t", body: "tr3d" },
  { target: "search", title: "tr4t", body: "tr4d" },
  { target: "help", title: "tr5t", body: "tr5d" },
];
const CARD_W = 320, GAP = 12, PAD = 6;

/** Visible box of the step's anchor, or null (missing / hidden, e.g. the sidebar on a phone). */
function findRect(target: string) {
  const els = document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`);
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return r;
  }
  return null;
}

export function Tour() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const url = new URL(location.href);
    let seen = true;
    try { seen = !!localStorage.getItem(DONE); } catch {}
    if (url.searchParams.has("tour") || !seen) {
      setI(0); setOpen(true);
      if (url.searchParams.has("tour")) { url.searchParams.delete("tour"); history.replaceState(history.state, "", url); }
    }
    const show = () => { setI(0); setOpen(true); };
    window.addEventListener("pfd:tour", show);
    return () => window.removeEventListener("pfd:tour", show);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    try { localStorage.setItem(DONE, "1"); } catch {}
  }, []);

  // follow the anchor on resize / scroll
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => setRect(findRect(STEPS[i].target));
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open, i]);

  useEffect(() => { if (open) card.current?.focus(); }, [open, i]);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") setI((n) => Math.min(n + 1, STEPS.length - 1));
      else if (e.key === "ArrowLeft") setI((n) => Math.max(n - 1, 0));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open, close]);

  if (!open) return null;
  const step = STEPS[i], last = i === STEPS.length - 1;

  // card position: below the anchor if it fits, else above; clamped inside the viewport. No anchor → centred.
  let style: React.CSSProperties;
  if (rect) {
    const vw = window.innerWidth, vh = window.innerHeight, w = Math.min(CARD_W, vw - 24);
    const left = Math.max(12, Math.min(rect.left + rect.width / 2 - w / 2, vw - w - 12));
    const below = rect.bottom + PAD + GAP;
    style = below + 190 < vh ? { left, top: below, width: w } : { left, bottom: vh - rect.top + PAD + GAP, width: w };
    // sidebar items: put the card to the right of the item instead of covering the nav below it
    if (rect.right + PAD + GAP + w < vw && rect.left < 260) style = { left: rect.right + PAD + GAP, top: Math.max(12, rect.top - 8), width: w };
  } else {
    style = { left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: `min(${CARD_W}px, calc(100vw - 24px))` };
  }

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {rect ? (
        // spotlight: one box over the anchor; its huge shadow is the backdrop
        <div className="pointer-events-none fixed rounded-md ring-2 ring-ink ring-offset-2 ring-offset-paper transition-all duration-200"
          style={{ left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2, boxShadow: "0 0 0 9999px rgb(27 34 48 / 0.42)" }} />
      ) : <div className="fixed inset-0 bg-ink/40" />}
      <button className="fixed inset-0 cursor-default" aria-label={t("trSkip")} tabIndex={-1} onClick={close} />

      <div ref={card} tabIndex={-1} style={style}
        className="fixed rounded-lg border border-line bg-sheet p-4 shadow-[var(--shadow-pop)] outline-none">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-ink-3">{t("trStep", { n: i + 1, total: STEPS.length })}</p>
          <button onClick={close} className="-mr-1.5 flex size-8 items-center justify-center rounded-md text-ink-3 hover:bg-sunk hover:text-ink" aria-label={t("close")}>
            <X className="size-4" />
          </button>
        </div>
        <h2 id="tour-title" className="mt-1 text-[1.05rem] font-semibold leading-snug">{t(step.title)}</h2>
        <p className="mt-1 text-[0.95rem] text-ink-2">{t(step.body)}</p>
        <div className="mt-4 flex items-center gap-2">
          <span className="mr-auto flex gap-1" aria-hidden>
            {STEPS.map((_, n) => <span key={n} className={`h-1 w-4 rounded-full ${n <= i ? "bg-brand" : "bg-line-strong"}`} />)}
          </span>
          {!last && <Button variant="ghost" size="sm" onClick={close}>{t("trSkip")}</Button>}
          {i > 0 && <Button variant="secondary" size="sm" onClick={() => setI(i - 1)}>{t("trBack")}</Button>}
          <Button size="sm" onClick={() => (last ? close() : setI(i + 1))}>{last ? t("trDone") : t("trNext")}</Button>
        </div>
      </div>
    </div>
  );
}
