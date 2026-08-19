import { describe, expect, it } from 'vitest';
import { parseBpmn, WorkflowEngine } from '../src/index.js';
import type { ProcessModel } from '../src/index.js';
import { LANES_AND_ROLES, MI_PARALLEL_USER_TASKS } from './fixtures.js';

async function process(xml: string): Promise<ProcessModel> {
  return (await parseBpmn(xml)).processes[0]!;
}

describe('lanes and potential owners', () => {
  it('reads the lane of each node and the roles of an activity', async () => {
    const p = await process(LANES_AND_ROLES);
    const byId = new Map(p.flowNodes.map((node) => [node.id, node]));

    expect(byId.get('Registrar')?.lane).toBe('Vendas');
    expect(byId.get('Aprovar')?.lane).toBe('Financeiro');
    expect(byId.get('Aprovar')?.candidates).toEqual(['gerentes', 'diretoria']);
    expect(byId.get('Registrar')?.candidates).toBeUndefined();
  });
});

describe('task list', () => {
  it('describes the work waiting on a person', async () => {
    const eng = new WorkflowEngine(await process(LANES_AND_ROLES), {
      variables: { pedido: 42 },
    });
    await eng.start();

    const tasks = eng.tasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      nodeId: 'Registrar',
      name: 'Registrar pedido',
      lane: 'Vendas',
      reason: 'userTask',
      candidates: [],
    });
    expect(tasks[0]?.variables).toMatchObject({ pedido: 42 });
  });

  it('filters by role, matching either the lane or a candidate', async () => {
    const eng = new WorkflowEngine(await process(LANES_AND_ROLES));
    await eng.start();

    expect(eng.tasks({ role: 'Vendas' })).toHaveLength(1);
    expect(eng.tasks({ role: 'Financeiro' })).toHaveLength(0);

    await eng.completeTask(eng.tasks()[0]!.tokenId);

    expect(eng.tasks({ role: 'Vendas' })).toHaveLength(0);
    expect(eng.tasks({ role: 'Financeiro' })).toHaveLength(1);
    expect(eng.tasks({ role: 'gerentes' })).toHaveLength(1);
    expect(eng.tasks({ role: 'estagiarios' })).toHaveLength(0);
  });

  it('lists one entry per multi-instance instance, with its own item', async () => {
    const eng = new WorkflowEngine(await process(MI_PARALLEL_USER_TASKS), {
      variables: { aprovadores: ['ana', 'bob'] },
    });
    await eng.start();

    const tasks = eng.tasks({ nodeId: 'Approve' });
    expect(tasks).toHaveLength(2);
    expect(tasks.map((task) => task.variables.aprovador)).toEqual(['ana', 'bob']);
  });

  it('empties as the work is completed', async () => {
    const eng = new WorkflowEngine(await process(LANES_AND_ROLES));
    await eng.start();
    while (eng.tasks().length > 0) {
      await eng.completeTask(eng.tasks()[0]!.tokenId);
    }
    expect(eng.currentStatus).toBe('completed');
  });
});
