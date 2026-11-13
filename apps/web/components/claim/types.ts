import type { Precheck } from "@/lib/api";

export type Detail = {
  claim: {
    id: string; form: string; purpose: string | null; status: string; created_at: string; submitted_at: string | null; settled_at: string | null;
    rejected_at: string | null; rejection_remark: string | null; decoded: Decoded | null; risk_pct: number | null; risk_model: string | null;
    eta_days: number | null; eta_low: number | null; eta_high: number | null; eta_model: string | null;
  };
  employee: Record<string, string | boolean | null>;
  precheck: Precheck | null;
};
export type Decoded = {
  category: string; fields_involved: string[]; fix_steps: { id: string; title: string }[];
  employee_message_hi: string; employee_message_mr: string; employee_message_en: string; model: string;
};
export type Said = { text: string; model: string };
