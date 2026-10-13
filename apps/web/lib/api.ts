// Browser-side fetch helper. Paths are API paths (e.g. "/v1/today"); Next rewrites /api/* to the API.
export async function api<T = any>(path: string, init: RequestInit & { noRedirect?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (typeof init.body === "string") headers["content-type"] ??= "application/json";
  const res = await fetch("/api" + path, { credentials: "same-origin", ...init, headers });
  if (res.status === 401 && !init.noRedirect && typeof window !== "undefined" && location.pathname !== "/login") {
    location.href = "/login";
    throw new Error("Please log in");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || data?.message || `Request failed (${res.status})`);
  return data as T;
}

export const post = <T = any>(path: string, body: unknown) => api<T>(path, { method: "POST", body: JSON.stringify(body) });

export type ClaimRow = {
  id: string; form: string; status: string; employee_id: string; employee_name: string; employer_name: string;
  risk_pct: number | null; submitted_at: string | null; eta_high: number | null; rejection_remark: string | null; issue_count: number | null;
};
export type Issue = { code: string; severity: "blocker" | "warning"; field: string; message: string; fix: string; rule_id: string };
export type Precheck = {
  issues: Issue[]; risk_pct: number; risk_band: "Low" | "Medium" | "High"; risk_model: string;
  eta: { days: number; low: number; high: number; model: string; likely_date: string; range: [string, string] } | null;
};
export type Rule = {
  id: string; title: string; body: string; applies_to: string[]; source: string; params: object | null;
  last_verified_by: string | null; last_verified_at: string | null; score?: number;
};

export const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

export const STATUSES = ["draft", "checked", "submitted", "under_process", "settled", "rejected", "resubmitted", "closed"];
export const NEXT_STATUS: Record<string, string[]> = {
  draft: ["checked", "submitted"], checked: ["submitted"], submitted: ["under_process", "settled", "rejected"],
  under_process: ["settled", "rejected"], resubmitted: ["under_process", "settled", "rejected"],
  rejected: ["resubmitted", "closed"], settled: ["closed"], closed: [],
};
export const FORMS = ["19", "10C", "31", "13", "10D", "5IF"];
