import { describe, expect, it } from 'vitest';
import { parseBpmn, WorkflowEngine } from '../src/index.js';
import type { ProcessModel } from '../src/index.js';
import { LINEAR } from './fixtures.js';

const NS =
  'xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
  'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
  'targetNamespace="http://bpmn-flow.test"';

async function process(xml: string): Promise<ProcessModel> {
  return (await parseBpmn(xml)).processes[0]!;
}

const DEAD_END_GATEWAY = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions ${NS} id="Defs">
  <bpmn:process id="P" isExecutable="true">
    <bpmn:startEvent id="Start" />
    <bpmn:exclusiveGateway id="Gw" />
    <bpmn:task id="A" />
    <bpmn:endEvent id="End" />
    <bpmn:sequenceFlow id="f0" sourceRef="Start" targetRef="Gw" />
    <bpmn:sequenceFlow id="fa" sourceRef="Gw" targetRef="A">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">nunca === true</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="fe" sourceRef="A" targetRef="End" />
  </bpmn:process>
</bpmn:definitions>`;

const UNHANDLED_ERROR_END = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions ${NS} id="Defs">
  <bpmn:process id="P" isExecutable="true">
    <bpmn:startEvent id="Start" />
    <bpmn:endEvent id="Falhou">
      <bpmn:errorEventDefinition />
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="f0" sourceRef="Start" targetRef="Falhou" />
  </bpmn:process>
</bpmn:definitions>`;

describe('engine contract', () => {
  it('refuses a process that is not executable', async () => {
    const p = await process(LINEAR);
    expect(() => new WorkflowEngine({ ...p, isExecutable: false })).toThrow(/not executable/i);
  });

  it('refuses to start twice', async () => {
    const eng = new WorkflowEngine(await process(LINEAR), { mode: 'auto' });
    await eng.start();
    await expect(eng.start()).rejects.toThrow(/already been started/i);
  });

  it('refuses to resume before starting', async () => {
    const eng = new WorkflowEngine(await process(LINEAR));
    await expect(eng.resume()).rejects.toThrow(/not been started/i);
  });

  it('rejects an unknown token or trigger', async () => {
    const eng = new WorkflowEngine(await process(LINEAR));
    eng.registerHandler('Charge', () => undefined);
    await eng.start();

    await expect(eng.completeTask('t999')).rejects.toThrow(/No waiting task token/);
    await expect(eng.signal('NadaEscuta')).rejects.toThrow(/No catchable event/);
    await expect(eng.retryTask('t999')).rejects.toThrow(/No incident/);
    await expect(eng.resolveIncident('t999')).rejects.toThrow(/No incident/);
  });

  it('fails a gateway with no viable outgoing flow', async () => {
    const eng = new WorkflowEngine(await process(DEAD_END_GATEWAY));
    const errors: Error[] = [];
    eng.on('error', ({ error }) => errors.push(error));
    const snap = await eng.start();

    expect(snap.status).toBe('failed');
    expect(errors[0]?.message).toMatch(/no valid outgoing flow/i);
  });

  it('ends quietly when an error end event has nobody to catch it', async () => {
    const snap = await new WorkflowEngine(await process(UNHANDLED_ERROR_END)).start();
    expect(snap.status).toBe('completed');
    expect(snap.completedNodes).toContain('Falhou');
  });
});

describe('collaboration', () => {
  it('reads participants and message flows', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions ${NS} id="Defs" name="Compra">
  <bpmn:collaboration id="Colab">
    <bpmn:participant id="Cliente" name="Cliente" processRef="P" />
    <bpmn:participant id="Loja" name="Loja" />
    <bpmn:messageFlow id="mf" name="Pedido" sourceRef="Cliente" targetRef="Loja" />
  </bpmn:collaboration>
  <bpmn:process id="P" isExecutable="true">
    <bpmn:startEvent id="Start" />
    <bpmn:endEvent id="End" />
    <bpmn:sequenceFlow id="f0" sourceRef="Start" targetRef="End" />
  </bpmn:process>
</bpmn:definitions>`;
    const model = await parseBpmn(xml);

    expect(model.name).toBe('Compra');
    expect(model.participants).toEqual([
      { id: 'Cliente', name: 'Cliente', processRef: 'P' },
      { id: 'Loja', name: 'Loja' },
    ]);
    expect(model.messageFlows[0]).toMatchObject({ id: 'mf', name: 'Pedido', sourceRef: 'Cliente' });
  });
});
