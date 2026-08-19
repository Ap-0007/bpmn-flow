import { describe, expect, it } from 'vitest';
import { parseBpmn, WorkflowEngine } from '../src/index.js';
import type { ProcessModel } from '../src/index.js';
import { MI_WITH_BOUNDARY, TERMINATE_WITH_MI } from './fixtures.js';

const T0 = Date.parse('2026-08-18T12:00:00.000Z');

async function process(xml: string): Promise<ProcessModel> {
  return (await parseBpmn(xml)).processes[0]!;
}

describe('boundary events on a multi-instance activity', () => {
  it('a signal cancels every instance and takes the boundary path', async () => {
    const eng = new WorkflowEngine(await process(MI_WITH_BOUNDARY), {
      variables: { itens: ['a', 'b', 'c'] },
    });
    let snap = await eng.start();
    expect(snap.tokens.filter((t) => t.waiting)).toHaveLength(3);

    snap = await eng.signal('Cancelar');

    expect(snap.completedNodes).toContain('Abortar');
    expect(snap.status).toBe('completed');
    // No instance survives an interrupting boundary event.
    expect(snap.tokens.filter((t) => t.waiting)).toHaveLength(0);
    expect(snap.completedNodes).not.toContain('End');
  });

  it('a deadline on the whole activity fires through tick()', async () => {
    let now = T0;
    const eng = new WorkflowEngine(await process(MI_WITH_BOUNDARY), {
      variables: { itens: ['a', 'b'] },
      now: () => now,
    });
    await eng.start();
    expect(eng.nextTimerAt()).toBe(T0 + 3_600_000);

    now += 2 * 3_600_000;
    const snap = await eng.tick();

    expect(snap.completedNodes).toContain('Escalar');
    expect(snap.status).toBe('completed');
  });
});

describe('terminate with a multi-instance activity running', () => {
  it('cancels the instances instead of leaving them behind', async () => {
    const eng = new WorkflowEngine(await process(TERMINATE_WITH_MI), {
      variables: { itens: ['a', 'b'] },
    });
    const snap = await eng.start();

    expect(snap.status).toBe('terminated');
    expect(snap.tokens).toHaveLength(0);
    expect(eng.tasks()).toHaveLength(0);
  });
});
