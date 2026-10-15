// Temporal workflows (PRD §13). Deterministic: only @temporalio/workflow imports; activities are type-only.
import { proxyActivities, defineSignal, defineQuery, setHandler, condition, sleep, workflowInfo } from '@temporalio/workflow';
import type * as activities from './activities.ts';

const { loadCycle, createTask, validateSalary, archiveCycle, claimInfo, recordOutcome } = proxyActivities<typeof activities>({
  startToCloseTimeout: '20 seconds',
  retry: { maximumAttempts: 3, initialInterval: '2 seconds', backoffCoefficient: 2 },
});

export const salaryUploaded = defineSignal<[string]>('salaryUploaded');
export const paid = defineSignal('paid');
export const statusChanged = defineSignal<[string]>('statusChanged');
type Stage = 'scheduled' | 'waiting_sheet' | 'chasing' | 'validating' | 'awaiting_payment' | 'payment_overdue' | 'paid' | 'unpaid';
export const stageQuery = defineQuery<Stage>('stage');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY = 864e5;
// wait until a deadline; a past deadline just checks the condition now
const until = (fn: () => boolean, t: number) => (t > Date.now() ? condition(fn, t - Date.now()) : Promise.resolve(fn()));

/** One per employer per wage month ('YYYY-MM'); workflow id cycle-<employerId>-<YYYY-MM>. secondsPerDay > 0 = CYCLE_FAST test timing. */
export async function MonthlyCycleWorkflow(employerId: string, wageMonth: string, secondsPerDay = 0) {
  let uploadId: string | null = null, isPaid = false, stage: Stage = 'scheduled';
  setHandler(salaryUploaded, (id) => { uploadId = id; });
  setHandler(paid, () => { isPaid = true; });
  setHandler(stageQuery, () => stage);
  const wf = workflowInfo().workflowId;
  const er = await loadCycle(employerId, wageMonth);
  uploadId ??= er.upload_id; // sheet may have arrived before the cycle was started
  isPaid ||= er.paid;

  const [y, m] = wageMonth.split('-').map(Number);
  const label = `${MONTHS[m - 1]} ${y}`;
  const t0 = Date.now();
  // 10:00 IST (04:30 UTC) on `day` of the filing month, i.e. the month after the wage month (Date.UTC month index m = next month)
  const at = (day: number) => (secondsPerDay ? t0 + day * secondsPerDay * 1000 : Date.UTC(y, m, day, 4, 30));
  const dueDate = `${er.due_day} ${MONTHS[m % 12]}`;
  const task = (step: string, title: string, body: string | null, due: number) =>
    createTask({ key: `${wf}:${step}`, kind: 'cycle', ref_id: employerId, title: `${title} — ${er.name}, ${label}`, body, due_at: new Date(due).toISOString() });

  if (at(er.cycle_day) > Date.now()) await sleep(at(er.cycle_day) - Date.now());
  await task('request', 'Request salary sheet',
    `Namaste${er.contact_name ? ` ${er.contact_name}` : ''} ji, please send the ${label} salary sheet (UAN or employee code, name, gross, Basic+DA, days worked) so we can pay PF before ${dueDate}. Thank you — PF office`,
    at(er.due_day - 5));
  stage = 'waiting_sheet';
  if (!(await until(() => uploadId != null, at(er.due_day - 5)))) {
    await task('chase', 'HIGH: Chase salary sheet', `Reminder: the ${label} salary sheet is still pending. PF is due on ${dueDate}; please send it today.`, at(er.due_day - 2));
    stage = 'chasing';
    await until(() => uploadId != null, at(er.due_day - 2));
  }
  let reviewed = false;
  const review = async () => {
    if (reviewed || !uploadId) return;
    reviewed = true;
    const before = stage;
    stage = 'validating';
    const v = await validateSalary(uploadId);
    await task('review', 'Review validation', v.summary, at(er.due_day));
    stage = before === 'validating' ? 'awaiting_payment' : before;
  };
  // a sheet that arrives late (even after the due date) is still validated while we wait for payment
  const waitPaid = async (deadline: number) => {
    for (;;) {
      const ok = await until(() => isPaid || (uploadId != null && !reviewed), deadline);
      if (uploadId != null && !reviewed) { await review(); if (!isPaid && deadline > Date.now()) continue; }
      return ok && isPaid;
    }
  };
  await review();
  stage = 'awaiting_payment';
  if (!(await waitPaid(at(er.due_day)))) {
    await task('due', 'URGENT: Payment due today', `PF for ${label} is due today (${dueDate}). Pay the challan and tap "Mark paid".`, at(er.due_day));
    stage = 'payment_overdue';
    await waitPaid(Date.now() + (secondsPerDay ? secondsPerDay * 1000 : DAY) * 7);
  }
  if (isPaid) await archiveCycle(employerId, wageMonth);
  stage = isPaid ? 'paid' : 'unpaid';
  return stage;
}

/** Started when a claim is submitted; status changes arrive as 'statusChanged'. Workflow id claim-<claimId>. */
export async function ClaimFollowUpWorkflow(claimId: string, secondsPerDay = 0) {
  const inbox: string[] = [];
  setHandler(statusChanged, (s) => { inbox.push(s); });
  const wf = workflowInfo().workflowId;
  const day = secondsPerDay ? secondsPerDay * 1000 : DAY;
  for (let n = 1; ; n++) {
    const c = await claimInfo(claimId);
    if (!(await condition(() => inbox.length > 0, (c.eta_high ?? 20) * day))) {
      await createTask({ key: `${wf}:overdue:${n}`, kind: 'claim', ref_id: claimId, title: `Claim overdue vs estimate — check portal (Form ${c.form}, ${c.first_name})` });
      continue;
    }
    const s = inbox.shift()!;
    // decoding happens in the UI (consultant pastes the remark); no LLM calls from activities
    if (s === 'rejected') await recordOutcome(claimId);
    if (s === 'rejected') await createTask({ key: `${wf}:rejected:${n}`, kind: 'claim', ref_id: claimId, title: `Fix and resubmit (Form ${c.form}, ${c.first_name}) — decode the remark on the claim page` });
    if (s === 'settled' || s === 'closed') {
      if (s === 'settled') await recordOutcome(claimId);
      return s;
    }
  }
}
