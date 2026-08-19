import { describe, expect, it } from 'vitest';
import { parseBpmn, WorkflowEngine } from '../src/index.js';
import type { ProcessModel } from '../src/index.js';
import { COMPLEX_GATEWAY, CONDITIONAL_CATCH, MULTI_EVENT_DEFINITIONS } from './fixtures.js';

const T0 = Date.parse('2026-08-18T12:00:00.000Z');

async function process(xml: string): Promise<ProcessModel> {
  return (await parseBpmn(xml)).processes[0]!;
}

describe('conditional event', () => {
  it('fires as soon as the condition holds', async () => {
    const eng = new WorkflowEngine(await process(CONDITIONAL_CATCH), {
      variables: { saldo: 20 },
    });
    let snap = await eng.start();
    // Both branches are parked: the user task and the conditional event.
    expect(snap.tokens.filter((t) => t.waiting)).toHaveLength(2);
    expect(snap.completedNodes).not.toContain('Liberar');

    const deposit = eng.tasks({ nodeId: 'Depositar' })[0]!;
    snap = await eng.completeTask(deposit.tokenId, { saldo: 150 });

    expect(snap.completedNodes).toContain('Liberar');
    expect(snap.status).toBe('completed');
  });

  it('stays parked while the condition is false', async () => {
    const eng = new WorkflowEngine(await process(CONDITIONAL_CATCH), {
      variables: { saldo: 20 },
    });
    let snap = await eng.start();
    const deposit = eng.tasks({ nodeId: 'Depositar' })[0]!;
    snap = await eng.completeTask(deposit.tokenId, { saldo: 30 });

    expect(snap.status).toBe('waiting');
    expect(snap.tokens.filter((t) => t.waiting)).toHaveLength(1);
    expect(snap.completedNodes).not.toContain('Liberar');
  });
});

describe('complex gateway', () => {
  it('fires the join when the activation condition holds (quorum of 2)', async () => {
    const eng = new WorkflowEngine(await process(COMPLEX_GATEWAY));
    let snap = await eng.start();
    expect(eng.tasks()).toHaveLength(3);

    snap = await eng.completeTask(eng.tasks({ nodeId: 'VotoA' })[0]!.tokenId);
    expect(snap.completedNodes).not.toContain('Decidir');

    snap = await eng.completeTask(eng.tasks({ nodeId: 'VotoB' })[0]!.tokenId);
    // Two of three arrived: quorum reached, the third is no longer required.
    expect(snap.completedNodes).toContain('Decidir');
  });
});

describe('an event with several definitions', () => {
  it('arms the timer and answers to the message name', async () => {
    let now = T0;
    const eng = new WorkflowEngine(await process(MULTI_EVENT_DEFINITIONS), { now: () => now });
    await eng.start();
    expect(eng.nextTimerAt()).toBe(T0 + 30 * 60_000);

    const snap = await eng.signal('RespostaCliente');
    expect(snap.completedNodes).toContain('Seguir');
    expect(snap.status).toBe('completed');
  });

  it('also fires through the timer definition', async () => {
    let now = T0;
    const eng = new WorkflowEngine(await process(MULTI_EVENT_DEFINITIONS), { now: () => now });
    await eng.start();

    now += 45 * 60_000;
    const snap = await eng.tick();
    expect(snap.completedNodes).toContain('Seguir');
    expect(snap.status).toBe('completed');
  });
});
