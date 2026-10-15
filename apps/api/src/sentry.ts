// Sentry tracing (PRD §7): errors + a span per model call. No-op unless SENTRY_DSN_API is set.
// Only metadata goes to Sentry (kind, model, latency, token counts) — never prompts, answers or identifiers.
import * as Sentry from '@sentry/node';

export const sentryOn = !!process.env.SENTRY_DSN_API;
if (sentryOn) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN_API,
    environment: process.env.DEMO_MODE === 'true' ? 'demo' : 'local',
    tracesSampleRate: 1.0,
    sendDefaultPii: false,
  });
}

export function span<T>(name: string, op: string, attrs: Record<string, string | number>, fn: () => Promise<T>): Promise<T> {
  return sentryOn ? Sentry.startSpan({ name, op, attributes: attrs }, fn) : fn();
}

export function capture(err: unknown) {
  if (sentryOn) Sentry.captureException(err);
}
