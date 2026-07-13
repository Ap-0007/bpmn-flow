import { describe, expect, it } from 'vitest';
import { parseBpmn, BpmnParseError } from '../src/index.js';
import { BOUNDARY_ERROR, EXCLUSIVE, SUBPROCESS } from './fixtures.js';

describe('parseBpmn', () => {
  it('normalizes nodes, flows and gateway defaults', async () => {
    const model = await parseBpmn(EXCLUSIVE);
    const p = model.processes[0]!;
    expect(p.id).toBe('P');
    expect(p.isExecutable).toBe(true);

    const gw = p.flowNodes.find((n) => n.id === 'Gw')!;
    expect(gw.kind).toBe('exclusiveGateway');
    expect(gw.default).toBe('fLow');
    expect(gw.outgoing).toHaveLength(2);

    const high = p.sequenceFlows.find((f) => f.id === 'fHigh')!;
    expect(high.conditionExpression).toContain('amount');
    expect(p.sequenceFlows.find((f) => f.id === 'fLow')!.isDefault).toBe(true);
  });

  it('reads error definitions on boundary events', async () => {
    const model = await parseBpmn(BOUNDARY_ERROR);
    const boundary = model.processes[0]!.flowNodes.find((n) => n.id === 'OnFail')!;
    expect(boundary.kind).toBe('boundaryEvent');
    expect(boundary.attachedToRef).toBe('Pay');
    expect(boundary.event?.kind).toBe('error');
    expect(boundary.event?.code).toBe('PAYMENT_FAILED');
  });

  it('parses nested subprocess scopes', async () => {
    const model = await parseBpmn(SUBPROCESS);
    const sub = model.processes[0]!.flowNodes.find((n) => n.id === 'Sub')!;
    expect(sub.kind).toBe('subProcess');
    expect(sub.process?.flowNodes).toHaveLength(3);
    expect(sub.process?.sequenceFlows).toHaveLength(2);
  });

  it('throws a typed error on invalid XML', async () => {
    await expect(parseBpmn('<not-bpmn>')).rejects.toBeInstanceOf(BpmnParseError);
  });

  it('throws when no process is present', async () => {
    const xml =
      '<?xml version="1.0"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="d" />';
    await expect(parseBpmn(xml)).rejects.toBeInstanceOf(BpmnParseError);
  });
});
