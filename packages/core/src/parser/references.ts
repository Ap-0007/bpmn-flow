import { BpmnModdle } from 'bpmn-moddle';
import { BpmnParseError } from '../errors.js';
import type { MdElement } from './moddle-types.js';

/**
 * BPMN states the wiring twice: a sequence flow points at its `sourceRef` and
 * `targetRef`, and each flow node repeats it as `<bpmn:incoming>` /
 * `<bpmn:outgoing>` children. The second half is redundant — this parser
 * derives everything from the flows themselves — but tooling around the format
 * often reads only those child elements. `bpmn-auto-layout`, for one, positions
 * the nodes and draws no connection at all when they are missing.
 *
 * {@link addFlowReferences} fills them in, so a diagram authored purely in
 * terms of semantics survives a round trip through those tools.
 */

interface ModdleElement extends MdElement {
  flowElements?: ModdleElement[];
  incoming?: ModdleElement[];
  outgoing?: ModdleElement[];
}

/**
 * Returns the same XML with each flow node's `incoming`/`outgoing` references
 * spelled out, deriving them from the sequence flows of the scope. Nodes that
 * already declare them are left untouched, so calling this twice is a no-op.
 *
 * @throws {BpmnParseError} when the XML cannot be read.
 */
export async function addFlowReferences(xml: string): Promise<string> {
  const moddle = new BpmnModdle();
  let definitions: ModdleElement;
  try {
    const { rootElement } = await moddle.fromXML(xml);
    definitions = rootElement as ModdleElement;
  } catch (cause) {
    throw new BpmnParseError(
      `Failed to parse BPMN XML: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  for (const root of definitions.rootElements ?? []) {
    if (root.$type.endsWith(':Process')) linkScope(root as ModdleElement);
  }

  const { xml: serialized } = await moddle.toXML(definitions, { format: true });
  return serialized ?? xml;
}

/** Wires one scope (process or subprocess) and recurses into nested ones. */
function linkScope(scope: ModdleElement): void {
  const elements = scope.flowElements ?? [];
  const byId = new Map<string, ModdleElement>();
  for (const element of elements) {
    if (element.id) byId.set(element.id, element);
    if (element.flowElements && element.flowElements.length > 0) linkScope(element);
  }

  for (const element of elements) {
    if (!element.$type.endsWith(':SequenceFlow')) continue;
    const source = element.sourceRef?.id ? byId.get(element.sourceRef.id) : undefined;
    const target = element.targetRef?.id ? byId.get(element.targetRef.id) : undefined;
    if (source) push(source, 'outgoing', element);
    if (target) push(target, 'incoming', element);
  }
}

/** Adds the flow to the node's reference list, without duplicating it. */
function push(node: ModdleElement, key: 'incoming' | 'outgoing', flow: ModdleElement): void {
  const current = node[key] ?? [];
  if (current.some((existing) => existing.id === flow.id)) return;
  node[key] = [...current, flow];
}
