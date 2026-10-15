// API-side Temporal client (PRD §13). Lazy and optional: if Temporal is unreachable we log once, skip the start/signal,
// and the request still succeeds. The DB stays the source of truth for cycle state.
import { Client, Connection, WorkflowExecutionAlreadyStartedError, WorkflowNotFoundError, WorkflowIdReusePolicy } from '@temporalio/client';

const env = process.env;
export const TASK_QUEUE = 'pfdesk';
export const NAMESPACE = env.TEMPORAL_NAMESPACE || 'default';
export const connOpts = () => ({ address: env.TEMPORAL_ADDRESS || 'localhost:7233', apiKey: env.TEMPORAL_API_KEY || undefined, tls: env.TEMPORAL_API_KEY ? true : undefined });
// CYCLE_FAST=N: a cycle/follow-up "day" lasts N seconds (tests and demos). 0/unset = real calendar.
export const SECONDS_PER_DAY = Number(env.CYCLE_FAST || 0);

export const cycleId = (employerId: string, wageMonth: string) => `cycle-${employerId}-${wageMonth.slice(0, 7)}`;
export const claimWfId = (claimId: string) => `claim-${claimId}`;

let client: Client | null = null, retryAt = 0, warned = false;
function down(err: unknown) {
  if (!warned) console.warn(`[temporal] unavailable (${(err as Error).message}); cycles and follow-ups continue without it`);
  warned = true; client = null; retryAt = Date.now() + 30_000;
}
async function get() {
  if (client || Date.now() < retryAt) return client;
  try {
    const connection = await Connection.connect({ ...connOpts(), connectTimeout: 2000 });
    client = new Client({ connection, namespace: NAMESPACE });
    if (warned) console.log('[temporal] connected');
    warned = false;
  } catch (err) { down(err); }
  return client;
}
async function safe<T>(fn: (c: Client) => Promise<T>): Promise<T | null> {
  const c = await get();
  if (!c) return null;
  try { return await c.connection.withDeadline(Date.now() + 5000, () => fn(c)); }
  catch (err) {
    if (err instanceof WorkflowNotFoundError || err instanceof WorkflowExecutionAlreadyStartedError) return null;
    down(err);
    return null;
  }
}

/** 'started' | 'running' (already running) | null (Temporal down). */
export async function startCycle(employerId: string, wageMonth: string) {
  return safe(async (c) => {
    try {
      await c.workflow.start('MonthlyCycleWorkflow', {
        taskQueue: TASK_QUEUE, workflowId: cycleId(employerId, wageMonth), args: [employerId, wageMonth.slice(0, 7), SECONDS_PER_DAY],
        workflowIdReusePolicy: WorkflowIdReusePolicy.ALLOW_DUPLICATE_FAILED_ONLY,
      });
      return 'started';
    } catch (err) {
      if (err instanceof WorkflowExecutionAlreadyStartedError) return 'running';
      throw err;
    }
  });
}
/** salaryUploaded starts the cycle if it isn't running yet; paid only signals a running one. */
export const cycleUploaded = (employerId: string, wageMonth: string, uploadId: string) =>
  safe((c) => c.workflow.signalWithStart('MonthlyCycleWorkflow', {
    taskQueue: TASK_QUEUE, workflowId: cycleId(employerId, wageMonth), args: [employerId, wageMonth.slice(0, 7), SECONDS_PER_DAY],
    workflowIdReusePolicy: WorkflowIdReusePolicy.ALLOW_DUPLICATE_FAILED_ONLY, signal: 'salaryUploaded', signalArgs: [uploadId],
  }).then(() => true));
export const cyclePaid = (employerId: string, wageMonth: string) =>
  safe((c) => c.workflow.getHandle(cycleId(employerId, wageMonth)).signal('paid').then(() => true));
export const cycleStatus = (employerId: string, wageMonth: string) =>
  safe((c) => c.workflow.getHandle(cycleId(employerId, wageMonth)).describe().then((d) => d.status.name));

/** Called on every claim status change: submitted/resubmitted start the follow-up if needed. */
export const claimStatusChanged = (claimId: string, status: string) =>
  safe((c) => ['submitted', 'resubmitted'].includes(status)
    ? c.workflow.signalWithStart('ClaimFollowUpWorkflow', {
      taskQueue: TASK_QUEUE, workflowId: claimWfId(claimId), args: [claimId, SECONDS_PER_DAY], signal: 'statusChanged', signalArgs: [status],
    }).then(() => true)
    : c.workflow.getHandle(claimWfId(claimId)).signal('statusChanged', status).then(() => true));
