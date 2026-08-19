import { describe, expect, it } from 'vitest';
import { parseBpmn, parseIsoDuration, resolveTimerDueAt, WorkflowEngine } from '../src/index.js';
import type { EngineState, ProcessModel } from '../src/index.js';
import { TIMER_BOUNDARY, TIMER_CATCH } from './fixtures.js';

const T0 = Date.parse('2026-08-18T12:00:00.000Z');

async function process(xml: string): Promise<ProcessModel> {
  return (await parseBpmn(xml)).processes[0]!;
}

/** Clock the test drives by hand, so no timer test ever sleeps. */
function clock(start = T0): { now: () => number; advance: (ms: number) => void } {
  let current = start;
  return {
    now: () => current,
    advance: (ms) => {
      current += ms;
    },
  };
}

describe('ISO-8601 durations', () => {
  it('parses the shapes BPMN uses', () => {
    expect(parseIsoDuration('PT5M')).toBe(5 * 60_000);
    expect(parseIsoDuration('PT1H30M')).toBe(90 * 60_000);
    expect(parseIsoDuration('P1D')).toBe(86_400_000);
    expect(parseIsoDuration('P1DT2H')).toBe(86_400_000 + 2 * 3_600_000);
  });

  it('rejects what it cannot read', () => {
    expect(parseIsoDuration('5 minutos')).toBeUndefined();
    expect(parseIsoDuration('P')).toBeUndefined();
  });

  it('resolves durations, dates and cycles to a due date', () => {
    expect(resolveTimerDueAt('PT5M', T0)).toBe(T0 + 5 * 60_000);
    expect(resolveTimerDueAt('2026-08-20T10:00:00.000Z', T0)).toBe(
      Date.parse('2026-08-20T10:00:00.000Z'),
    );
    // Only the interval of a cycle is honoured; the engine fires once.
    expect(resolveTimerDueAt('R3/PT10M', T0)).toBe(T0 + 10 * 60_000);
    expect(resolveTimerDueAt('daqui a pouco', T0)).toBeUndefined();
  });
});

describe('timer catch event', () => {
  it('waits until the due date and then continues on its own', async () => {
    const { now, advance } = clock();
    const eng = new WorkflowEngine(await process(TIMER_CATCH), { now });

    let snap = await eng.start();
    expect(snap.status).toBe('waiting');
    expect(eng.nextTimerAt()).toBe(T0 + 5 * 60_000);

    advance(60_000); // one minute later: still not due
    snap = await eng.tick();
    expect(snap.status).toBe('waiting');

    advance(5 * 60_000);
    snap = await eng.tick();
    expect(snap.status).toBe('completed');
    expect(snap.completedNodes).toContain('After');
    expect(eng.dueTimers()).toHaveLength(0);
  });

  it('can still be fired early by an explicit signal', async () => {
    const { now } = clock();
    const eng = new WorkflowEngine(await process(TIMER_CATCH), { now });
    await eng.start();
    const snap = await eng.signal('Wait5m');
    expect(snap.status).toBe('completed');
    expect(eng.dueTimers()).toHaveLength(0);
  });
});

describe('timer boundary event', () => {
  it('interrupts a task whose deadline passed', async () => {
    const { now, advance } = clock();
    const eng = new WorkflowEngine(await process(TIMER_BOUNDARY), { now });

    let snap = await eng.start();
    const approving = snap.tokens.find((t) => t.nodeId === 'Approve')!;
    expect(approving.waiting).toBe(true);

    advance(3 * 3_600_000); // three hours: past the two-hour deadline
    snap = await eng.tick();

    expect(snap.status).toBe('completed');
    expect(snap.completedNodes).toContain('Escalate');
    expect(snap.completedNodes).not.toContain('End');
  });

  it('is disarmed when the task is completed in time', async () => {
    const { now, advance } = clock();
    const eng = new WorkflowEngine(await process(TIMER_BOUNDARY), { now });

    const started = await eng.start();
    const snap = await eng.completeTask(started.tokens.find((t) => t.waiting)!.id);
    expect(snap.status).toBe('completed');
    expect(eng.dueTimers()).toHaveLength(0);

    advance(10 * 3_600_000);
    const after = await eng.tick();
    expect(after.completedNodes).not.toContain('Escalate');
  });
});

describe('timers across a restart', () => {
  it('keeps the due date and fires it in the restored engine', async () => {
    const { now, advance } = clock();
    const p = await process(TIMER_CATCH);
    const first = new WorkflowEngine(p, { now });
    await first.start();

    const state = JSON.parse(JSON.stringify(first.getState())) as EngineState;
    const second = WorkflowEngine.restore(p, state, {});
    expect(second.nextTimerAt()).toBe(T0 + 5 * 60_000);

    advance(6 * 60_000);
    const snap = await second.tick(now());
    expect(snap.status).toBe('completed');
  });
});
