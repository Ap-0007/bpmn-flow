/**
 * Timer definitions: turning what the diagram says into a due date.
 *
 * BPMN timers come in three shapes — a duration (`PT5M`), an absolute date
 * (`2026-08-20T10:00:00Z`) and a cycle (`R3/PT10M`). The engine has no clock of
 * its own: it computes a due date and waits for {@link WorkflowEngine.tick}.
 */

const DURATION =
  /^P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
/** Calendar-agnostic approximations, enough for scheduling a wait. */
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

/**
 * Parses an ISO-8601 duration into milliseconds. Months and years are
 * approximated (30 and 365 days), which is accurate enough for a wait and
 * avoids dragging in a calendar library.
 *
 * Returns `undefined` for anything it cannot read.
 */
export function parseIsoDuration(text: string): number | undefined {
  const match = DURATION.exec(text.trim());
  if (!match || match[0] === 'P') return undefined;
  const [, years, months, weeks, days, hours, minutes, seconds] = match;
  const value = (part: string | undefined): number => (part ? Number(part) : 0);
  return (
    value(years) * YEAR +
    value(months) * MONTH +
    value(weeks) * WEEK +
    value(days) * DAY +
    value(hours) * HOUR +
    value(minutes) * MINUTE +
    value(seconds) * SECOND
  );
}

/**
 * Resolves a timer definition to an absolute due date in epoch milliseconds.
 *
 * - duration (`PT5M`) — relative to `now`
 * - date (`2026-08-20T10:00:00Z`) — used as is
 * - cycle (`R3/PT10M`) — only the interval is honoured; the engine fires once
 *
 * Returns `undefined` when the definition cannot be understood, so the caller
 * can fall back to waiting for an explicit signal.
 */
export function resolveTimerDueAt(definition: string, now: number): number | undefined {
  const text = definition.trim();
  if (!text) return undefined;

  if (text.startsWith('R')) {
    const interval = text.slice(text.indexOf('/') + 1);
    return interval === text ? undefined : resolveTimerDueAt(interval, now);
  }
  if (text.startsWith('P')) {
    const duration = parseIsoDuration(text);
    return duration === undefined ? undefined : now + duration;
  }
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? undefined : parsed;
}
