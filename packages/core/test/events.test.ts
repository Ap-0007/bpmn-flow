import { describe, expect, it } from 'vitest';
import { BpmnError, parseBpmn, WorkflowEngine } from '../src/index.js';
import type { ProcessModel } from '../src/index.js';
import {
  EVENT_SUBPROCESS_ERROR,
  EVENT_SUBPROCESS_NON_INTERRUPTING,
  EVENT_SUBPROCESS_SIGNAL,
  LINK_EVENTS,
  SIGNAL_BROADCAST,
} from './fixtures.js';

async function process(xml: string): Promise<ProcessModel> {
  return (await parseBpmn(xml)).processes[0]!;
}

describe('link events', () => {
  it('jumps from the throw event to the matching catch event', async () => {
    const snap = await new WorkflowEngine(await process(LINK_EVENTS)).start();
    expect(snap.status).toBe('completed');
    expect(snap.completedNodes).toEqual(
      expect.arrayContaining(['Prepare', 'GoTo', 'Here', 'Finish', 'End']),
    );
    expect(snap.completedNodes).not.toContain('Skipped');
  });
});

describe('signal broadcast', () => {
  it('resumes every catch event subscribed to the same signal', async () => {
    const eng = new WorkflowEngine(await process(SIGNAL_BROADCAST));
    let snap = await eng.start();
    expect(snap.tokens.filter((t) => t.waiting)).toHaveLength(2);

    snap = await eng.signal('Publicado'); // one signal, both branches move
    expect(snap.status).toBe('completed');
    expect(snap.completedNodes).toEqual(expect.arrayContaining(['WaitA', 'WaitB', 'End']));
  });
});

describe('event subprocess', () => {
  it('interrupting: cancels the running work and takes over', async () => {
    const eng = new WorkflowEngine(await process(EVENT_SUBPROCESS_SIGNAL));
    let refunded = false;
    eng.registerHandler('Refund', () => {
      refunded = true;
    });

    let snap = await eng.start();
    expect(snap.tokens.find((t) => t.nodeId === 'Work')?.waiting).toBe(true);

    snap = await eng.signal('PedidoCancelado');
    expect(refunded).toBe(true);
    expect(snap.status).toBe('completed');
    expect(snap.completedNodes).toContain('CancelEnd');
    // The interrupted task never reached its end event.
    expect(snap.completedNodes).not.toContain('End');
  });

  it('non-interrupting: runs alongside the activity, which keeps waiting', async () => {
    const eng = new WorkflowEngine(await process(EVENT_SUBPROCESS_NON_INTERRUPTING));
    let snap = await eng.start();
    const working = snap.tokens.find((t) => t.nodeId === 'Work')!;

    snap = await eng.signal('ClientePerguntou');
    expect(snap.completedNodes).toContain('Answer');
    expect(snap.status).toBe('waiting');
    expect(snap.tokens.find((t) => t.nodeId === 'Work')?.waiting).toBe(true);

    snap = await eng.completeTask(working.id);
    expect(snap.status).toBe('completed');
    expect(snap.completedNodes).toContain('End');
  });

  it('catches an error nobody else handles', async () => {
    const eng = new WorkflowEngine(await process(EVENT_SUBPROCESS_ERROR));
    eng.registerHandler('Reserve', () => {
      throw new BpmnError('SEM_ESTOQUE');
    });
    let notified = false;
    eng.registerHandler('Notify', () => {
      notified = true;
    });

    const snap = await eng.start();
    expect(notified).toBe(true);
    expect(snap.status).toBe('completed');
    expect(snap.completedNodes).toContain('ErrorEnd');
    expect(snap.completedNodes).not.toContain('End');
  });

  it('does not start twice for the same trigger', async () => {
    const eng = new WorkflowEngine(await process(EVENT_SUBPROCESS_NON_INTERRUPTING));
    let answers = 0;
    eng.registerHandler('Answer', () => {
      answers += 1;
    });
    await eng.start();
    await eng.signal('ClientePerguntou');
    await eng.signal('ClientePerguntou');
    // The second signal arrives while the first run already finished, so it
    // starts a fresh instance — but never two at once.
    expect(answers).toBe(2);
  });
});
