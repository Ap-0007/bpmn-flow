import type { FlowNode, ProcessModel, SequenceFlow } from './types.js';

/**
 * Indexed, read-only view over a {@link ProcessModel} that gives the engine
 * O(1) access to nodes and flows instead of repeatedly scanning arrays.
 *
 * Built once per process scope and reused across the whole execution.
 */
export class ProcessGraph {
  private readonly nodes = new Map<string, FlowNode>();
  private readonly flows = new Map<string, SequenceFlow>();
  private readonly boundaryByHost = new Map<string, FlowNode[]>();

  constructor(readonly process: ProcessModel) {
    for (const node of process.flowNodes) {
      this.nodes.set(node.id, node);
    }
    for (const flow of process.sequenceFlows) {
      this.flows.set(flow.id, flow);
    }
    for (const node of process.flowNodes) {
      if (node.kind === 'boundaryEvent' && node.attachedToRef) {
        const list = this.boundaryByHost.get(node.attachedToRef) ?? [];
        list.push(node);
        this.boundaryByHost.set(node.attachedToRef, list);
      }
    }
  }

  node(id: string): FlowNode | undefined {
    return this.nodes.get(id);
  }

  requireNode(id: string): FlowNode {
    const node = this.nodes.get(id);
    if (!node) throw new Error(`Flow node not found: ${id}`);
    return node;
  }

  flow(id: string): SequenceFlow | undefined {
    return this.flows.get(id);
  }

  requireFlow(id: string): SequenceFlow {
    const flow = this.flows.get(id);
    if (!flow) throw new Error(`Sequence flow not found: ${id}`);
    return flow;
  }

  outgoing(node: FlowNode): SequenceFlow[] {
    return node.outgoing.map((id) => this.requireFlow(id));
  }

  incoming(node: FlowNode): SequenceFlow[] {
    return node.incoming.map((id) => this.requireFlow(id));
  }

  /** Elements associated to the given source (compensation wiring). */
  associationsFrom(sourceId: string): string[] {
    return (this.process.associations ?? [])
      .filter((association) => association.sourceRef === sourceId)
      .map((association) => association.targetRef);
  }

  /** Boundary events attached to the given activity id. */
  boundaryEvents(hostId: string): FlowNode[] {
    return this.boundaryByHost.get(hostId) ?? [];
  }

  /** Nodes with no incoming sequence flow and a start-event kind. */
  startNodes(): FlowNode[] {
    return this.process.flowNodes.filter((n) => n.kind === 'startEvent' && n.incoming.length === 0);
  }

  allNodes(): FlowNode[] {
    return this.process.flowNodes;
  }
}
