import { describe, expect, it } from 'vitest';
import { inspect, run, validate } from '../src/index.js';

const ORDER = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  targetNamespace="http://bpmn-flow.test" id="Defs">
  <bpmn:process id="Pedido" isExecutable="true" name="Pedido">
    <bpmn:laneSet id="Lanes">
      <bpmn:lane id="L1" name="Expedicao">
        <bpmn:flowNodeRef>Separar</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:dataObject id="itens" name="itens" />
    <bpmn:startEvent id="Start" />
    <bpmn:userTask id="Separar" name="Separar itens">
      <bpmn:multiInstanceLoopCharacteristics isSequential="false">
        <bpmn:loopDataInputRef>itens</bpmn:loopDataInputRef>
        <bpmn:inputDataItem id="item" name="item" />
      </bpmn:multiInstanceLoopCharacteristics>
    </bpmn:userTask>
    <bpmn:endEvent id="End" />
    <bpmn:sequenceFlow id="f0" sourceRef="Start" targetRef="Separar" />
    <bpmn:sequenceFlow id="f1" sourceRef="Separar" targetRef="End" />
  </bpmn:process>
</bpmn:definitions>`;

const BROKEN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  targetNamespace="http://bpmn-flow.test" id="Defs">
  <bpmn:process id="P" isExecutable="true">
    <bpmn:task id="Solta" />
  </bpmn:process>
</bpmn:definitions>`;

describe('validate', () => {
  it('accepts a well-formed diagram', async () => {
    const result = await validate(ORDER);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('valid');
  });

  it('exits non-zero and lists the problems', async () => {
    const result = await validate(BROKEN);
    expect(result.exitCode).toBe(1);
    expect(result.output).toMatch(/start event/i);
  });
});

describe('inspect', () => {
  it('summarizes nodes, lanes and repetition', async () => {
    const { output } = await inspect(ORDER);
    expect(output).toContain('process Pedido (Pedido)');
    expect(output).toContain('userTask: 1');
    expect(output).toContain('lanes: Expedicao');
    expect(output).toContain('multi-instance parallel over "itens"');
  });
});

describe('run', () => {
  it('reports where the execution stopped and who owns the work', async () => {
    const result = await run(ORDER, { variables: { itens: ['a', 'b'] } });
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('status: waiting');
    expect(result.output).toContain('Separar itens (userTask, Expedicao)');
    expect(result.snapshot.tokens.filter((token) => token.waiting)).toHaveLength(2);
  });

  it('continues from a saved state', async () => {
    const first = await run(ORDER, { variables: { itens: ['a'] } });
    const state = JSON.parse(JSON.stringify(first.state));

    const second = await run(ORDER, { state });
    expect(second.snapshot.status).toBe('waiting'); // same place, nothing lost
    expect(second.output).toContain('Separar itens');
  });

  it('drives a whole process in auto mode', async () => {
    const result = await run(ORDER, { mode: 'auto', variables: { itens: ['a', 'b'] } });
    expect(result.snapshot.status).toBe('completed');
    expect(result.output).toContain('status: completed');
  });
});
