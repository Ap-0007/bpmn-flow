import type { ElementKind, EventDefinitionKind } from './kinds.js';

/**
 * Normalized, serializable BPMN model.
 *
 * This is a semantic view of a process: it deliberately omits diagram
 * interchange (DI) layout data, which the viewer reads straight from the raw
 * XML. Everything here is plain data so it can cross a network boundary or be
 * persisted without loss.
 */

/** A directed connection between two flow nodes within a process scope. */
export interface SequenceFlow {
  id: string;
  name?: string;
  sourceRef: string;
  targetRef: string;
  /**
   * FEEL/JavaScript-like boolean expression guarding the flow. Evaluated by the
   * engine against the process variables when leaving a gateway or activity.
   */
  conditionExpression?: string;
  /** True when this flow is the default branch of its source gateway/activity. */
  isDefault?: boolean;
}

/** Structured detail attached to an event via its event definition. */
export interface EventDetail {
  kind: EventDefinitionKind;
  /** Message/signal/error/escalation name, when applicable. */
  reference?: string;
  /** ISO-8601 duration/date or cron for timer events (e.g. "PT5M"). */
  timer?: string;
  /** Error/escalation code, when applicable. */
  code?: string;
}

/** A single node in a process graph (event, task, gateway or subprocess). */
export interface FlowNode {
  id: string;
  kind: ElementKind;
  name?: string;
  incoming: string[];
  outgoing: string[];

  /** Present on events; describes the trigger. Defaults to `none`. */
  event?: EventDetail;

  /** Boundary events: id of the activity they are attached to. */
  attachedToRef?: string;
  /** Boundary events: false for non-interrupting boundary events. */
  cancelActivity?: boolean;

  /** Gateways / activities: id of the default outgoing sequence flow. */
  default?: string;

  /** Sub-processes: id of a called global process (call activity). */
  calledElement?: string;
  /** Event sub-processes are triggered by their start event, not by a token. */
  triggeredByEvent?: boolean;
  /** Nested scope for subprocess-like nodes. */
  process?: ProcessModel;
}

/** A participant (pool) in a collaboration. */
export interface Participant {
  id: string;
  name?: string;
  processRef?: string;
}

/** A message flow between two participants/nodes in a collaboration. */
export interface MessageFlow {
  id: string;
  name?: string;
  sourceRef?: string;
  targetRef?: string;
}

/** A single BPMN process definition. */
export interface ProcessModel {
  id: string;
  name?: string;
  isExecutable: boolean;
  flowNodes: FlowNode[];
  sequenceFlows: SequenceFlow[];
}

/** Root of a parsed BPMN file: one or more processes plus collaboration info. */
export interface BpmnModel {
  id: string;
  name?: string;
  processes: ProcessModel[];
  participants: Participant[];
  messageFlows: MessageFlow[];
}
