import { describe, expect, it } from 'vitest';
import { BpmnError, parseBpmn, WorkflowEngine } from '../src/index.js';
import type { EngineState, ProcessModel } from '../src/index.js';
import { BOUNDARY_ERROR, LINEAR } from './fixtures.js';

const T0 = Date.parse('2026-08-18T12:00:00.000Z');

async function process(xml: string): Promise<ProcessModel> {
  return (await parseBpmn(xml)).processes[0]!;
}

describe('handler failures', () => {
  it('still fails the execution by default', async () => {
    const eng = new WorkflowEngine(await process(LINEAR));
    eng.registerHandler('Charge', () => {
      throw new Error('gateway timeout');
    });
    const snap = await eng.start();
    expect(snap.status).toBe('failed');
  });

  it('holds an incident instead, when asked to', async () => {
    const eng = new WorkflowEngine(await process(LINEAR), { onHandlerError: 'incident' });
    eng.registerHandler('Charge', () => {
      throw new Error('gateway timeout');
    });

    const snap = await eng.start();
    expect(snap.status).toBe('waiting');
    const [incident] = eng.incidentList();
    expect(incident).toMatchObject({ nodeId: 'Charge', message: 'gateway timeout', attempts: 1 });
    // The stuck activity shows up as work to be done, filterable by reason.
    expect(eng.tasks({ reason: 'incident' })).toHaveLength(1);
  });

  it('retries the configured number of times before opening an incident', async () => {
    let attempts = 0;
    const eng = new WorkflowEngine(await process(LINEAR), {
      onHandlerError: 'incident',
      retry: { attempts: 2 },
    });
    eng.registerHandler('Charge', () => {
      attempts += 1;
      throw new Error('flaky');
    });

    await eng.start();
    expect(attempts).toBe(3); // first try plus two retries
    expect(eng.incidentList()[0]?.attempts).toBe(3);
  });

  it('succeeds on a retry without leaving an incident behind', async () => {
    let attempts = 0;
    const eng = new WorkflowEngine(await process(LINEAR), {
      onHandlerError: 'incident',
      retry: { attempts: 3 },
    });
    eng.registerHandler('Charge', () => {
      attempts += 1;
      if (attempts < 3) throw new Error('flaky');
      return { charged: true };
    });

    const snap = await eng.start();
    expect(attempts).toBe(3);
    expect(eng.incidentList()).toHaveLength(0);
    expect(snap.variables.charged).toBe(true);
    expect(snap.status).toBe('waiting'); // parked on the user task, as usual
  });

  it('spaces retries with the configured delay', async () => {
    let now = T0;
    let attempts = 0;
    const eng = new WorkflowEngine(await process(LINEAR), {
      onHandlerError: 'incident',
      retry: { attempts: 1, delay: 'PT30S' },
      now: () => now,
    });
    eng.registerHandler('Charge', () => {
      attempts += 1;
      if (attempts === 1) throw new Error('flaky');
      return { charged: true };
    });

    await eng.start();
    expect(attempts).toBe(1);
    expect(eng.nextTimerAt()).toBe(T0 + 30_000);

    now += 31_000;
    const snap = await eng.tick();
    expect(attempts).toBe(2);
    expect(eng.incidentList()).toHaveLength(0);
    expect(snap.variables.charged).toBe(true);
  });

  it('can be retried and resolved by hand', async () => {
    let fixed = false;
    const eng = new WorkflowEngine(await process(LINEAR), { onHandlerError: 'incident' });
    eng.registerHandler('Charge', () => {
      if (!fixed) throw new Error('service down');
      return { charged: true };
    });

    await eng.start();
    const [incident] = eng.incidentList();

    fixed = true;
    const snap = await eng.retryTask(incident!.tokenId);
    expect(snap.variables.charged).toBe(true);
    expect(eng.incidentList()).toHaveLength(0);
  });

  it('resolveIncident skips the activity and moves on', async () => {
    const eng = new WorkflowEngine(await process(LINEAR), { onHandlerError: 'incident' });
    eng.registerHandler('Charge', () => {
      throw new Error('service down');
    });

    await eng.start();
    const [incident] = eng.incidentList();
    const snap = await eng.resolveIncident(incident!.tokenId, { chargedManually: true });

    expect(snap.variables.chargedManually).toBe(true);
    expect(snap.completedNodes).toContain('Charge');
    expect(eng.incidentList()).toHaveLength(0);
  });

  it('leaves business errors to the boundary event, not to incidents', async () => {
    const eng = new WorkflowEngine(await process(BOUNDARY_ERROR), { onHandlerError: 'incident' });
    eng.registerHandler('Pay', () => {
      throw new BpmnError('PAYMENT_FAILED');
    });

    const snap = await eng.start();
    expect(eng.incidentList()).toHaveLength(0);
    expect(snap.completedNodes).toContain('Refund');
  });

  it('survives a restart with the incident intact', async () => {
    const p = await process(LINEAR);
    const first = new WorkflowEngine(p, { onHandlerError: 'incident' });
    first.registerHandler('Charge', () => {
      throw new Error('service down');
    });
    await first.start();

    const state = JSON.parse(JSON.stringify(first.getState())) as EngineState;
    const second = WorkflowEngine.restore(p, state);
    second.registerHandler('Charge', () => ({ charged: true }));

    const [incident] = second.incidentList();
    expect(incident?.message).toBe('service down');

    const snap = await second.retryTask(incident!.tokenId);
    expect(snap.variables.charged).toBe(true);
  });
});
