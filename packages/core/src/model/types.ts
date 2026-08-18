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

/**
 * Repetition attached to an activity.
 *
 * `multiInstance` runs the activity once per item of a collection (or a fixed
 * cardinality), in parallel or one at a time. `standard` is a plain loop driven
 * by a boolean condition.
 */
export interface LoopCharacteristics {
  kind: 'multiInstance' | 'standard';
  /** Multi-instance: run instances one at a time. Standard loops always do. */
  sequential: boolean;
  /** Expression yielding how many instances to create. */
  cardinality?: string;
  /** Variable holding the input collection (`loopDataInputRef`). */
  collection?: string;
  /** Per-instance variable receiving the current item (`inputDataItem`). */
  elementVariable?: string;
  /** Variable receiving one entry per instance (`loopDataOutputRef`). */
  outputCollection?: string;
  /** Per-instance variable read into the output collection (`outputDataItem`). */
  outputElement?: string;
  /** Multi-instance: stops the remaining instances once true. */
  completionCondition?: string;
  /** Standard loop: repeat while true. */
  loopCondition?: string;
  /** Standard loop: evaluate the condition before the first iteration. */
  testBefore?: boolean;
  /** Standard loop: hard cap on iterations. */
  maximum?: number;
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

  /** Multi-instance or standard loop attached to the activity. */
  loop?: LoopCharacteristics;

  /** Name of the lane (swimlane) the node belongs to, when the diagram has one. */
  lane?: string;
  /**
   * Roles or people expected to perform the activity, read from
   * `bpmn:potentialOwner` / `bpmn:performer`.
   */
  candidates?: string[];
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
