import { BpmnExecutionError, BpmnValidationError } from '../errors.js';
import { ProcessGraph } from '../model/graph.js';
import type { FlowNode, ProcessModel, SequenceFlow } from '../model/types.js';
import { Emitter } from './emitter.js';
import { evaluateCondition } from './expression.js';
import { BpmnError, HandlerRegistry, type TaskHandler } from './handlers.js';
import type {
  EngineEvents,
  EngineOptions,
  ExecutionSnapshot,
  ExecutionStatus,
  HistoryEntry,
  TokenSnapshot,
  WaitReason,
} from './types.js';

interface Scope {
  id: string;
  graph: ProcessGraph;
  /** Parent activity token suspended while this (sub)scope runs. */
  parentToken?: RuntimeToken;
  hostNodeId?: string;
  tokens: Set<RuntimeToken>;
}

interface RuntimeToken {
  id: string;
  nodeId: string;
  scope: Scope;
  viaFlowId?: string;
  waiting?: WaitReason;
}

interface EventChoice {
  token: RuntimeToken;
  alternatives: { eventNodeId: string; flowId: string }[];
}

const DEFAULT_MAX_STEPS = 100_000;

/**
 * Token-based BPMN execution engine.
 *
 * Drives control tokens through a process graph honoring BPMN 2.0 semantics for
 * events, all task types (via pluggable handlers), exclusive/parallel/inclusive/
 * event-based gateways, embedded subprocesses and boundary events. Execution is
 * asynchronous (handlers may be async) and deterministic (tokens are processed
 * one at a time). Progress and state changes are observable through events.
 */
export class WorkflowEngine {
  private readonly emitter = new Emitter<EngineEvents>();
  private readonly registry = new HandlerRegistry();
  private readonly rootGraph: ProcessGraph;

  private readonly scopes: Scope[] = [];
  private readonly ready: RuntimeToken[] = [];
  private readonly waiting = new Map<string, RuntimeToken>();
  private readonly parallelBuffers = new Map<string, Map<string, number>>();
  private readonly inclusiveBuffers = new Map<string, RuntimeToken[]>();
  private readonly eventChoices = new Map<string, EventChoice>();
  private readonly armedEvents = new Map<string, string>();
  private readonly completedNodes = new Set<string>();
  private readonly history: HistoryEntry[] = [];

  private variables: Record<string, unknown>;
  private status: ExecutionStatus = 'idle';
  private tokenSeq = 0;
  private scopeSeq = 0;
  private readonly maxSteps: number;
  private readonly mode: 'automation' | 'auto';
  private steps = 0;

  constructor(
    process: ProcessModel,
    private readonly options: EngineOptions = {},
  ) {
    if (!process.isExecutable) {
      throw new BpmnValidationError(`Process is not executable: ${process.id}`);
    }
    this.rootGraph = new ProcessGraph(process);
    this.variables = { ...(options.variables ?? {}) };
    this.maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
    this.mode = options.mode ?? 'automation';
  }

  // --- Public API --------------------------------------------------------

  on = this.emitter.on.bind(this.emitter);

  /** Registers a handler by node id, element kind, or `*` wildcard. */
  registerHandler(selector: string, handler: TaskHandler): this {
    this.registry.register(selector, handler);
    return this;
  }

  get currentStatus(): ExecutionStatus {
    return this.status;
  }

  /** Starts the process and runs until it completes or blocks on waits. */
  async start(): Promise<ExecutionSnapshot> {
    if (this.status !== 'idle') {
      throw new BpmnExecutionError('Engine has already been started.');
    }
    const scope = this.createScope(this.rootGraph);
    const starts = this.rootGraph.startNodes();
    if (starts.length === 0) {
      throw new BpmnValidationError('Process has no start event.');
    }
    this.status = 'running';
    this.emitter.emit('process.start', { processId: this.rootGraph.process.id });
    for (const start of starts) this.spawn(scope, start.id);
    await this.drain();
    return this.snapshot();
  }

  /** Completes a parked user/receive task, then continues execution. */
  async completeTask(tokenId: string, output?: Record<string, unknown>): Promise<ExecutionSnapshot> {
    const token = this.waiting.get(tokenId);
    if (!token) throw new BpmnExecutionError(`No waiting task token: ${tokenId}`);
    if (output) Object.assign(this.variables, output);
    this.waiting.delete(tokenId);
    token.waiting = undefined;
    this.completeNode(token);
    this.leaveViaOutgoing(token);
    await this.drain();
    return this.snapshot();
  }

  /**
   * Delivers a trigger by node id or event reference name. Resolves a waiting
   * catch event, an event-based gateway alternative, or an attached boundary
   * event — whichever matches first — then continues execution.
   */
  async signal(nameOrId: string, output?: Record<string, unknown>): Promise<ExecutionSnapshot> {
    if (output) Object.assign(this.variables, output);
    if (!this.deliverSignal(nameOrId)) {
      throw new BpmnExecutionError(`No catchable event for signal: ${nameOrId}`);
    }
    await this.drain();
    return this.snapshot();
  }

  snapshot(): ExecutionSnapshot {
    const tokens: TokenSnapshot[] = [];
    for (const scope of this.scopes) {
      for (const token of scope.tokens) {
        const node = scope.graph.node(token.nodeId);
        if (!node) continue;
        tokens.push({
          id: token.id,
          nodeId: token.nodeId,
          nodeKind: node.kind,
          scopeId: scope.id,
          waiting: token.waiting !== undefined,
          ...(token.waiting ? { waitReason: token.waiting } : {}),
        });
      }
    }
    return {
      status: this.status,
      variables: { ...this.variables },
      tokens,
      completedNodes: [...this.completedNodes],
      history: [...this.history],
    };
  }

  // --- Scope & token plumbing -------------------------------------------

  private createScope(graph: ProcessGraph, parentToken?: RuntimeToken, hostNodeId?: string): Scope {
    const scope: Scope = {
      id: `scope-${this.scopeSeq++}`,
      graph,
      tokens: new Set(),
      ...(parentToken ? { parentToken } : {}),
      ...(hostNodeId ? { hostNodeId } : {}),
    };
    this.scopes.push(scope);
    return scope;
  }

  private spawn(scope: Scope, nodeId: string, viaFlowId?: string): RuntimeToken {
    const token: RuntimeToken = {
      id: `t${this.tokenSeq++}`,
      nodeId,
      scope,
      ...(viaFlowId ? { viaFlowId } : {}),
    };
    scope.tokens.add(token);
    this.ready.push(token);
    return token;
  }

  private discard(token: RuntimeToken): void {
    token.scope.tokens.delete(token);
    this.waiting.delete(token.id);
  }

  // --- Run loop ----------------------------------------------------------

  private async drain(): Promise<void> {
    for (;;) {
      const token = this.ready.shift();
      if (token) {
        if (this.steps++ > this.maxSteps) {
          this.fail(new BpmnExecutionError('Execution exceeded maxSteps (possible infinite loop).'));
          return;
        }
        await this.processToken(token);
        continue;
      }
      // No ready tokens: check inclusive joins that can now fire.
      if (this.fireReadyInclusiveJoins()) continue;
      // Auto mode resolves the next wait to keep the simulation moving.
      if (this.mode === 'auto' && this.autoResolveWait()) continue;
      break;
    }
    this.settleStatus();
  }

  private async processToken(token: RuntimeToken): Promise<void> {
    const node = token.scope.graph.node(token.nodeId);
    if (!node) {
      this.discard(token);
      return;
    }
    this.emitter.emit('node.enter', { nodeId: node.id, nodeKind: node.kind, tokenId: token.id });
    this.history.push({ nodeId: node.id, nodeKind: node.kind, event: 'enter', at: this.history.length });

    switch (true) {
      case node.kind === 'startEvent':
        this.completeNode(token);
        this.leaveViaOutgoing(token);
        return;
      case node.kind === 'endEvent':
        await this.handleEndEvent(token, node);
        return;
      case node.kind === 'intermediateThrowEvent':
        this.completeNode(token);
        this.leaveViaOutgoing(token);
        return;
      case node.kind === 'intermediateCatchEvent':
        this.park(token, 'catchEvent');
        return;
      case node.kind === 'exclusiveGateway':
        this.handleExclusive(token, node);
        return;
      case node.kind === 'parallelGateway':
        this.handleParallel(token, node);
        return;
      case node.kind === 'inclusiveGateway':
        this.handleInclusive(token, node);
        return;
      case node.kind === 'eventBasedGateway':
        this.handleEventBased(token, node);
        return;
      case node.kind === 'complexGateway':
        // Best-effort: behave like an inclusive gateway.
        this.handleInclusive(token, node);
        return;
      case node.kind === 'subProcess' ||
        node.kind === 'transaction' ||
        node.kind === 'adHocSubProcess':
        this.handleSubProcess(token, node);
        return;
      default:
        await this.handleActivity(token, node);
        return;
    }
  }

  // --- Events ------------------------------------------------------------

  private async handleEndEvent(token: RuntimeToken, node: FlowNode): Promise<void> {
    this.completeNode(token);
    const kind = node.event?.kind ?? 'none';
    if (kind === 'terminate') {
      this.terminateScope(token.scope);
      return;
    }
    if (kind === 'error') {
      this.discard(token);
      const code = node.event?.code ?? node.event?.reference;
      if (this.raiseErrorOnHost(token.scope, code)) return;
      this.checkScopeCompletion(token.scope);
      return;
    }
    this.discard(token);
    this.checkScopeCompletion(token.scope);
  }

  // --- Activities --------------------------------------------------------

  private async handleActivity(token: RuntimeToken, node: FlowNode): Promise<void> {
    const handler = this.registry.resolve(node);
    const isWaitTask = node.kind === 'userTask' || node.kind === 'receiveTask';

    if (!handler) {
      if (isWaitTask) {
        this.park(token, node.kind === 'receiveTask' ? 'receiveTask' : 'userTask');
        return;
      }
      // Unhandled automatic task: pass straight through.
      this.completeNode(token);
      this.leaveViaOutgoing(token);
      return;
    }

    this.emitter.emit('activity.start', { nodeId: node.id, tokenId: token.id });
    try {
      const result = await handler({
        node,
        variables: this.variables,
        get: (name) => this.variables[name],
        set: (name, value) => {
          this.variables[name] = value;
        },
      });
      if (result && typeof result === 'object') Object.assign(this.variables, result);
    } catch (error) {
      if (error instanceof BpmnError) {
        this.emitter.emit('activity.end', { nodeId: node.id, tokenId: token.id });
        this.discard(token);
        if (this.raiseErrorOnActivity(token.scope, node.id, error.code)) return;
        this.fail(error);
        return;
      }
      this.fail(error instanceof Error ? error : new Error(String(error)));
      return;
    }
    this.emitter.emit('activity.end', { nodeId: node.id, tokenId: token.id });
    this.completeNode(token);
    this.leaveViaOutgoing(token);
  }

  private handleSubProcess(token: RuntimeToken, node: FlowNode): void {
    if (!node.process) {
      // Nothing to run inside: behave as a pass-through activity.
      this.completeNode(token);
      this.leaveViaOutgoing(token);
      return;
    }
    this.emitter.emit('activity.start', { nodeId: node.id, tokenId: token.id });
    token.scope.tokens.delete(token); // suspend parent while child runs
    const childGraph = new ProcessGraph(node.process);
    const child = this.createScope(childGraph, token, node.id);
    const starts = childGraph.startNodes().filter((s) => !s.event || s.event.kind === 'none');
    if (starts.length === 0) {
      // No plain start: complete immediately.
      this.finishSubProcess(child);
      return;
    }
    for (const start of starts) this.spawn(child, start.id);
  }

  private finishSubProcess(child: Scope): void {
    const parent = child.parentToken;
    const hostId = child.hostNodeId;
    this.scopes.splice(this.scopes.indexOf(child), 1);
    if (!parent || !hostId) return;
    parent.scope.tokens.add(parent);
    this.emitter.emit('activity.end', { nodeId: hostId, tokenId: parent.id });
    this.completeNode(parent);
    this.leaveViaOutgoing(parent);
  }

  // --- Gateways ----------------------------------------------------------

  private handleExclusive(token: RuntimeToken, node: FlowNode): void {
    this.completeNode(token);
    const flows = token.scope.graph.outgoing(node);
    const chosen = this.firstMatching(flows, node) ?? this.defaultFlow(flows, node);
    if (!chosen) {
      this.fail(new BpmnExecutionError(`Exclusive gateway ${node.id} has no valid outgoing flow.`));
      return;
    }
    this.moveAlong(token, chosen);
    this.discard(token);
  }

  private handleParallel(token: RuntimeToken, node: FlowNode): void {
    const incoming = node.incoming;
    if (incoming.length > 1) {
      const key = `${token.scope.id}:${node.id}`;
      const counts = this.parallelBuffers.get(key) ?? new Map<string, number>();
      if (token.viaFlowId) counts.set(token.viaFlowId, (counts.get(token.viaFlowId) ?? 0) + 1);
      this.parallelBuffers.set(key, counts);
      this.discard(token);
      const satisfied = incoming.every((f) => (counts.get(f) ?? 0) >= 1);
      if (!satisfied) return;
      for (const f of incoming) counts.set(f, (counts.get(f) ?? 0) - 1);
      this.completeNode(token);
      this.splitAll(token.scope, node);
      return;
    }
    this.completeNode(token);
    this.splitAll(token.scope, node);
    this.discard(token);
  }

  private handleInclusive(token: RuntimeToken, node: FlowNode): void {
    if (node.incoming.length > 1) {
      const key = `${token.scope.id}:${node.id}`;
      const buffer = this.inclusiveBuffers.get(key) ?? [];
      buffer.push(token);
      this.inclusiveBuffers.set(key, buffer);
      token.scope.tokens.delete(token);
      // Firing decision is made in fireReadyInclusiveJoins once quiescent.
      return;
    }
    this.completeNode(token);
    this.inclusiveSplit(token, node);
    this.discard(token);
  }

  private handleEventBased(token: RuntimeToken, node: FlowNode): void {
    this.completeNode(token);
    const flows = token.scope.graph.outgoing(node);
    const alternatives = flows.map((f) => ({ eventNodeId: f.targetRef, flowId: f.id }));
    this.eventChoices.set(token.id, { token, alternatives });
    for (const alt of alternatives) this.armedEvents.set(alt.eventNodeId, token.id);
    token.waiting = 'eventBasedGateway';
    this.waiting.set(token.id, token);
    this.emitter.emit('wait', { nodeId: node.id, tokenId: token.id, reason: 'eventBasedGateway' });
  }

  // --- Flow selection ----------------------------------------------------

  private firstMatching(flows: SequenceFlow[], node: FlowNode): SequenceFlow | undefined {
    for (const flow of flows) {
      if (flow.id === node.default) continue;
      if (!flow.conditionExpression) return flow;
      if (evaluateCondition(flow.conditionExpression, this.variables)) return flow;
    }
    return undefined;
  }

  private defaultFlow(flows: SequenceFlow[], node: FlowNode): SequenceFlow | undefined {
    if (node.default) return flows.find((f) => f.id === node.default);
    if (this.mode === 'auto') return flows[0];
    return undefined;
  }

  private inclusiveSplit(token: RuntimeToken, node: FlowNode): void {
    const flows = token.scope.graph.outgoing(node);
    const taken = flows.filter(
      (f) => f.id !== node.default && (!f.conditionExpression || evaluateCondition(f.conditionExpression, this.variables)),
    );
    const chosen = taken.length > 0 ? taken : this.defaultFlow(flows, node) ? [this.defaultFlow(flows, node)!] : [];
    if (chosen.length === 0) {
      this.fail(new BpmnExecutionError(`Inclusive gateway ${node.id} has no valid outgoing flow.`));
      return;
    }
    for (const flow of chosen) this.moveAlong(token, flow);
  }

  private splitAll(scope: Scope, node: FlowNode): void {
    for (const flow of scope.graph.outgoing(node)) {
      this.emitter.emit('flow.take', {
        flowId: flow.id,
        sourceId: flow.sourceRef,
        targetId: flow.targetRef,
        tokenId: '-',
      });
      this.spawn(scope, flow.targetRef, flow.id);
    }
  }

  private leaveViaOutgoing(token: RuntimeToken): void {
    const node = token.scope.graph.node(token.nodeId);
    if (!node) return;
    const flows = token.scope.graph.outgoing(node);
    if (flows.length === 0) {
      // Implicit end.
      this.discard(token);
      this.checkScopeCompletion(token.scope);
      return;
    }
    // Uncontrolled flow: take every unconditional/true-condition flow.
    const taken = flows.filter(
      (f) => !f.conditionExpression || evaluateCondition(f.conditionExpression, this.variables),
    );
    const chosen = taken.length > 0 ? taken : this.defaultFlow(flows, node) ? [this.defaultFlow(flows, node)!] : flows.slice(0, 1);
    for (const flow of chosen) this.moveAlong(token, flow);
    this.discard(token);
  }

  private moveAlong(token: RuntimeToken, flow: SequenceFlow): void {
    this.emitter.emit('node.leave', {
      nodeId: token.nodeId,
      nodeKind: token.scope.graph.requireNode(token.nodeId).kind,
      tokenId: token.id,
    });
    this.emitter.emit('flow.take', {
      flowId: flow.id,
      sourceId: flow.sourceRef,
      targetId: flow.targetRef,
      tokenId: token.id,
    });
    this.spawn(token.scope, flow.targetRef, flow.id);
  }

  // --- Waits, signals & boundaries --------------------------------------

  private park(token: RuntimeToken, reason: WaitReason): void {
    token.waiting = reason;
    this.waiting.set(token.id, token);
    this.emitter.emit('wait', { nodeId: token.nodeId, tokenId: token.id, reason });
  }

  private deliverSignal(nameOrId: string): boolean {
    // 1. A parked catch event (match by node id or event reference).
    for (const token of this.waiting.values()) {
      if (token.waiting !== 'catchEvent') continue;
      const node = token.scope.graph.node(token.nodeId);
      if (!node) continue;
      if (node.id === nameOrId || node.event?.reference === nameOrId) {
        this.waiting.delete(token.id);
        token.waiting = undefined;
        this.completeNode(token);
        this.leaveViaOutgoing(token);
        return true;
      }
    }
    // 2. An event-based gateway alternative.
    for (const [eventNodeId, gatewayTokenId] of this.armedEvents) {
      const choice = this.eventChoices.get(gatewayTokenId);
      if (!choice) continue;
      const scope = choice.token.scope;
      const eventNode = scope.graph.node(eventNodeId);
      if (!eventNode) continue;
      if (eventNode.id === nameOrId || eventNode.event?.reference === nameOrId) {
        this.resolveEventChoice(choice, eventNodeId);
        return true;
      }
    }
    // 3. A boundary event on an active/waiting/suspended activity.
    return this.fireBoundaryBySignal(nameOrId);
  }

  private resolveEventChoice(choice: EventChoice, eventNodeId: string): void {
    const { token, alternatives } = choice;
    this.waiting.delete(token.id);
    this.eventChoices.delete(token.id);
    for (const alt of alternatives) this.armedEvents.delete(alt.eventNodeId);
    const flow = alternatives.find((a) => a.eventNodeId === eventNodeId)?.flowId;
    token.scope.tokens.delete(token);
    // Continue from the chosen catch event onward.
    const chosen = this.spawn(token.scope, eventNodeId, flow);
    this.completeNode(chosen);
    // The catch event itself is considered already satisfied: pass through.
    this.ready.splice(this.ready.indexOf(chosen), 1);
    this.leaveViaOutgoing(chosen);
  }

  private fireBoundaryBySignal(nameOrId: string): boolean {
    for (const scope of this.scopes) {
      for (const node of scope.graph.allNodes()) {
        if (node.kind !== 'boundaryEvent' || !node.attachedToRef) continue;
        if (node.id !== nameOrId && node.event?.reference !== nameOrId) continue;
        if (this.fireBoundary(scope, node)) return true;
      }
    }
    return false;
  }

  private raiseErrorOnActivity(scope: Scope, activityId: string, code?: string): boolean {
    for (const node of scope.graph.allNodes()) {
      if (node.kind !== 'boundaryEvent' || node.attachedToRef !== activityId) continue;
      if (node.event?.kind !== 'error') continue;
      if (code && node.event.code && node.event.code !== code) continue;
      // Route from the boundary (activity token already discarded).
      const chosen = this.spawn(scope, node.id);
      this.completeNode(chosen);
      this.ready.splice(this.ready.indexOf(chosen), 1);
      this.leaveViaOutgoing(chosen);
      return true;
    }
    return false;
  }

  private raiseErrorOnHost(childScope: Scope, code?: string): boolean {
    const parent = childScope.parentToken;
    const hostId = childScope.hostNodeId;
    if (!parent || !hostId) return false;
    const found = this.raiseErrorOnActivity(parent.scope, hostId, code);
    if (found) {
      // Cancel the remaining subprocess scope and its suspended parent.
      for (const t of [...childScope.tokens]) this.discard(t);
      this.scopes.splice(this.scopes.indexOf(childScope), 1);
      this.discard(parent);
    }
    return found;
  }

  private fireBoundary(scope: Scope, boundary: FlowNode): boolean {
    const hostId = boundary.attachedToRef!;
    const interrupting = boundary.cancelActivity !== false;
    // Find the host token: a waiting task token, or a suspended subprocess parent.
    const childScope = this.scopes.find((s) => s.hostNodeId === hostId && s.parentToken);
    if (childScope) {
      if (interrupting) {
        for (const t of [...childScope.tokens]) this.discard(t);
        this.scopes.splice(this.scopes.indexOf(childScope), 1);
        const parent = childScope.parentToken!;
        this.discard(parent);
      }
      this.emitBoundary(scope, boundary);
      return true;
    }
    for (const token of scope.tokens) {
      if (token.nodeId !== hostId) continue;
      if (interrupting) this.discard(token);
      this.emitBoundary(scope, boundary);
      return true;
    }
    return false;
  }

  private emitBoundary(scope: Scope, boundary: FlowNode): void {
    const chosen = this.spawn(scope, boundary.id);
    this.completeNode(chosen);
    this.ready.splice(this.ready.indexOf(chosen), 1);
    this.leaveViaOutgoing(chosen);
  }

  // --- Inclusive join firing --------------------------------------------

  private fireReadyInclusiveJoins(): boolean {
    for (const [key, buffer] of this.inclusiveBuffers) {
      if (buffer.length === 0) continue;
      const first = buffer[0]!;
      const scope = first.scope;
      const node = scope.graph.requireNode(first.nodeId);
      if (this.canAnyTokenReach(scope, node.id, buffer)) continue;
      this.inclusiveBuffers.delete(key);
      this.completeNode(first);
      // Merge all buffered tokens into a single continuation.
      this.inclusiveSplit(first, node);
      return true;
    }
    return false;
  }

  /** True if any active token (outside `exclude`) can still reach `targetId`. */
  private canAnyTokenReach(scope: Scope, targetId: string, exclude: RuntimeToken[]): boolean {
    const excludeIds = new Set(exclude.map((t) => t.id));
    const sources: string[] = [];
    for (const token of scope.tokens) {
      if (excludeIds.has(token.id)) continue;
      sources.push(token.nodeId);
    }
    for (const t of this.ready) {
      if (t.scope === scope && !excludeIds.has(t.id)) sources.push(t.nodeId);
    }
    const visited = new Set<string>();
    const queue = [...sources];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === targetId) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      const node = scope.graph.node(current);
      if (!node || node.id === targetId) continue;
      for (const flow of scope.graph.outgoing(node)) queue.push(flow.targetRef);
    }
    return false;
  }

  // --- Auto mode & termination ------------------------------------------

  private autoResolveWait(): boolean {
    const next = this.waiting.values().next();
    if (next.done) return false;
    const token = next.value;
    if (token.waiting === 'eventBasedGateway') {
      const choice = this.eventChoices.get(token.id);
      if (choice && choice.alternatives[0]) {
        this.resolveEventChoice(choice, choice.alternatives[0].eventNodeId);
        return true;
      }
    }
    this.waiting.delete(token.id);
    token.waiting = undefined;
    this.completeNode(token);
    this.leaveViaOutgoing(token);
    return true;
  }

  private terminateScope(scope: Scope): void {
    for (const token of [...scope.tokens]) this.discard(token);
    if (scope.parentToken) {
      this.finishSubProcess(scope);
    } else {
      this.status = 'terminated';
    }
  }

  private checkScopeCompletion(scope: Scope): void {
    if (scope.tokens.size > 0) return;
    if (this.hasPendingFor(scope)) return;
    if (scope.parentToken) {
      this.finishSubProcess(scope);
    }
  }

  private hasPendingFor(scope: Scope): boolean {
    for (const key of this.inclusiveBuffers.keys()) {
      if (key.startsWith(`${scope.id}:`) && this.inclusiveBuffers.get(key)!.length > 0) return true;
    }
    return false;
  }

  private completeNode(token: RuntimeToken): void {
    this.completedNodes.add(token.nodeId);
    const node = token.scope.graph.node(token.nodeId);
    if (node) {
      this.history.push({ nodeId: node.id, nodeKind: node.kind, event: 'complete', at: this.history.length });
    }
  }

  private fail(error: Error): void {
    this.status = 'failed';
    this.emitter.emit('error', { error });
    this.ready.length = 0;
  }

  private settleStatus(): void {
    if (this.status === 'failed' || this.status === 'terminated') {
      this.emitFinal();
      return;
    }
    const hasTokens = this.scopes.some((s) => s.tokens.size > 0);
    const hasBuffers = [...this.inclusiveBuffers.values()].some((b) => b.length > 0);
    if (!hasTokens && !hasBuffers) {
      this.status = 'completed';
      this.emitFinal();
      return;
    }
    this.status = this.waiting.size > 0 ? 'waiting' : 'running';
  }

  private emitFinal(): void {
    this.emitter.emit('process.end', { processId: this.rootGraph.process.id, status: this.status });
  }
}
