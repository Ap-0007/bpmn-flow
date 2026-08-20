import { describe, expect, it } from 'vitest';
import { decisionsAfter, parseBpmn, WorkflowEngine } from '../src/index.js';
import type { ProcessModel } from '../src/index.js';
import { COMPENSATION, EVENT_BASED, EXCLUSIVE, INCLUSIVE, LINEAR, PARALLEL } from './fixtures.js';

async function process(xml: string): Promise<ProcessModel> {
  return (await parseBpmn(xml)).processes[0]!;
}

describe('decisionsAfter', () => {
  it('reads the branches of the gateway ahead, with the values that pick them', async () => {
    const [decision, ...rest] = decisionsAfter(await process(EXCLUSIVE), 'Start');

    expect(rest).toEqual([]);
    expect(decision).toMatchObject({
      nodeId: 'Gw',
      kind: 'exclusiveGateway',
      variables: ['amount'],
    });
    expect(decision?.options).toEqual([
      {
        flowId: 'fHigh',
        targetId: 'High',
        label: 'High',
        condition: 'amount > 100',
        isDefault: false,
        assignments: { amount: 101 },
      },
      {
        flowId: 'fLow',
        targetId: 'Low',
        label: 'Low',
        isDefault: true,
        assignments: { amount: 100 },
      },
    ]);
  });

  it('refutes the competing conditions so one branch is left', async () => {
    const [decision] = decisionsAfter(await process(INCLUSIVE), 'Start');
    const chooseY = decision?.options.find((option) => option.targetId === 'Y');

    expect(chooseY?.assignments).toEqual({ a: false, b: true });
  });

  it('walks past automatic activities and parallel splits', async () => {
    expect(decisionsAfter(await process(PARALLEL), 'Start')).toEqual([]);

    const [decision] = decisionsAfter(await process(COMPENSATION), 'ReservarVoo');
    expect(decision?.nodeId).toBe('Pagou');
  });

  it('stops at a wait state: whoever drives is asked there', async () => {
    // Approve is a user task, so nothing after it is decided yet.
    expect(decisionsAfter(await process(LINEAR), 'Start')).toEqual([]);
    // An event-based gateway is answered by a trigger, not by variables.
    expect(decisionsAfter(await process(EVENT_BASED), 'Start')).toEqual([]);
  });

  it('reports conditional flows leaving an activity', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="t" id="D">
  <bpmn:process id="P" isExecutable="true">
    <bpmn:userTask id="Triagem" name="Triagem" />
    <bpmn:endEvent id="Urgente" name="Urgente" />
    <bpmn:endEvent id="Normal" name="Normal" />
    <bpmn:sequenceFlow id="fU" sourceRef="Triagem" targetRef="Urgente">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">prioridade === 'alta'</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="fN" sourceRef="Triagem" targetRef="Normal">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">prioridade === 'baixa'</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
  </bpmn:process>
</bpmn:definitions>`;
    const [decision] = decisionsAfter(await process(xml), 'Triagem');

    expect(decision).toMatchObject({ nodeId: 'Triagem', kind: 'userTask' });
    expect(decision?.options.map((option) => option.assignments)).toEqual([
      { prioridade: 'alta' },
      { prioridade: 'baixa' },
    ]);
  });

  it('finds a decision declared inside a subprocess', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="t" id="D">
  <bpmn:process id="P" isExecutable="true">
    <bpmn:subProcess id="Sub">
      <bpmn:userTask id="Analisar" />
      <bpmn:exclusiveGateway id="Ok" default="fNao" />
      <bpmn:endEvent id="Sim" />
      <bpmn:endEvent id="Nao" />
      <bpmn:sequenceFlow id="fSim" sourceRef="Analisar" targetRef="Ok" />
      <bpmn:sequenceFlow id="fOk" sourceRef="Ok" targetRef="Sim">
        <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">aprovado === true</bpmn:conditionExpression>
      </bpmn:sequenceFlow>
      <bpmn:sequenceFlow id="fNao" sourceRef="Ok" targetRef="Nao" />
    </bpmn:subProcess>
  </bpmn:process>
</bpmn:definitions>`;
    const [decision] = decisionsAfter(await process(xml), 'Analisar');

    expect(decision?.nodeId).toBe('Ok');
    expect(decision?.options[0]?.assignments).toEqual({ aprovado: true });
  });

  it('produces assignments the engine actually follows', async () => {
    const model = await process(EXCLUSIVE);
    const [decision] = decisionsAfter(model, 'Start');

    for (const option of decision!.options) {
      const engine = new WorkflowEngine(model, { variables: option.assignments });
      const snapshot = await engine.start();
      expect(snapshot.completedNodes).toContain(option.targetId);
    }
  });
});
