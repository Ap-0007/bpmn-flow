import { describe, expect, it } from 'vitest';
import { parseBpmn, WorkflowEngine } from '../src/index.js';
import type { BpmnModel, EngineState } from '../src/index.js';
import { CALL_ACTIVITY } from './fixtures.js';

async function model(): Promise<BpmnModel> {
  return parseBpmn(CALL_ACTIVITY);
}

function caller(m: BpmnModel): WorkflowEngine {
  const process = m.processes.find((p) => p.id === 'Pedido')!;
  return new WorkflowEngine(process, { processes: m.processes });
}

describe('call activity', () => {
  it('executes the referenced process and comes back', async () => {
    const m = await model();
    const eng = caller(m);
    let charged = false;
    eng.registerHandler('Cobrar', () => {
      charged = true;
      return { cobrado: true };
    });

    let snap = await eng.start();
    // Paused inside the called process, not in the caller.
    expect(charged).toBe(true);
    expect(snap.tokens.find((t) => t.waiting)?.nodeId).toBe('ConfirmarCobranca');

    snap = await eng.completeTask(snap.tokens.find((t) => t.waiting)!.id);
    expect(snap.status).toBe('completed');
    expect(snap.completedNodes).toEqual(expect.arrayContaining(['CobrancaEnd', 'Enviar', 'End']));
    expect(snap.variables.cobrado).toBe(true);
  });

  it('is a pass-through when the called process is not available', async () => {
    const m = await model();
    const process = m.processes.find((p) => p.id === 'Pedido')!;
    // No `processes` option: the engine cannot resolve "Cobranca".
    const snap = await new WorkflowEngine(process).start();
    expect(snap.status).toBe('completed');
    expect(snap.completedNodes).toContain('Enviar');
    expect(snap.completedNodes).not.toContain('CobrancaEnd');
  });

  it('survives a restart while inside the called process', async () => {
    const m = await model();
    const process = m.processes.find((p) => p.id === 'Pedido')!;
    const first = caller(m);
    first.registerHandler('Cobrar', () => undefined);
    await first.start();

    const state = JSON.parse(JSON.stringify(first.getState())) as EngineState;
    const second = WorkflowEngine.restore(process, state, { processes: m.processes });
    const pending = second.tasks()[0]!;
    expect(pending.nodeId).toBe('ConfirmarCobranca');

    const snap = await second.completeTask(pending.tokenId);
    expect(snap.status).toBe('completed');
  });
});
