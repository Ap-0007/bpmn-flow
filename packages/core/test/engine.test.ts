import { describe, expect, it, vi } from 'vitest';
import { BpmnError, parseBpmn, WorkflowEngine } from '../src/index.js';
import type { EngineOptions, ProcessModel } from '../src/index.js';
import {
  BOUNDARY_ERROR,
  BOUNDARY_NON_INTERRUPTING,
  CATCH_WAIT,
  ENDLESS_LOOP,
  EVENT_BASED,
  EXCLUSIVE,
  INCLUSIVE,
  LINEAR,
  PARALLEL,
  SUBPROCESS,
  SUBPROCESS_ERROR,
  SUBPROCESS_TERMINATE,
  TERMINATE,
} from './fixtures.js';

async function process(xml: string): Promise<ProcessModel> {
  return (await parseBpmn(xml)).processes[0]!;
}

function engine(p: ProcessModel, options?: EngineOptions): WorkflowEngine {
  return new WorkflowEngine(p, options);
}

describe('sequence and handlers', () => {
  it('runs handlers and merges returned variables', async () => {
    const p = await process(LINEAR);
    const eng = engine(p)
      .registerHandler('Charge', () => ({ charged: true }))
      .registerHandler('Approve', (ctx) => ctx.set('approvedBy', 'alice'));
    const snap = await eng.start();
    expect(snap.status).toBe('completed');
    expect(snap.variables).toMatchObject({ charged: true, approvedBy: 'alice' });
    expect(snap.completedNodes).toContain('End');
  });

  it('parks unhandled user tasks and resumes via completeTask', async () => {
    const p = await process(LINEAR);
    const eng = engine(p).registerHandler('Charge', () => undefined);
    let snap = await eng.start();
    expect(snap.status).toBe('waiting');
    const waitingToken = snap.tokens.find((t) => t.waitReason === 'userTask')!;
    expect(waitingToken.nodeId).toBe('Approve');
    snap = await eng.completeTask(waitingToken.id, { approved: true });
    expect(snap.status).toBe('completed');
    expect(snap.variables.approved).toBe(true);
  });
});

describe('exclusive gateway', () => {
  it('routes by condition', async () => {
    const p = await process(EXCLUSIVE);
    const snap = await engine(p, { variables: { amount: 150 } }).start();
    expect(snap.completedNodes).toContain('High');
    expect(snap.completedNodes).not.toContain('Low');
  });

  it('falls back to the default flow', async () => {
    const p = await process(EXCLUSIVE);
    const snap = await engine(p, { variables: { amount: 10 } }).start();
    expect(snap.completedNodes).toContain('Low');
    expect(snap.completedNodes).not.toContain('High');
  });
});

describe('parallel gateway', () => {
  it('forks both branches and synchronizes at the join', async () => {
    const p = await process(PARALLEL);
    const order: string[] = [];
    const eng = engine(p).registerHandler('*', (ctx) => {
      order.push(ctx.node.id);
    });
    const snap = await eng.start();
    expect(snap.status).toBe('completed');
    expect(order).toEqual(expect.arrayContaining(['A', 'B']));
    // End is reached exactly once (join synchronized, no double token).
    expect(snap.history.filter((h) => h.nodeId === 'End' && h.event === 'complete')).toHaveLength(
      1,
    );
  });
});

describe('inclusive gateway', () => {
  it('takes every matching branch and joins them', async () => {
    const p = await process(INCLUSIVE);
    const snap = await engine(p, { variables: { a: true, b: true } }).start();
    expect(snap.completedNodes).toEqual(expect.arrayContaining(['X', 'Y', 'End']));
    expect(snap.completedNodes).not.toContain('Z');
    expect(snap.history.filter((h) => h.nodeId === 'End' && h.event === 'complete')).toHaveLength(
      1,
    );
  });

  it('uses the default branch when no condition matches', async () => {
    const p = await process(INCLUSIVE);
    const snap = await engine(p, { variables: { a: false, b: false } }).start();
    expect(snap.completedNodes).toContain('Z');
    expect(snap.completedNodes).not.toContain('X');
  });
});

describe('event-based gateway and catch events', () => {
  it('waits then follows the signaled branch', async () => {
    const p = await process(EVENT_BASED);
    const eng = engine(p);
    let snap = await eng.start();
    expect(snap.status).toBe('waiting');
    snap = await eng.signal('OnRejected');
    expect(snap.status).toBe('completed');
    expect(snap.completedNodes).toContain('Cancel');
    expect(snap.completedNodes).not.toContain('Ship');
  });

  it('parks an intermediate catch event until signaled', async () => {
    const p = await process(CATCH_WAIT);
    const eng = engine(p);
    let snap = await eng.start();
    expect(snap.tokens[0]?.waitReason).toBe('catchEvent');
    snap = await eng.signal('WaitMsg');
    expect(snap.status).toBe('completed');
  });
});

describe('boundary error event', () => {
  it('diverts to the boundary path when a handler throws a BpmnError', async () => {
    const p = await process(BOUNDARY_ERROR);
    const eng = engine(p).registerHandler('Pay', () => {
      throw new BpmnError('PAYMENT_FAILED');
    });
    const snap = await eng.start();
    expect(snap.status).toBe('completed');
    expect(snap.completedNodes).toContain('Refund');
    expect(snap.completedNodes).not.toContain('Fulfil');
  });

  it('takes the happy path when the handler succeeds', async () => {
    const p = await process(BOUNDARY_ERROR);
    const snap = await engine(p)
      .registerHandler('Pay', () => undefined)
      .start();
    expect(snap.completedNodes).toContain('Fulfil');
    expect(snap.completedNodes).not.toContain('Refund');
  });
});

describe('subprocess', () => {
  it('runs the child scope then continues the parent', async () => {
    const p = await process(SUBPROCESS);
    const started = vi.fn();
    const eng = engine(p);
    eng.on('activity.start', (e) => {
      if (e.nodeId === 'Sub') started();
    });
    const snap = await eng.start();
    expect(started).toHaveBeenCalledOnce();
    expect(snap.completedNodes).toEqual(expect.arrayContaining(['Inner', 'After', 'End']));
  });
});

describe('terminate end event', () => {
  it('ends the process and cancels sibling tokens', async () => {
    const p = await process(TERMINATE);
    // Work is an unhandled user task, so it parks while the other branch
    // reaches the terminate end event and cancels it.
    const snap = await engine(p).start();
    expect(snap.status).toBe('terminated');
    expect(snap.completedNodes).not.toContain('End');
  });
});

describe('auto mode', () => {
  it('drives a process with waits to completion without handlers', async () => {
    const p = await process(EVENT_BASED);
    const snap = await engine(p, { mode: 'auto' }).start();
    expect(snap.status).toBe('completed');
  });
});

describe('non-interrupting boundary event', () => {
  it('runs the boundary branch while the activity keeps waiting', async () => {
    const p = await process(BOUNDARY_NON_INTERRUPTING);
    const eng = engine(p);
    let snap = await eng.start();
    expect(snap.tokens.find((token) => token.nodeId === 'Work')?.waitReason).toBe('userTask');

    snap = await eng.signal('Escalated');
    // The boundary branch ran to its own end event...
    expect(snap.completedNodes).toContain('Notify');
    // ...and the host task is still parked, waiting for a human.
    const stillWaiting = snap.tokens.find((token) => token.nodeId === 'Work');
    expect(stillWaiting?.waiting).toBe(true);
    expect(snap.status).toBe('waiting');

    snap = await eng.completeTask(stillWaiting!.id);
    expect(snap.status).toBe('completed');
    expect(snap.completedNodes).toContain('End');
  });
});

describe('error end event inside a subprocess', () => {
  it('is caught by the error boundary attached to the subprocess', async () => {
    const p = await process(SUBPROCESS_ERROR);
    const snap = await engine(p, { variables: { ok: false } }).start();
    expect(snap.status).toBe('completed');
    expect(snap.completedNodes).toContain('Recover');
    expect(snap.completedNodes).not.toContain('After');
  });

  it('completes the subprocess normally when no error is raised', async () => {
    const p = await process(SUBPROCESS_ERROR);
    const snap = await engine(p, { variables: { ok: true } }).start();
    expect(snap.status).toBe('completed');
    expect(snap.completedNodes).toContain('After');
    expect(snap.completedNodes).not.toContain('Recover');
  });
});

describe('terminate inside a subprocess', () => {
  it('cancels only the child scope and resumes the parent', async () => {
    const p = await process(SUBPROCESS_TERMINATE);
    const snap = await engine(p).start();
    expect(snap.status).toBe('completed');
    // The sibling user task was cancelled by terminate...
    expect(snap.completedNodes).not.toContain('SubEnd');
    // ...but the parent process carried on past the subprocess.
    expect(snap.completedNodes).toContain('After');
    expect(snap.completedNodes).toContain('End');
  });
});

describe('maxSteps guard', () => {
  it('fails instead of looping forever', async () => {
    const p = await process(ENDLESS_LOOP);
    const eng = engine(p, { maxSteps: 50 });
    const errors: Error[] = [];
    eng.on('error', ({ error }) => errors.push(error));
    const snap = await eng.start();
    expect(snap.status).toBe('failed');
    expect(errors[0]?.message).toMatch(/maxSteps/);
  });
});
