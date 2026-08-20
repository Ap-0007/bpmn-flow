import { describe, expect, it } from 'vitest';
import { parseBpmn, processVariables, suggestVariables, WorkflowEngine } from '../src/index.js';
import type { ProcessModel } from '../src/index.js';
import { COMPENSATION, COMPLEX_GATEWAY, MI_COLLECTION } from './fixtures.js';

async function process(xml: string): Promise<ProcessModel> {
  return (await parseBpmn(xml)).processes[0]!;
}

describe('processVariables', () => {
  it('finds the variables the gateways read, and where', async () => {
    const usages = processVariables(await process(COMPENSATION));
    const pago = usages.find((usage) => usage.name === 'pago')!;

    expect(pago).toMatchObject({ kind: 'condition', suggestion: true });
    expect(pago.expressions).toEqual(['pago === true']);
    expect(pago.usedBy.length).toBeGreaterThan(0);
  });

  it('reports a multi-instance collection as such', async () => {
    const usages = processVariables(await process(MI_COLLECTION));
    const itens = usages.find((usage) => usage.name === 'itens')!;

    expect(itens.kind).toBe('collection');
    expect(itens.suggestion).toEqual(['item-1', 'item-2']);
  });

  it('leaves out what the engine provides or the process writes', async () => {
    const names = processVariables(await process(MI_COLLECTION)).map((usage) => usage.name);

    expect(names).not.toContain('loopCounter'); // engine
    expect(names).not.toContain('item'); // multi-instance item
    expect(names).not.toContain('resultado'); // output element
    expect(names).not.toContain('resultados'); // output collection
  });

  it('ignores the count the complex gateway exposes', async () => {
    const names = processVariables(await process(COMPLEX_GATEWAY)).map((usage) => usage.name);
    expect(names).not.toContain('arrived');
  });
});

describe('suggestions', () => {
  const cases: [string, unknown][] = [
    ['pago === true', true],
    ['aprovado !== true', false],
    ['valor > 1000', 1001],
    ['valor >= 1000', 1000],
    ['idade < 18', 17],
    ['status === "ok"', 'ok'],
    ["tipo === 'premium'", 'premium'],
    ['ativo', true],
  ];

  /** Conditions live inside XML, so the comparison operators need escaping. */
  const escape = (expression: string): string =>
    expression.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  it.each(cases)('%s -> %j', async (expression, expected) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="t" id="D">
  <bpmn:process id="P" isExecutable="true">
    <bpmn:startEvent id="S" />
    <bpmn:exclusiveGateway id="Gw" default="fB" />
    <bpmn:endEvent id="A" />
    <bpmn:endEvent id="B" />
    <bpmn:sequenceFlow id="f0" sourceRef="S" targetRef="Gw" />
    <bpmn:sequenceFlow id="fA" sourceRef="Gw" targetRef="A">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">${escape(expression)}</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="fB" sourceRef="Gw" targetRef="B" />
  </bpmn:process>
</bpmn:definitions>`;
    const [usage] = processVariables(await process(xml));
    expect(usage?.suggestion).toEqual(expected);
  });

  it('produces variables that actually take the conditional path', async () => {
    const model = await process(COMPENSATION);
    const engine = new WorkflowEngine(model, { variables: suggestVariables(model) });
    const snapshot = await engine.start();

    // "pago" suggested as true, so the happy path runs and nothing is undone.
    expect(snapshot.completedNodes).toContain('ViagemOk');
    expect(snapshot.completedNodes).not.toContain('CancelarVoo');
  });
});
