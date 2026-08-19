import { describe, expect, it } from 'vitest';
import { parseBpmn, WorkflowEngine } from '../src/index.js';
import type { ProcessModel } from '../src/index.js';
import { COMPENSATION, TRANSACTION_CANCEL } from './fixtures.js';

async function process(xml: string): Promise<ProcessModel> {
  return (await parseBpmn(xml)).processes[0]!;
}

/** Records the order activities run in, so we can assert the undo order. */
function tracked(eng: WorkflowEngine, names: string[]): string[] {
  const log: string[] = [];
  for (const name of names) {
    eng.registerHandler(name, () => {
      log.push(name);
    });
  }
  return log;
}

describe('compensation', () => {
  it('undoes completed activities in reverse order', async () => {
    const eng = new WorkflowEngine(await process(COMPENSATION), {
      variables: { pago: false },
    });
    const log = tracked(eng, ['ReservarVoo', 'ReservarHotel', 'CancelarVoo', 'CancelarHotel']);

    const snap = await eng.start();

    expect(log).toEqual(['ReservarVoo', 'ReservarHotel', 'CancelarHotel', 'CancelarVoo']);
    expect(snap.status).toBe('completed');
    expect(snap.completedNodes).toContain('ViagemCancelada');
  });

  it('does not compensate when the process succeeds', async () => {
    const eng = new WorkflowEngine(await process(COMPENSATION), {
      variables: { pago: true },
    });
    const log = tracked(eng, ['ReservarVoo', 'ReservarHotel', 'CancelarVoo', 'CancelarHotel']);

    const snap = await eng.start();

    expect(log).toEqual(['ReservarVoo', 'ReservarHotel']);
    expect(snap.completedNodes).toContain('ViagemOk');
  });
});

describe('transaction cancel', () => {
  it('compensates the transaction and leaves through the cancel boundary', async () => {
    const eng = new WorkflowEngine(await process(TRANSACTION_CANCEL), {
      variables: { confirmado: false },
    });
    const log = tracked(eng, ['Debitar', 'Estornar']);

    const snap = await eng.start();

    expect(log).toEqual(['Debitar', 'Estornar']);
    expect(snap.completedNodes).toContain('AvisarCliente');
    expect(snap.completedNodes).not.toContain('Concluir');
    expect(snap.status).toBe('completed');
  });

  it('commits normally when the transaction is confirmed', async () => {
    const eng = new WorkflowEngine(await process(TRANSACTION_CANCEL), {
      variables: { confirmado: true },
    });
    const log = tracked(eng, ['Debitar', 'Estornar']);

    const snap = await eng.start();

    expect(log).toEqual(['Debitar']);
    expect(snap.completedNodes).toContain('Concluir');
    expect(snap.completedNodes).not.toContain('AvisarCliente');
  });
});
