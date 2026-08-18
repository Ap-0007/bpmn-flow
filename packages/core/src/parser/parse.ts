import { BpmnModdle } from 'bpmn-moddle';
import { BpmnParseError } from '../errors.js';
import type { ElementKind, EventDefinitionKind } from '../model/kinds.js';
import {
  EVENT_KINDS,
  GATEWAY_KINDS,
  SUBPROCESS_KINDS,
  TASK_KINDS,
  isEventKind,
} from '../model/kinds.js';
import type {
  BpmnModel,
  EventDetail,
  FlowNode,
  LoopCharacteristics,
  MessageFlow,
  Participant,
  ProcessModel,
  SequenceFlow,
} from '../model/types.js';
import type { MdElement, MdEventDefinition, MdLoopCharacteristics } from './moddle-types.js';

const ELEMENT_KINDS = new Set<string>([
  ...EVENT_KINDS,
  ...TASK_KINDS,
  ...SUBPROCESS_KINDS,
  ...GATEWAY_KINDS,
]);

/** `bpmn:StartEvent` -> `startEvent`. Returns null for non-flow-node types. */
function toElementKind($type: string): ElementKind | null {
  const local = $type.replace(/^[^:]+:/, '');
  const camel = local.charAt(0).toLowerCase() + local.slice(1);
  return ELEMENT_KINDS.has(camel) ? (camel as ElementKind) : null;
}

/** `bpmn:TimerEventDefinition` -> `timer`. */
function toEventDefinitionKind($type: string): EventDefinitionKind {
  const local = $type.replace(/^[^:]+:/, '').replace(/EventDefinition$/, '');
  const camel = local.charAt(0).toLowerCase() + local.slice(1);
  return camel as EventDefinitionKind;
}

function readEventDetail(defs: MdEventDefinition[] | undefined): EventDetail | undefined {
  if (!defs || defs.length === 0) return { kind: 'none' };
  const def = defs[0];
  if (!def) return { kind: 'none' };
  const kind = toEventDefinitionKind(def.$type);
  const detail: EventDetail = { kind };
  const timer = def.timeDuration?.body ?? def.timeDate?.body ?? def.timeCycle?.body;
  if (timer) detail.timer = timer;
  const reference =
    def.messageRef?.name ?? def.signalRef?.name ?? def.errorRef?.name ?? def.escalationRef?.name;
  if (reference) detail.reference = reference;
  const code = def.errorRef?.errorCode ?? def.escalationRef?.escalationCode;
  if (code) detail.code = code;
  return detail;
}

/**
 * Reads multi-instance / standard loop characteristics.
 *
 * Collections come from `loopDataInputRef`, which the spec models as a
 * reference to a data element: the referenced element's name (or id) is used as
 * the process variable holding the array.
 */
function readLoopCharacteristics(
  lc: MdLoopCharacteristics | undefined,
): LoopCharacteristics | undefined {
  if (!lc) return undefined;
  const nameOf = (ref: { id?: string; name?: string } | undefined): string | undefined =>
    ref ? (ref.name ?? ref.id) : undefined;

  if (lc.$type.endsWith(':StandardLoopCharacteristics')) {
    const loop: LoopCharacteristics = { kind: 'standard', sequential: true };
    if (lc.loopCondition?.body) loop.loopCondition = lc.loopCondition.body;
    if (lc.testBefore !== undefined) loop.testBefore = lc.testBefore;
    const maximum = lc.loopMaximum === undefined ? undefined : Number(lc.loopMaximum);
    if (maximum !== undefined && Number.isFinite(maximum)) loop.maximum = maximum;
    return loop;
  }

  const loop: LoopCharacteristics = {
    kind: 'multiInstance',
    sequential: lc.isSequential === true,
  };
  if (lc.loopCardinality?.body) loop.cardinality = lc.loopCardinality.body;
  const collection = nameOf(lc.loopDataInputRef);
  if (collection) loop.collection = collection;
  const elementVariable = nameOf(lc.inputDataItem);
  if (elementVariable) loop.elementVariable = elementVariable;
  const outputCollection = nameOf(lc.loopDataOutputRef);
  if (outputCollection) loop.outputCollection = outputCollection;
  const outputElement = nameOf(lc.outputDataItem);
  if (outputElement) loop.outputElement = outputElement;
  if (lc.completionCondition?.body) loop.completionCondition = lc.completionCondition.body;
  return loop;
}

interface ScopeAccumulator {
  nodes: FlowNode[];
  flows: SequenceFlow[];
}

/** Recursively walks a process/subprocess scope into normalized model arrays. */
function readScope(elements: MdElement[]): ScopeAccumulator {
  const nodes = new Map<string, FlowNode>();
  const flows: SequenceFlow[] = [];

  // First pass: flow nodes (so we can wire flows onto them afterwards).
  for (const el of elements) {
    const kind = toElementKind(el.$type);
    if (!kind || !el.id) continue;

    const node: FlowNode = { id: el.id, kind, incoming: [], outgoing: [] };
    if (el.name) node.name = el.name;
    if (isEventKind(kind)) node.event = readEventDetail(el.eventDefinitions);
    if (kind === 'boundaryEvent') {
      if (el.attachedToRef?.id) node.attachedToRef = el.attachedToRef.id;
      node.cancelActivity = el.cancelActivity !== false;
    }
    if (el.default?.id) node.default = el.default.id;
    if (el.calledElement) node.calledElement = el.calledElement;
    const loop = readLoopCharacteristics(el.loopCharacteristics);
    if (loop) node.loop = loop;
    if (el.triggeredByEvent) node.triggeredByEvent = true;
    if (el.flowElements && el.flowElements.length > 0) {
      const inner = readScope(el.flowElements);
      node.process = {
        id: el.id,
        isExecutable: true,
        flowNodes: inner.nodes,
        sequenceFlows: inner.flows,
      };
    }
    nodes.set(node.id, node);
  }

  // Second pass: sequence flows, wiring incoming/outgoing from the flows
  // themselves rather than trusting the optional node arrays.
  for (const el of elements) {
    if (toElementKind(el.$type) !== null) continue;
    if (el.$type.endsWith(':SequenceFlow') && el.id && el.sourceRef?.id && el.targetRef?.id) {
      const flow: SequenceFlow = {
        id: el.id,
        sourceRef: el.sourceRef.id,
        targetRef: el.targetRef.id,
      };
      if (el.name) flow.name = el.name;
      if (el.conditionExpression?.body) flow.conditionExpression = el.conditionExpression.body;
      flows.push(flow);
      nodes.get(el.sourceRef.id)?.outgoing.push(el.id);
      nodes.get(el.targetRef.id)?.incoming.push(el.id);
    }
  }

  // Mark default flows for readability of the model.
  for (const node of nodes.values()) {
    if (node.default) {
      const def = flows.find((f) => f.id === node.default);
      if (def) def.isDefault = true;
    }
  }

  return { nodes: [...nodes.values()], flows };
}

function readProcess(el: MdElement): ProcessModel {
  const scope = readScope(el.flowElements ?? []);
  const process: ProcessModel = {
    id: el.id ?? 'process',
    isExecutable: el.isExecutable !== false,
    flowNodes: scope.nodes,
    sequenceFlows: scope.flows,
  };
  if (el.name) process.name = el.name;
  return process;
}

/**
 * Parses BPMN 2.0 XML into a normalized {@link BpmnModel}.
 *
 * Recognizes every standard flow node (events with their definitions, all task
 * types, gateways, subprocesses and call activities), sequence flows with
 * conditions, and collaboration participants/message flows. Diagram layout is
 * intentionally ignored; the viewer renders directly from the XML.
 *
 * @throws {BpmnParseError} when the XML is malformed or contains no process.
 */
export async function parseBpmn(xml: string): Promise<BpmnModel> {
  const moddle = new BpmnModdle();
  let rootElement: unknown;
  try {
    ({ rootElement } = await moddle.fromXML(xml));
  } catch (cause) {
    throw new BpmnParseError(
      `Failed to parse BPMN XML: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  const definitions = rootElement as MdElement;
  const roots = definitions.rootElements ?? [];

  const processes: ProcessModel[] = [];
  const participants: Participant[] = [];
  const messageFlows: MessageFlow[] = [];

  for (const root of roots) {
    if (root.$type.endsWith(':Process')) {
      processes.push(readProcess(root));
    } else if (root.$type.endsWith(':Collaboration')) {
      for (const part of root.participants ?? []) {
        const participant: Participant = { id: part.id ?? '' };
        if (part.name) participant.name = part.name;
        if (part.processRef?.id) participant.processRef = part.processRef.id;
        participants.push(participant);
      }
      for (const mf of root.messageFlows ?? []) {
        const messageFlow: MessageFlow = { id: mf.id ?? '' };
        if (mf.name) messageFlow.name = mf.name;
        if (mf.sourceRef?.id) messageFlow.sourceRef = mf.sourceRef.id;
        if (mf.targetRef?.id) messageFlow.targetRef = mf.targetRef.id;
        messageFlows.push(messageFlow);
      }
    }
  }

  if (processes.length === 0) {
    throw new BpmnParseError('No BPMN process found in the provided XML.');
  }

  const model: BpmnModel = {
    id: definitions.id ?? 'definitions',
    processes,
    participants,
    messageFlows,
  };
  if (definitions.name) model.name = definitions.name;
  return model;
}
