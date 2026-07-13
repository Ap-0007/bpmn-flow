/**
 * Condition-expression evaluation for sequence flow guards.
 *
 * BPMN condition expressions are part of a *trusted* process definition (the
 * same trust level as the diagram author), so they are evaluated as JavaScript
 * over the current process variables. Expressions may optionally be wrapped in
 * `${ ... }`. A failed or non-boolean evaluation is treated as `false` so a
 * malformed guard never crashes the engine.
 */

const WRAPPER = /^\s*\$\{([\s\S]*)\}\s*$/;

const cache = new Map<string, (scope: Record<string, unknown>) => unknown>();

function compile(expression: string): (scope: Record<string, unknown>) => unknown {
  const cached = cache.get(expression);
  if (cached) return cached;

  const body = expression.replace(WRAPPER, '$1').trim();
  // `scope` is destructured so variables are addressable as bare identifiers,
  // while unknown identifiers resolve to `undefined` instead of throwing.
  const fn = new Function(
    'scope',
    `with (scope) { try { return (${body}); } catch { return undefined; } }`,
  ) as (scope: Record<string, unknown>) => unknown;
  cache.set(expression, fn);
  return fn;
}

/** Evaluates an expression to a boolean against `variables`. */
export function evaluateCondition(
  expression: string,
  variables: Record<string, unknown>,
): boolean {
  try {
    return compile(expression)(variables) === true;
  } catch {
    return false;
  }
}
