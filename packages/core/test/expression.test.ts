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

  it('reads an unknown variable as undefined instead of throwing', () => {
    expect(() => evaluateCondition('missing === undefined', {})).not.toThrow();
    expect(evaluateCondition('missing === undefined', {})).toBe(true);
    expect(evaluateCondition('pago !== true', {})).toBe(true);
    expect(evaluateCondition('defined === undefined', { defined: undefined })).toBe(true);
  });

  it('fails closed (false) when the expression itself throws', () => {
    expect(evaluateCondition('missing.deep.value', {})).toBe(false);
    expect(evaluateCondition('(() => { throw new Error("x"); })()', {})).toBe(false);
  });

  it('keeps globals reachable', () => {
    expect(evaluateCondition('Math.max(a, b) === 5', { a: 5, b: 2 })).toBe(true);
    expect(evaluateCondition('Array.isArray(itens)', { itens: [1] })).toBe(true);
  });

  it('coerces non-boolean results to false', () => {
    expect(evaluateCondition('amount', { amount: 1 })).toBe(false);
  });
});
