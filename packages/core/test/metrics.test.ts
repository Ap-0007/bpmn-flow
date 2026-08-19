import { describe, expect, it } from 'vitest';
import { parseBpmn, WorkflowEngine } from '../src/index.js';
import type { ProcessModel } from '../src/index.js';
import { LINEAR, MI_COLLECTION } from './fixtures.js';

const T0 = Date.parse('2026-08-18T12:00:00.000Z');

async function process(xml: string): Promise<ProcessModel> {
  return (await parseBpmn(xml)).processes[0]!;
}

/** Clock that ticks a fixed amount on every read, so durations are exact. */
function steppingClock(step: number): () => number {
  let current = T0 - step;
  return () => {
    current += step;
    return current;
  };
}

describe('execution metrics', () => {
  it('measures how long a human took to answer a task', async () => {
    let now = T0;
    const eng = new WorkflowEngine(await process(LINEAR), { now: () => now });
    eng.registerHandler('Charge', () => undefined);
    await eng.start();

    // The approver only answers two hours later.
    now += 2 * 3_600_000;
    await eng.completeTask(eng.tasks()[0]!.tokenId);

    const metrics = eng.metrics();
    const byId = new Map(metrics.map((m) => [m.nodeId, m]));

    expect(byId.get('Approve')).toMatchObject({ started: 1, completed: 1, totalMs: 7_200_000 });
    expect(byId.get('Charge')?.totalMs).toBe(0);
    // The slowest activity comes first: that is the bottleneck.
    expect(metrics[0]?.nodeId).toBe('Approve');
  });

  it('sums the instances of a multi-instance activity', async () => {
    const eng = new WorkflowEngine(await process(MI_COLLECTION), {
      variables: { itens: [1, 2, 3] },
      now: steppingClock(500),
    });
    eng.registerHandler('Handle', () => undefined);
    await eng.start();

    const handle = eng.metrics().find((m) => m.nodeId === 'Handle')!;
    // One entry per instance: the activity as a whole is not counted twice.
    expect(handle.started).toBe(3);
    expect(handle.completed).toBe(3);
    expect(handle.averageMs).toBe(handle.totalMs / 3);
  });

  it('keeps the history ordered by seq with real timestamps', async () => {
    const eng = new WorkflowEngine(await process(LINEAR), { now: steppingClock(10) });
    eng.registerHandler('Charge', () => undefined);
    eng.registerHandler('Approve', () => undefined);
    const snap = await eng.start();

    expect(snap.history.map((entry) => entry.seq)).toEqual(
      [...snap.history.keys()].map((index) => index),
    );
    expect(snap.history[0]?.at).toBeGreaterThanOrEqual(T0);
  });
});
