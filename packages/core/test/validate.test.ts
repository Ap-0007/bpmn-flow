import { describe, expect, it } from 'vitest';
import { validateBpmn } from '../src/index.js';
import { LINEAR } from './fixtures.js';

const NO_START = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="d" targetNamespace="t">
  <bpmn:process id="P" isExecutable="true">
    <bpmn:task id="A" />
  </bpmn:process>
</bpmn:definitions>`;

describe('validateBpmn', () => {
  it('accepts a well-formed process', async () => {
    const result = await validateBpmn(LINEAR);
    expect(result.valid).toBe(true);
    expect(result.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });

  it('reports a missing start event as an error', async () => {
    const result = await validateBpmn(NO_START);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.message.includes('no start event'))).toBe(true);
  });

  it('warns about unreachable and dead-end nodes', async () => {
    const result = await validateBpmn(NO_START);
    expect(result.issues.some((i) => i.severity === 'warning' && i.nodeId === 'A')).toBe(true);
  });

  it('flags invalid XML as invalid', async () => {
    const result = await validateBpmn('<nope>');
    expect(result.valid).toBe(false);
  });
});
