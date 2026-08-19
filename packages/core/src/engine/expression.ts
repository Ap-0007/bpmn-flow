/**
 * Expression evaluation for sequence-flow guards, loop cardinalities and
 * completion conditions.
 *
 * BPMN expressions are part of a *trusted* process definition (the same trust
 * level as the diagram author), so they are evaluated as JavaScript over the
 * current process variables. Expressions may optionally be wrapped in
 * `${ ... }`.
 *
 * A variable that does not exist reads as `undefined` instead of throwing —
 * `pago !== true` is true before anything sets `pago`, as engines with a FEEL
 * evaluator behave. Globals such as `Math`, `Date` and `JSON` stay reachable.
 * An expression that still throws is treated as `undefined` (and therefore
 * `false` as a condition), so a malformed guard never crashes the engine.
 */

const WRAPPER = /^\s*\$\{([\s\S]*)\}\s*$/;

const cache = new Map<string, (scope: Record<string, unknown>) => unknown>();

function compile(expression: string): (scope: Record<string, unknown>) => unknown {
  const cached = cache.get(expression);
  if (cached) return cached;

  const body = expression.replace(WRAPPER, '$1').trim();
  // `with` over a proxy: the `has` trap claims every non-global identifier so
  // unknown names resolve to `undefined` rather than raising a ReferenceError.
  const fn = new Function(
    'scope',
    `with (scope) { try { return (${body}); } catch { return undefined; } }`,
  ) as (scope: Record<string, unknown>) => unknown;
  cache.set(expression, fn);
  return fn;
}

/**
 * Evaluates an expression and returns its raw value, or `undefined` when it
 * throws. Used for non-boolean expressions such as a loop cardinality.
 */
export function evaluateExpression(
  expression: string,
  variables: Record<string, unknown>,
): unknown {
  try {
    return compile(expression)(scopeFor(variables));
  } catch {
    return undefined;
  }
}

/** Wraps the variables so bare identifiers never raise a ReferenceError. */
function scopeFor(variables: Record<string, unknown>): Record<string, unknown> {
  return new Proxy(variables, {
    has: (target, key) => Reflect.has(target, key) || !(key in globalThis),
    get: (target, key) => (key === Symbol.unscopables ? undefined : Reflect.get(target, key)),
  });
}

/** Evaluates an expression to a boolean against `variables`. */
export function evaluateCondition(expression: string, variables: Record<string, unknown>): boolean {
  return evaluateExpression(expression, variables) === true;
}
