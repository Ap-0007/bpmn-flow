import { describe, expect, it, vi } from 'vitest';
import { parseBpmn, WorkflowEngine } from '../src/index.js';
import type { GatewayDecision, ProcessModel } from '../src/index.js';
import { EXCLUSIVE, INCLUSIVE, PARALLEL } from './fixtures.js';

async function process(xml: string): Promise<ProcessModel> {
  return (await parseBpmn(xml)).processes[0]!;
}

describe('options.decide', () => {
  it('routes an exclusive gateway against what the data says', async () => {
    const model = await process(EXCLUSIVE);
    const engine = new WorkflowEngine(model, {
      // amount is unset, so the conditions would take the default branch.
      decide: () => 'fHigh',
    });
    const snapshot = await engine.start();

    expect(snapshot.completedNodes).toContain('High');
    expect(snapshot.completedNodes).not.toContain('Low');
  });

  it('describes the gateway it is asking about', async () => {
    const decide = vi.fn<(decision: GatewayDecision) => undefined>(() => undefined);
    // amount is 50, under the `amount > 100` of the conditional branch.
    await new WorkflowEngine(await process(EXCLUSIVE), {
      variables: { amount: 50 },
      decide,
    }).start();

    expect(decide).toHaveBeenCalledTimes(1);
    expect(decide.mock.calls[0]![0]).toMatchObject({
      nodeId: 'Gw',
      nodeKind: 'exclusiveGateway',
      suggested: ['fLow'], // under the threshold, so the default branch
      variables: { amount: 50 },
    });
    expect(decide.mock.calls[0]![0].options).toEqual([
      { flowId: 'fHigh', targetId: 'High', condition: 'amount > 100', isDefault: false },
      { flowId: 'fLow', targetId: 'Low', isDefault: true },
    ]);
  });

  it('keeps the engine decision when the hook answers nothing it knows', async () => {
    const model = await process(EXCLUSIVE);
    const engine = new WorkflowEngine(model, {
      variables: { amount: 50 },
      decide: () => 'flow-que-nao-existe',
    });
    const snapshot = await engine.start();

    expect(snapshot.completedNodes).toContain('Low');
  });

  it('opens several branches of an inclusive gateway', async () => {
    const model = await process(INCLUSIVE);
    const engine = new WorkflowEngine(model, { decide: () => ['fx', 'fy'] });
    const snapshot = await engine.start();

    expect(snapshot.completedNodes).toEqual(expect.arrayContaining(['X', 'Y']));
    expect(snapshot.completedNodes).not.toContain('Z');
    expect(snapshot.status).toBe('completed');
  });

  it('is not asked about a parallel gateway: there is nothing to choose', async () => {
    const decide = vi.fn(() => undefined);
    await new WorkflowEngine(await process(PARALLEL), { decide }).start();

    expect(decide).not.toHaveBeenCalled();
  });

  it('may answer asynchronously, like a person would', async () => {
    const model = await process(EXCLUSIVE);
    const engine = new WorkflowEngine(model, {
      decide: async (decision) => {
        await Promise.resolve();
        return decision.options.find((option) => !option.isDefault)?.flowId;
      },
    });
    const snapshot = await engine.start();

    expect(snapshot.completedNodes).toContain('High');
  });
});
