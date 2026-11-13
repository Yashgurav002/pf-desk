"use client";
// PF Desk component kit. Rules of use: apps/web/DESIGN.md. Keep this file the only place visual primitives live.
import Link from "next/link";
import { useState, type ComponentProps, type ReactNode } from "react";
import { AlertTriangle, Check, CircleHelp, Copy, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export { cx };

// ---------- buttons ----------
type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";
const V: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-hover shadow-[inset_0_-1px_0_rgb(0_0_0/0.15)]",
  secondary: "border border-line-strong bg-sheet text-ink hover:bg-sunk",
  ghost: "text-ink-2 hover:bg-sunk hover:text-ink",
  danger: "border border-danger/40 bg-sheet text-danger hover:bg-danger-tint",
};
const S: Record<Size, string> = { sm: "h-8 px-2.5 text-sm gap-1.5", md: "h-10 px-3.5 gap-2", lg: "h-12 px-5 text-[1.05rem] gap-2" };
export const buttonClass = (variant: Variant = "primary", size: Size = "md") =>
  cx("inline-flex shrink-0 select-none items-center justify-center rounded-md font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50", V[variant], S[size]);

export function Button({ variant = "primary", size = "md", busy, icon, children, className, disabled, ...p }:
  ComponentProps<"button"> & { variant?: Variant; size?: Size; busy?: boolean; icon?: ReactNode }) {
  return (
    <button className={cx(buttonClass(variant, size), className)} disabled={disabled || busy} {...p}>
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

export function LinkButton({ variant = "primary", size = "md", icon, children, className, ...p }:
  ComponentProps<typeof Link> & { variant?: Variant; size?: Size; icon?: ReactNode }) {
  return <Link className={cx(buttonClass(variant, size), className)} {...p}>{icon}{children}</Link>;
}

// ---------- surfaces ----------
export function Card({ className, children, ...p }: ComponentProps<"div">) {
  return <div className={cx("rounded-lg border border-line bg-sheet shadow-[var(--shadow-card)]", className)} {...p}>{children}</div>;
}

/** Page title row: small kicker above, title, optional one-line description, actions on the right. */
export function PageHeader({ kicker, title, description, actions }: { kicker?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
      <div className="min-w-0">
        {kicker && <p className="mb-1 font-mono text-xs font-medium uppercase tracking-[0.12em] text-ink-3">{kicker}</p>}
        <h1 className="text-[1.65rem] font-semibold leading-tight">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function SectionTitle({ children, count, action }: { children: ReactNode; count?: number; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <h2 className="text-[1.05rem] font-semibold">
        {children}{count != null && <span className="ml-2 font-mono text-sm font-medium text-ink-3">{count}</span>}
      </h2>
      {action}
    </div>
  );
}

// ---------- stamps, chips, risk ----------
type Tone = "neutral" | "brand" | "ok" | "warn" | "danger";
const TONE: Record<Tone, string> = {
  neutral: "border-ink-3/60 text-ink-2", brand: "border-brand/70 text-brand", ok: "border-ok/70 text-ok",
  warn: "border-warn/70 text-warn", danger: "border-danger/70 text-danger",
};
/** Rubber-stamp status mark. Short uppercase words only: SETTLED, REJECTED, CHECK, DRAFT. */
export function Stamp({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx("stamp -rotate-[0.6deg]", TONE[tone], className)}>{children}</span>;
}

const STATUS_TONE: Record<string, Tone> = {
  draft: "neutral", checked: "brand", submitted: "brand", under_process: "brand", resubmitted: "brand",
  settled: "ok", rejected: "danger", closed: "neutral",
};
export function StatusStamp({ status }: { status: string }) {
  const { t } = useT();
  return <Stamp tone={STATUS_TONE[status] ?? "neutral"}>{t(`st_${status}` as never) || status.replace("_", " ")}</Stamp>;
}

export function Chip({ children, className, ...p }: ComponentProps<"span">) {
  return <span className={cx("inline-flex items-center gap-1 rounded-sm bg-sunk px-1.5 py-0.5 text-[0.82rem] text-ink-2", className)} {...p}>{children}</span>;
}

/** Rejection risk as a short meter + words, never a colour alone. pct is 0..1 from the API. */
export function RiskMeter({ pct, band, compact }: { pct: number | null; band?: string; compact?: boolean }) {
  const { t } = useT();
  if (pct == null) return <span className="text-sm text-ink-3">{t("notChecked")}</span>;
  const b = band ?? (pct >= 0.5 ? "High" : pct >= 0.2 ? "Medium" : "Low");
  const tone = b === "High" ? "bg-danger" : b === "Medium" ? "bg-warn" : "bg-ok";
  const text = b === "High" ? "text-danger" : b === "Medium" ? "text-warn" : "text-ok";
  const word = t(b === "High" ? "riskHigh" : b === "Medium" ? "riskMedium" : "riskLow");
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className={cx("relative h-1.5 overflow-hidden rounded-full bg-sunk", compact ? "w-10" : "w-16")} aria-hidden>
        <span className={cx("absolute inset-y-0 left-0 rounded-full", tone)} style={{ width: `${Math.max(6, Math.round(pct * 100))}%` }} />
      </span>
      <span className={cx("text-sm font-semibold", text)}>{word}</span>
      <span className="num font-mono text-sm text-ink-2">{Math.round(pct * 100)}%</span>
    </span>
  );
}
/** @deprecated use RiskMeter */
export const RiskBadge = RiskMeter;

/** Identifiers (UAN, account, IFSC) in mono so digits are easy to read aloud on the phone. */
export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("num font-mono text-[0.92em] tracking-wide", className)}>{children}</span>;
}

// ---------- numbers ----------
export function Stat({ label, value, hint, tone = "neutral", href, icon }: { label: ReactNode; value: ReactNode; hint?: ReactNode; tone?: Tone; href?: string; icon?: ReactNode }) {
  const bar = { neutral: "bg-line-strong", brand: "bg-brand", ok: "bg-ok", warn: "bg-warn", danger: "bg-danger" }[tone];
  const body = (
    <>
      <span className={cx("absolute inset-y-3 left-0 w-[3px] rounded-r", bar)} aria-hidden />
      <span className="flex items-center gap-2 text-sm font-medium text-ink-2">{icon}{label}</span>
      <span className="num mt-1 block font-mono text-3xl font-semibold leading-none text-ink">{value}</span>
      {hint && <span className="mt-1.5 block text-sm text-ink-3">{hint}</span>}
    </>
  );
  const cls = "relative block rounded-lg border border-line bg-sheet px-4 py-3.5 shadow-[var(--shadow-card)]";
  return href ? <Link href={href} className={cx(cls, "transition-colors hover:border-line-strong hover:bg-[#fcfbf8]")}>{body}</Link> : <div className={cls}>{body}</div>;
}

// ---------- states ----------
export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong px-6 py-10 text-center">
      {icon && <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-sunk text-ink-3">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-ink-2">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <span className={cx("skeleton block h-4", className)} aria-hidden />;
}
export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className={i % 3 === 2 ? "h-4 w-2/3" : "h-4 w-full"} />)}
    </div>
  );
}

export function Loading({ text }: { text?: string }) {
  const { t } = useT();
  return <p className="flex items-center gap-2 py-3 text-ink-2" role="status"><Loader2 className="size-4 animate-spin text-brand" aria-hidden />{text ?? t("loading")}</p>;
}

export function ErrorBox({ error }: { error: string | null }) {
  return error ? (
    <p className="my-3 flex items-start gap-2 rounded-md border border-danger/30 bg-danger-tint px-3 py-2.5 text-danger" role="alert">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />{error}
    </p>
  ) : null;
}

export function Notice({ tone = "brand", children, icon }: { tone?: "brand" | "warn" | "ok"; children: ReactNode; icon?: ReactNode }) {
  const c = { brand: "border-brand/25 bg-brand-tint text-ink", warn: "border-warn/30 bg-warn-tint text-ink", ok: "border-ok/30 bg-ok-tint text-ink" }[tone];
  return <div className={cx("flex items-start gap-2.5 rounded-md border px-3.5 py-3", c)}>{icon}<div className="min-w-0">{children}</div></div>;
}

// ---------- form ----------
export const inputClass = "h-10 w-full rounded-md border border-line-strong bg-sheet px-3 text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-ink-3">{hint}</span>}
    </label>
  );
}
export function Input({ className, ...p }: ComponentProps<"input">) { return <input className={cx(inputClass, className)} {...p} />; }
export function Select({ className, ...p }: ComponentProps<"select">) { return <select className={cx(inputClass, "pr-8", className)} {...p} />; }
export function Textarea({ className, ...p }: ComponentProps<"textarea">) {
  return <textarea className={cx(inputClass, "h-auto min-h-24 py-2 leading-relaxed", className)} {...p} />;
}

// ---------- small behaviours ----------
export function CopyButton({ text, label, variant = "secondary", size = "md" }: { text: string; label?: string; variant?: Variant; size?: Size }) {
  const { t } = useT();
  const [done, setDone] = useState(false);
  return (
    <Button variant={variant} size={size} icon={done ? <Check className="size-4" /> : <Copy className="size-4" />}
      onClick={async () => { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000); }}>
      {done ? t("copied") : label ?? t("copy")}
    </Button>
  );
}

/** "Why?" disclosure for model/technical detail — keeps the main line plain. Native <details>, no JS. */
export function Why({ label, children }: { label?: ReactNode; children: ReactNode }) {
  const { t } = useT();
  return (
    <details className="group inline-block align-middle text-sm [&_summary::-webkit-details-marker]:hidden">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-ink-3 hover:text-brand">
        <CircleHelp className="size-3.5" aria-hidden />{label ?? t("why")}
      </summary>
      <div className="mt-2 max-w-md rounded-md border border-line bg-sheet p-3 text-ink-2 shadow-[var(--shadow-pop)]">{children}</div>
    </details>
  );
}

/** Horizontal step tracker (claim journey). state per step: done | current | todo | bad. */
export type StepState = "done" | "current" | "todo" | "bad";
export function Steps({ steps }: { steps: { label: ReactNode; state: StepState }[] }) {
  return (
    <ol className="flex w-full items-center gap-0 overflow-x-auto pb-1 text-sm" aria-label="Progress">
      {steps.map((s, i) => (
        <li key={i} className="flex min-w-0 flex-1 items-center last:flex-none" aria-current={s.state === "current" ? "step" : undefined}>
          <span className="flex items-center gap-2 whitespace-nowrap">
            <span className={cx("flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
              s.state === "done" && "border-ok bg-ok text-white",
              s.state === "current" && "border-brand bg-brand text-white ring-4 ring-brand/15",
              s.state === "bad" && "border-danger bg-danger text-white",
              s.state === "todo" && "border-line-strong bg-sheet text-ink-3")}>
              {s.state === "done" ? <Check className="size-3.5" /> : s.state === "bad" ? "!" : i + 1}
            </span>
            <span className={cx(s.state === "todo" ? "text-ink-3" : "font-medium text-ink", s.state === "bad" && "text-danger")}>{s.label}</span>
          </span>
          {i < steps.length - 1 && <span className={cx("mx-3 h-px min-w-6 flex-1", s.state === "done" ? "bg-ok/60" : "bg-line-strong")} aria-hidden />}
        </li>
      ))}
    </ol>
  );
}
