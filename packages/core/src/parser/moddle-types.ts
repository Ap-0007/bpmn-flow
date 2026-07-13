/**
 * Structural view of the subset of the bpmn-moddle object tree consumed by the
 * parser. bpmn-moddle returns plain objects tagged with a `$type` discriminator
 * and cross-references resolved to object pointers (e.g. `sourceRef` is the
 * referenced element, not an id string).
 */

export interface MdRef {
  $type?: string;
  id?: string;
}

export interface MdEventDefinition {
  $type: string;
  timeDuration?: { body?: string };
  timeDate?: { body?: string };
  timeCycle?: { body?: string };
  messageRef?: MdRef & { name?: string };
  signalRef?: MdRef & { name?: string };
  errorRef?: MdRef & { name?: string; errorCode?: string };
  escalationRef?: MdRef & { name?: string; escalationCode?: string };
}

export interface MdElement {
  $type: string;
  id?: string;
  name?: string;

  // bpmn:Definitions
  rootElements?: MdElement[];

  // bpmn:Process / bpmn:SubProcess
  isExecutable?: boolean;
  flowElements?: MdElement[];
  triggeredByEvent?: boolean;

  // flow node wiring (arrays of resolved sequence-flow objects)
  incoming?: MdRef[];
  outgoing?: MdRef[];

  // events
  eventDefinitions?: MdEventDefinition[];
  attachedToRef?: MdRef;
  cancelActivity?: boolean;

  // gateways / activities
  default?: MdRef;

  // call activity
  calledElement?: string;

  // sequence flow
  sourceRef?: MdRef;
  targetRef?: MdRef;
  conditionExpression?: { body?: string };

  // collaboration
  participants?: MdElement[];
  processRef?: MdRef;
  messageFlows?: MdElement[];
}
