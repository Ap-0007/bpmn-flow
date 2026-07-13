import { describe, expect, it } from 'vitest';
import { evaluateCondition } from '../src/index.js';

describe('evaluateCondition', () => {
  it('evaluates plain expressions over variables', () => {
    expect(evaluateCondition('amount > 100', { amount: 150 })).toBe(true);
    expect(evaluateCondition('amount > 100', { amount: 50 })).toBe(false);
  });

  it('supports ${...} wrapped expressions', () => {
    expect(evaluateCondition('${status === "ok"}', { status: 'ok' })).toBe(true);
  });

  it('fails closed (false) on errors instead of throwing', () => {
    expect(() => evaluateCondition('missing === undefined', {})).not.toThrow();
    expect(evaluateCondition('missing === undefined', {})).toBe(false);
    expect(evaluateCondition('missing.deep.value', {})).toBe(false);
    expect(evaluateCondition('defined === undefined', { defined: undefined })).toBe(true);
  });

  it('coerces non-boolean results to false', () => {
    expect(evaluateCondition('amount', { amount: 1 })).toBe(false);
  });
});
