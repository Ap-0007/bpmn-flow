import { describe, expect, it } from 'vitest';
import { addFlowReferences, parseBpmn } from '../src/index.js';

const SEM_REFS = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  targetNamespace="http://bpmn-flow.test" id="Defs">
  <bpmn:process id="P" isExecutable="true">
    <bpmn:startEvent id="Start" />
    <bpmn:subProcess id="Sub">
      <bpmn:startEvent id="SubStart" />
      <bpmn:task id="Inner" />
      <bpmn:endEvent id="SubEnd" />
      <bpmn:sequenceFlow id="s1" sourceRef="SubStart" targetRef="Inner" />
      <bpmn:sequenceFlow id="s2" sourceRef="Inner" targetRef="SubEnd" />
    </bpmn:subProcess>
    <bpmn:endEvent id="End" />
    <bpmn:sequenceFlow id="f0" sourceRef="Start" targetRef="Sub" />
    <bpmn:sequenceFlow id="f1" sourceRef="Sub" targetRef="End" />
  </bpmn:process>
</bpmn:definitions>`;

describe('addFlowReferences', () => {
  it('spells out the wiring the sequence flows already describe', async () => {
    expect(SEM_REFS).not.toContain('<bpmn:incoming>');

    const wired = await addFlowReferences(SEM_REFS);

    expect(wired).toContain('<bpmn:outgoing>f0</bpmn:outgoing>');
    expect(wired).toContain('<bpmn:incoming>f0</bpmn:incoming>');
    expect(wired).toContain('<bpmn:incoming>f1</bpmn:incoming>');
  });

  it('reaches inside subprocesses', async () => {
    const wired = await addFlowReferences(SEM_REFS);
    expect(wired).toContain('<bpmn:outgoing>s1</bpmn:outgoing>');
    expect(wired).toContain('<bpmn:incoming>s2</bpmn:incoming>');
  });

  it('is a no-op when the references are already there', async () => {
    const once = await addFlowReferences(SEM_REFS);
    const twice = await addFlowReferences(once);
    const count = (xml: string): number => (xml.match(/<bpmn:incoming>/g) ?? []).length;
    expect(count(twice)).toBe(count(once));
  });

  it('keeps the model identical for the engine', async () => {
    const before = await parseBpmn(SEM_REFS);
    const after = await parseBpmn(await addFlowReferences(SEM_REFS));
    expect(after.processes[0]?.flowNodes.map((n) => n.id)).toEqual(
      before.processes[0]?.flowNodes.map((n) => n.id),
    );
    expect(after.processes[0]?.sequenceFlows).toEqual(before.processes[0]?.sequenceFlows);
  });

  it('rejects XML it cannot read', async () => {
    await expect(addFlowReferences('<nope')).rejects.toThrow(/Failed to parse/);
  });
});
