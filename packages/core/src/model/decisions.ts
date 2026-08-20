import type { ElementKind } from './kinds.js';
import type { FlowNode, ProcessModel, SequenceFlow } from './types.js';
import { identifiersOf, inferValue } from './variables.js';

/**
 * Where a running process branches, and what it takes to send it down each
 * branch.
 *
 * A gateway decides from data: the engine evaluates the conditions on its
 * outgoing flows and picks. That is invisible to whoever is driving the
 * execution — they see the token leave a task and reappear somewhere. These
 * helpers turn the branch back into a question ("aprovar ou recusar?") plus the
 * variables that answer it, so a UI can ask before the token gets there.
 */

/** One branch out of a decision point. */
export interface DecisionOption {
  flowId: string;
  targetId: string;
  /** Name of the flow, falling back to the target's name or id. */
  label: string;
  /** Condition guarding the flow, when it has one. */
  condition?: string;
  /** True for the branch taken when no condition matches. */
  isDefault: boolean;
  /**
   * Variables that make the engine take this branch: its own condition
   * satisfied and the competing ones refuted. Empty when the shape of the
   * expressions says nothing (a call, a regex, arithmetic) — then the operator
   * has to type the values.
   */
  assignments: Record<string, unknown>;
}

/** A branching node the token is about to reach. */
export interface DecisionPoint {
  nodeId: string;
  name?: string;
  kind: ElementKind;
  options: DecisionOption[];
  /** Variables read by the conditions, in the order they appear. */
  variables: string[];
}

/** Kinds that park the token: whoever drives is asked there, not before. */
const WAIT_KINDS = new Set<ElementKind>([
  'userTask',
  'receiveTask',
  'intermediateCatchEvent',
  'eventBasedGateway',
]);

/** Gateways that pick their outgoing flow(s) from conditions. */
const DECIDING_GATEWAYS = new Set<ElementKind>([
  'exclusiveGateway',
  'inclusiveGateway',
  'complexGateway',
]);

/**
 * Decisions the token will run into after `nodeId` completes, before anything
 * else stops it.
 *
 * The walk follows sequence flows through automatic activities and parallel
 * splits, stops at every branching node (the answer decides what comes next)
 * and at every wait state (whoever drives will be asked there anyway). Only the
 * scope holding the node is searched; a subprocess is walked past, not into.
 */
export function decisionsAfter(process: ProcessModel, nodeId: string): DecisionPoint[] {
  const scope = scopeOf(process, nodeId);
  if (!scope) return [];
  const nodes = new Map(scope.flowNodes.map((node) => [node.id, node]));
  const flows = new Map(scope.sequenceFlows.map((flow) => [flow.id, flow]));

  const decisions: DecisionPoint[] = [];
  const seen = new Set<string>();
  const queue = [nodeId];

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = nodes.get(id);
    if (!node) continue;
    // The starting activity is where the token already is; it does not park
    // there a second time.
    if (id !== nodeId && WAIT_KINDS.has(node.kind)) continue;

    const outgoing = node.outgoing
      .map((flowId) => flows.get(flowId))
      .filter((flow): flow is SequenceFlow => flow !== undefined);

    if (isDecision(node, outgoing)) {
      decisions.push(decisionPoint(node, outgoing, nodes));
      continue;
    }
    for (const flow of outgoing) queue.push(flow.targetRef);
  }
  return decisions;
}

/** The process or subprocess that declares the node. */
function scopeOf(process: ProcessModel, nodeId: string): ProcessModel | undefined {
  for (const node of process.flowNodes) {
    if (node.id === nodeId) return process;
  }
  for (const node of process.flowNodes) {
    const nested = node.process ? scopeOf(node.process, nodeId) : undefined;
    if (nested) return nested;
  }
  return undefined;
}

/** A node branches when more than one flow leaves it and something chooses. */
function isDecision(node: FlowNode, outgoing: SequenceFlow[]): boolean {
  if (outgoing.length < 2) return false;
  if (DECIDING_GATEWAYS.has(node.kind)) return true;
  // A plain activity may also carry conditional flows.
  return outgoing.some((flow) => flow.conditionExpression);
}

function decisionPoint(
  node: FlowNode,
  outgoing: SequenceFlow[],
  nodes: Map<string, FlowNode>,
): DecisionPoint {
  const isDefault = (flow: SequenceFlow): boolean =>
    flow.isDefault === true || flow.id === node.default;

  const options = outgoing.map((flow) => {
    const option: DecisionOption = {
      flowId: flow.id,
      targetId: flow.targetRef,
      label: flow.name ?? nodes.get(flow.targetRef)?.name ?? flow.targetRef,
      isDefault: isDefault(flow),
      assignments: assignmentsFor(flow, outgoing, isDefault),
    };
    if (flow.conditionExpression) option.condition = flow.conditionExpression;
    return option;
  });

  const variables: string[] = [];
  for (const flow of outgoing) {
    for (const name of identifiersOf(flow.conditionExpression ?? '')) {
      if (!variables.includes(name)) variables.push(name);
    }
  }

  const point: DecisionPoint = { nodeId: node.id, kind: node.kind, options, variables };
  if (node.name) point.name = node.name;
  return point;
}

/**
 * Values that single out one branch: every competing condition refuted first,
 * then this flow's own condition satisfied on top — so a variable shared by two
 * branches ends up with the value this one needs.
 */
function assignmentsFor(
  chosen: SequenceFlow,
  outgoing: SequenceFlow[],
  isDefault: (flow: SequenceFlow) => boolean,
): Record<string, unknown> {
  const assignments: Record<string, unknown> = {};
  const assign = (expression: string, want: boolean): void => {
    for (const name of identifiersOf(expression)) {
      const value = inferValue(name, expression, want);
      if (value !== undefined) assignments[name] = value;
    }
  };

  for (const flow of outgoing) {
    if (flow.id === chosen.id || isDefault(flow) || !flow.conditionExpression) continue;
    assign(flow.conditionExpression, false);
  }
  if (chosen.conditionExpression) assign(chosen.conditionExpression, true);
  return assignments;
}
