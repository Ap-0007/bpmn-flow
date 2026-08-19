import { describe, expect, it } from 'vitest';
import { parseBpmn, WorkflowEngine } from '../src/index.js';
import type { ProcessModel } from '../src/index.js';
import { ESCALATION, RECEIVE_TASK } from './fixtures.js';

async function process(xml: string): Promise<ProcessModel> {
  return (await parseBpmn(xml)).processes[0]!;
}

describe('escalation', () => {
  it('reaches the boundary event of the hosting activity without stopping it', async () => {
    const eng = new WorkflowEngine(await process(ESCALATION));
    const snap = await eng.start();

    // The escalation branch ran...
    expect(snap.completedNodes).toContain('AvisarDiretoria');
    // ...and the subprocess kept going to the end, since it is non-interrupting.
    expect(snap.completedNodes).toContain('SubEnd');
    expect(snap.completedNodes).toContain('Continuar');
    expect(snap.status).toBe('completed');
  });
});

describe('receive task', () => {
  it('waits for the message and resumes with signal()', async () => {
    const eng = new WorkflowEngine(await process(RECEIVE_TASK));
    let snap = await eng.start();
    expect(snap.tokens.find((t) => t.waiting)?.waitReason).toBe('receiveTask');

    snap = await eng.signal('PagamentoConfirmado');

    expect(snap.status).toBe('completed');
    expect(snap.completedNodes).toContain('Enviar');
  });

  it('is still completable by tokenId, like any waiting task', async () => {
    const eng = new WorkflowEngine(await process(RECEIVE_TASK));
    const started = await eng.start();
    const snap = await eng.completeTask(started.tokens.find((t) => t.waiting)!.id);
    expect(snap.status).toBe('completed');
  });
});
