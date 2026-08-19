import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// Imported directly: layout is pure XML work, with no rendering dependency.
import { ensureLayout, hasDiagramInterchange } from '../src/layout.js';

const SEM_LAYOUT = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  targetNamespace="http://bpmn-flow.test" id="Defs">
  <bpmn:process id="P" isExecutable="true">
    <bpmn:startEvent id="Start" />
    <bpmn:task id="Fazer" />
    <bpmn:endEvent id="End" />
    <bpmn:sequenceFlow id="f0" sourceRef="Start" targetRef="Fazer" />
    <bpmn:sequenceFlow id="f1" sourceRef="Fazer" targetRef="End" />
  </bpmn:process>
</bpmn:definitions>`;

const count = (xml: string, tag: string): number => (xml.match(new RegExp(tag, 'g')) ?? []).length;

/** Repository samples, which the viewer has to be able to draw. */
const samplesDir = fileURLToPath(new URL('../../../bpmn-files', import.meta.url));

describe('hasDiagramInterchange', () => {
  it('tells a laid-out diagram from a purely semantic one', () => {
    expect(hasDiagramInterchange(SEM_LAYOUT)).toBe(false);
    expect(hasDiagramInterchange('<x><bpmndi:BPMNShape /></x>')).toBe(true);
  });
});

describe('ensureLayout', () => {
  it('draws the connections, not only the boxes', async () => {
    const laid = await ensureLayout(SEM_LAYOUT);

    expect(count(laid, 'BPMNShape')).toBeGreaterThan(0);
    // The regression: the layout engine reads each node's incoming/outgoing
    // children, so without them it used to emit shapes and no edge at all.
    expect(count(laid, 'BPMNEdge')).toBeGreaterThan(0);
    expect(count(laid, 'waypoint')).toBeGreaterThan(0);
  });

  it('leaves a diagram that already has layout untouched', async () => {
    const laid = await ensureLayout(SEM_LAYOUT);
    expect(await ensureLayout(laid)).toBe(laid);
  });
});

describe('the shipped samples', () => {
  it('all render with their sequence flows', async () => {
    const files = (await readdir(samplesDir)).filter((name) => name.endsWith('.bpmn'));
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const xml = await readFile(join(samplesDir, file), 'utf8');
      const flows = count(xml, '<bpmn:sequenceFlow');
      const laid = await ensureLayout(xml);
      expect(
        count(laid, 'BPMNEdge'),
        `${file} deveria desenhar ${flows} fluxo(s)`,
      ).toBeGreaterThanOrEqual(flows);
    }
  });
});
