import { BpmnExecutionError, BpmnValidationError } from '../errors.js';
import { ProcessGraph } from '../model/graph.js';
import { isActivityKind } from '../model/kinds.js';
import type { FlowNode, LoopCharacteristics, ProcessModel, SequenceFlow } from '../model/types.js';
import { Emitter } from './emitter.js';
import { evaluateCondition, evaluateExpression } from './expression.js';
import { BpmnError, HandlerRegistry, type TaskHandler } from './handlers.js';
import {
  ENGINE_STATE_VERSION,
  type EngineState,
  type ScopeState,
  type TokenState,
  type TimerState,
} from './state.js';
import { resolveTimerDueAt } from './timers.js';
import type {
  EngineEvents,
  EngineOptions,
  ExecutionSnapshot,
  ExecutionStatus,
  HistoryEntry,
  PendingTask,
  TaskFilter,
  TokenSnapshot,
  WaitReason,
} from './types.js';

interface Scope {
  id: string;
  graph: ProcessGraph;
  /** Parent activity token suspended while this (sub)scope runs. */
  parentToken?: RuntimeToken;
  /** Scope that hosts this one; absent on the root scope. */
  parentScopeId?: string;
  /** Live reference to the hosting scope, used to resolve variables. */
  parentScope?: Scope;
  hostNodeId?: string;
  /** Data local to this scope; reads fall through to the parent chain. */
  variables: Record<string, unknown>;
  /** Set on scopes created for one instance of a loop/multi-instance activity. */
  loopId?: string;
  tokens: Set<RuntimeToken>;
}

interface RuntimeToken {
  id: string;
  nodeId: string;
  scope: Scope;
  viaFlowId?: string;
  waiting?: WaitReason;
  /** Set on the token running one instance of a loop activity. */
  loopInstanceOf?: string;
}

/** Bookkeeping for an activity being repeated (multi-instance or loop). */
interface LoopRun {
  id: string;
  nodeId: string;
  /** Scope the repeated activity belongs to. */
  scope: Scope;
  /** Token suspended until every instance finishes. */
  parentToken: RuntimeToken;
  loop: LoopCharacteristics;
  items?: unknown[];
  total: number;
  started: number;
  completed: number;
  instanceScopes: Set<Scope>;
}

interface EventChoice {
  token: RuntimeToken;
  alternatives: { eventNodeId: string; flowId: string }[];
}

const DEFAULT_MAX_STEPS = 100_000;
/** Standard loops without `loopMaximum` still need a ceiling. */
const DEFAULT_LOOP_MAXIMUM = 1_000;

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
  private readonly loops = new Map<string, LoopRun>();
  /** Pending timers keyed by `tokenId:nodeId`. */
  private readonly timers = new Map<string, TimerState>();
  private readonly armedEvents = new Map<string, string>();
  private readonly completedNodes = new Set<string>();
  private readonly history: HistoryEntry[] = [];

  private readonly initialVariables: Record<string, unknown>;
  private status: ExecutionStatus = 'idle';
  private tokenSeq = 0;
  private scopeSeq = 0;
  private loopSeq = 0;
  private readonly now: () => number;
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
    this.initialVariables = { ...(options.variables ?? {}) };
    this.maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
    this.mode = options.mode ?? 'automation';
    this.now = options.now ?? (() => Date.now());
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
    Object.assign(scope.variables, this.initialVariables);
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
  async completeTask(
    tokenId: string,
    output?: Record<string, unknown>,
  ): Promise<ExecutionSnapshot> {
    const token = this.waiting.get(tokenId);
    if (!token) throw new BpmnExecutionError(`No waiting task token: ${tokenId}`);
    if (output) this.assignVariables(token.scope, output);
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
    if (output) this.assignVariables(this.scopes[0], output);
    if (!this.deliverSignal(nameOrId)) {
      throw new BpmnExecutionError(`No catchable event for signal: ${nameOrId}`);
    }
    await this.drain();
    return this.snapshot();
  }

  /**
   * Work currently waiting on a person or an external trigger: user tasks,
   * receive tasks and catch events, with the lane and the roles that may act on
   * them. This is the task list a UI renders as an inbox.
   */
  tasks(filter: TaskFilter = {}): PendingTask[] {
    const tasks: PendingTask[] = [];
    for (const token of this.waiting.values()) {
      const node = token.scope.graph.node(token.nodeId);
      if (!node || !token.waiting) continue;
      const candidates = node.candidates ?? [];
      const task: PendingTask = {
        tokenId: token.id,
        nodeId: node.id,
        nodeKind: node.kind,
        reason: token.waiting,
        scopeId: token.scope.id,
        candidates,
        variables: this.mergedVariables(token.scope),
        ...(node.name ? { name: node.name } : {}),
        ...(node.lane ? { lane: node.lane } : {}),
      };
      if (!matchesFilter(task, filter)) continue;
      tasks.push(task);
    }
    return tasks;
  }

  /**
   * Timers waiting to fire, earliest first. A host can use the first due date
   * to decide when to call {@link tick} again.
   */
  dueTimers(): TimerState[] {
    return [...this.timers.values()].sort((a, b) => a.dueAt - b.dueAt);
  }

  /** Epoch milliseconds of the next timer, or `undefined` when there is none. */
  nextTimerAt(): number | undefined {
    return this.dueTimers()[0]?.dueAt;
  }

  /**
   * Fires every timer due at `now` (defaults to the engine clock) and continues
   * the execution. Nothing due means nothing changes.
   */
  async tick(now: number = this.now()): Promise<ExecutionSnapshot> {
    let fired = false;
    for (const entry of this.dueTimers()) {
      if (entry.dueAt > now) break;
      if (!this.timers.has(timerKey(entry.tokenId, entry.nodeId))) continue;
      if (this.fireTimer(entry)) fired = true;
    }
    if (fired) await this.drain();
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
      variables: this.rootVariables(),
      tokens,
      completedNodes: [...this.completedNodes],
      history: [...this.history],
    };
  }

  /**
   * Serializes everything needed to continue this execution later: scope tree,
   * every token (including suspended parents and tokens buffered at inclusive
   * joins), gateway buffers, armed events and id sequences.
   *
   * Handlers and listeners are not serializable; register them again on the
   * restored engine.
   */
  getState(): EngineState {
    const tokens = new Map<string, TokenState>();
    const record = (token: RuntimeToken, placement: TokenState['placement']): void => {
      tokens.set(token.id, {
        id: token.id,
        nodeId: token.nodeId,
        scopeId: token.scope.id,
        ...(token.viaFlowId ? { viaFlowId: token.viaFlowId } : {}),
        ...(token.waiting ? { waiting: token.waiting } : {}),
        ...(placement && placement !== 'active' ? { placement } : {}),
        ...(token.loopInstanceOf ? { loopInstanceOf: token.loopInstanceOf } : {}),
      });
    };

    for (const scope of this.scopes) {
      for (const token of scope.tokens) record(token, 'active');
      // Suspended parents live outside their scope's token set.
      if (scope.parentToken) record(scope.parentToken, 'suspended');
    }
    for (const buffer of this.inclusiveBuffers.values()) {
      for (const token of buffer) record(token, 'inclusiveJoin');
    }
    // A token repeating an activity is suspended outside every scope too.
    for (const run of this.loops.values()) record(run.parentToken, 'suspended');

    return {
      version: ENGINE_STATE_VERSION,
      processId: this.rootGraph.process.id,
      status: this.status,
      mode: this.mode,
      maxSteps: this.maxSteps,
      steps: this.steps,
      variables: this.rootVariables(),
      tokenSeq: this.tokenSeq,
      scopeSeq: this.scopeSeq,
      loopSeq: this.loopSeq,
      scopes: this.scopes.map((scope) => ({
        id: scope.id,
        ...(scope.parentScopeId ? { parentScopeId: scope.parentScopeId } : {}),
        ...(scope.hostNodeId ? { hostNodeId: scope.hostNodeId } : {}),
        ...(scope.parentToken ? { parentTokenId: scope.parentToken.id } : {}),
        ...(scope.loopId ? { loopId: scope.loopId } : {}),
        variables: { ...scope.variables },
      })),
      tokens: [...tokens.values()],
      ready: this.ready.map((token) => token.id),
      completedNodes: [...this.completedNodes],
      history: [...this.history],
      parallelBuffers: [...this.parallelBuffers].map(([key, counts]) => ({
        key,
        counts: [...counts],
      })),
      inclusiveBuffers: [...this.inclusiveBuffers].map(([key, buffer]) => ({
        key,
        tokenIds: buffer.map((token) => token.id),
      })),
      eventChoices: [...this.eventChoices].map(([tokenId, choice]) => ({
        tokenId,
        alternatives: choice.alternatives.map((alt) => ({ ...alt })),
      })),
      armedEvents: [...this.armedEvents],
      timers: [...this.timers.values()].map((timer) => ({ ...timer })),
      loops: [...this.loops.values()].map((run) => ({
        id: run.id,
        nodeId: run.nodeId,
        scopeId: run.scope.id,
        parentTokenId: run.parentToken.id,
        ...(run.items ? { items: run.items } : {}),
        total: run.total,
        started: run.started,
        completed: run.completed,
        instanceScopeIds: [...run.instanceScopes].map((scope) => scope.id),
      })),
    };
  }

  /**
   * Rebuilds an engine from a previously stored {@link EngineState}, so an
   * execution can survive a restart or move between processes.
   *
   * The process model must be the same one the state was produced from.
   * Re-register handlers and listeners before resuming.
   */
  static restore(
    process: ProcessModel,
    state: EngineState,
    options: Pick<EngineOptions, 'mode' | 'maxSteps'> = {},
  ): WorkflowEngine {
    if (state.version !== ENGINE_STATE_VERSION) {
      throw new BpmnValidationError(
        `Unsupported engine state version ${state.version}; expected ${ENGINE_STATE_VERSION}.`,
      );
    }
    if (state.processId !== process.id) {
      throw new BpmnValidationError(
        `State belongs to process "${state.processId}", not "${process.id}".`,
      );
    }
    const engine = new WorkflowEngine(process, {
      mode: options.mode ?? state.mode,
      maxSteps: options.maxSteps ?? state.maxSteps,
      variables: state.variables,
    });
    engine.hydrate(state);
    return engine;
  }

  /**
   * Continues a restored (or otherwise paused) execution until it completes or
   * blocks again. Returns immediately when the process already ended.
   */
  async resume(): Promise<ExecutionSnapshot> {
    if (this.status === 'idle') {
      throw new BpmnExecutionError('Engine has not been started; call start() first.');
    }
    if (this.status === 'completed' || this.status === 'terminated' || this.status === 'failed') {
      return this.snapshot();
    }
    await this.drain();
    return this.snapshot();
  }

  private hydrate(state: EngineState): void {
    this.status = state.status;
    this.steps = state.steps;
    this.tokenSeq = state.tokenSeq;
    this.scopeSeq = state.scopeSeq;
    this.loopSeq = state.loopSeq;
    for (const nodeId of state.completedNodes) this.completedNodes.add(nodeId);
    this.history.push(...state.history);

    // Scopes come out in creation order, so a parent is always rebuilt first.
    const scopesById = new Map<string, Scope>();
    for (const stored of state.scopes) {
      const parentScope = stored.parentScopeId ? scopesById.get(stored.parentScopeId) : undefined;
      const scope: Scope = {
        id: stored.id,
        graph: this.graphForScope(stored, scopesById),
        tokens: new Set(),
        variables: { ...stored.variables },
        ...(stored.parentScopeId ? { parentScopeId: stored.parentScopeId } : {}),
        ...(parentScope ? { parentScope } : {}),
        ...(stored.hostNodeId ? { hostNodeId: stored.hostNodeId } : {}),
        ...(stored.loopId ? { loopId: stored.loopId } : {}),
      };
      scopesById.set(scope.id, scope);
      this.scopes.push(scope);
    }

    const tokensById = new Map<string, RuntimeToken>();
    for (const stored of state.tokens) {
      const scope = scopesById.get(stored.scopeId);
      if (!scope) {
        throw new BpmnValidationError(
          `Token ${stored.id} references unknown scope ${stored.scopeId}.`,
        );
      }
      const token: RuntimeToken = {
        id: stored.id,
        nodeId: stored.nodeId,
        scope,
        ...(stored.viaFlowId ? { viaFlowId: stored.viaFlowId } : {}),
        ...(stored.waiting ? { waiting: stored.waiting } : {}),
        ...(stored.loopInstanceOf ? { loopInstanceOf: stored.loopInstanceOf } : {}),
      };
      tokensById.set(token.id, token);
      // Suspended parents and tokens buffered at a join sit outside the scope.
      if ((stored.placement ?? 'active') === 'active') scope.tokens.add(token);
      if (token.waiting) this.waiting.set(token.id, token);
    }

    for (const stored of state.scopes) {
      if (!stored.parentTokenId) continue;
      const parent = tokensById.get(stored.parentTokenId);
      const scope = scopesById.get(stored.id);
      if (parent && scope) scope.parentToken = parent;
    }

    for (const tokenId of state.ready) {
      const token = tokensById.get(tokenId);
      if (token) this.ready.push(token);
    }

    for (const buffer of state.parallelBuffers) {
      this.parallelBuffers.set(buffer.key, new Map(buffer.counts));
    }
    for (const buffer of state.inclusiveBuffers) {
      const restored = buffer.tokenIds
        .map((id) => tokensById.get(id))
        .filter((token): token is RuntimeToken => token !== undefined);
      this.inclusiveBuffers.set(buffer.key, restored);
    }
    for (const choice of state.eventChoices) {
      const token = tokensById.get(choice.tokenId);
      if (!token) continue;
      this.eventChoices.set(choice.tokenId, {
        token,
        alternatives: choice.alternatives.map((alt) => ({ ...alt })),
      });
    }
    for (const [eventNodeId, tokenId] of state.armedEvents) {
      this.armedEvents.set(eventNodeId, tokenId);
    }

    for (const timer of state.timers) {
      this.timers.set(timerKey(timer.tokenId, timer.nodeId), { ...timer });
    }

    for (const stored of state.loops) {
      const scope = scopesById.get(stored.scopeId);
      const parentToken = tokensById.get(stored.parentTokenId);
      const loop = scope?.graph.node(stored.nodeId)?.loop;
      if (!scope || !parentToken || !loop) {
        throw new BpmnValidationError(`Cannot restore loop ${stored.id} on node ${stored.nodeId}.`);
      }
      this.loops.set(stored.id, {
        id: stored.id,
        nodeId: stored.nodeId,
        scope,
        parentToken,
        loop,
        ...(stored.items ? { items: stored.items } : {}),
        total: stored.total,
        started: stored.started,
        completed: stored.completed,
        instanceScopes: new Set(
          stored.instanceScopeIds
            .map((id) => scopesById.get(id))
            .filter((s): s is Scope => s !== undefined),
        ),
      });
    }
  }

  /**
   * Root scope uses the root graph, a subprocess scope its host's inner
   * process, and a loop instance scope the same graph as the activity it
   * repeats.
   */
  private graphForScope(stored: ScopeState, scopesById: Map<string, Scope>): ProcessGraph {
    const { parentScopeId, hostNodeId, loopId } = stored;
    if (!parentScopeId) return this.rootGraph;
    const parent = scopesById.get(parentScopeId);
    if (!parent) throw new BpmnValidationError(`Unknown parent scope: ${parentScopeId}.`);
    if (loopId) return parent.graph;
    if (!hostNodeId) throw new BpmnValidationError(`Child scope ${stored.id} has no host node.`);
    const host = parent.graph.requireNode(hostNodeId);
    if (!host.process) {
      throw new BpmnValidationError(`Host node ${hostNodeId} no longer defines a subprocess.`);
    }
    return new ProcessGraph(host.process);
  }

  // --- Scope & token plumbing -------------------------------------------

  private createScope(graph: ProcessGraph, parentToken?: RuntimeToken, hostNodeId?: string): Scope {
    const scope: Scope = {
      id: `scope-${this.scopeSeq++}`,
      graph,
      tokens: new Set(),
      variables: {},
      ...(parentToken
        ? { parentToken, parentScope: parentToken.scope, parentScopeId: parentToken.scope.id }
        : {}),
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
    this.clearTimersFor(token.id);
  }

  /** Moves a token from a link throw event to the matching link catch event. */
  private followLink(token: RuntimeToken, node: FlowNode): boolean {
    const name = node.event?.reference;
    const target = token.scope.graph
      .allNodes()
      .find(
        (candidate) =>
          candidate.kind === 'intermediateCatchEvent' &&
          candidate.event?.kind === 'link' &&
          candidate.event.reference === name,
      );
    if (!target) return false;

    this.completeNode(token);
    this.discard(token);
    // The catch side is satisfied by the jump: continue from its outgoing flow.
    const arrived = this.spawn(token.scope, target.id);
    this.completeNode(arrived);
    this.ready.splice(this.ready.indexOf(arrived), 1);
    this.leaveViaOutgoing(arrived);
    return true;
  }

  // --- Timers ------------------------------------------------------------

  /**
   * Arms the timers a parked token is subject to: the timer catch event it sits
   * on, plus any timer boundary event attached to the activity.
   */
  private armTimers(token: RuntimeToken): void {
    const node = token.scope.graph.node(token.nodeId);
    if (!node) return;
    if (node.event?.kind === 'timer' && node.kind !== 'boundaryEvent') {
      this.armTimer(token, node, 'catch', node.event.timer);
    }
    this.armBoundaryTimers(token);
  }

  /** Arms timer boundary events attached to the activity the token sits on. */
  private armBoundaryTimers(token: RuntimeToken): void {
    for (const boundary of token.scope.graph.boundaryEvents(token.nodeId)) {
      if (boundary.event?.kind !== 'timer') continue;
      this.armTimer(token, boundary, 'boundary', boundary.event.timer);
    }
  }

  private armTimer(
    token: RuntimeToken,
    node: FlowNode,
    kind: TimerState['kind'],
    definition: string | undefined,
  ): void {
    // Without a definition there is nothing to schedule: the event still works
    // through an explicit signal.
    if (!definition) return;
    const dueAt = resolveTimerDueAt(definition, this.now());
    if (dueAt === undefined) return;
    this.timers.set(timerKey(token.id, node.id), {
      tokenId: token.id,
      nodeId: node.id,
      scopeId: token.scope.id,
      kind,
      dueAt,
      definition,
    });
  }

  private clearTimersFor(tokenId: string): void {
    for (const [key, entry] of this.timers) {
      if (entry.tokenId === tokenId) this.timers.delete(key);
    }
  }

  /** Resolves one due timer. Returns true when the execution moved. */
  private fireTimer(entry: TimerState): boolean {
    this.timers.delete(timerKey(entry.tokenId, entry.nodeId));

    if (entry.kind === 'boundary') {
      const scope = this.scopes.find((s) => s.id === entry.scopeId);
      const boundary = scope?.graph.node(entry.nodeId);
      if (!scope || !boundary) return false;
      return this.fireBoundary(scope, boundary);
    }

    const token = this.waiting.get(entry.tokenId);
    if (!token || token.waiting !== 'catchEvent' || token.nodeId !== entry.nodeId) return false;
    this.waiting.delete(token.id);
    token.waiting = undefined;
    this.completeNode(token);
    this.leaveViaOutgoing(token);
    return true;
  }

  // --- Variables ---------------------------------------------------------

  /**
   * Reads a variable walking the scope chain outwards: the innermost scope that
   * defines it wins, so a multi-instance item shadows a process variable.
   */
  private readVariable(scope: Scope | undefined, name: string): unknown {
    for (let current = scope; current; current = current.parentScope) {
      if (Object.hasOwn(current.variables, name)) return current.variables[name];
    }
    return undefined;
  }

  /**
   * Writes to the scope that already defines the variable; otherwise to the
   * process scope, matching the usual "process variable" expectation. Use
   * `setLocal` in a handler to keep a value inside the current scope.
   */
  private writeVariable(scope: Scope | undefined, name: string, value: unknown): void {
    for (let current = scope; current; current = current.parentScope) {
      if (Object.hasOwn(current.variables, name)) {
        current.variables[name] = value;
        return;
      }
    }
    const root = this.scopes[0];
    if (root) root.variables[name] = value;
    else this.initialVariables[name] = value;
  }

  private assignVariables(scope: Scope | undefined, values: Record<string, unknown>): void {
    for (const [name, value] of Object.entries(values)) this.writeVariable(scope, name, value);
  }

  /** Flattened view of the scope chain, innermost value winning. */
  private mergedVariables(scope: Scope | undefined): Record<string, unknown> {
    const chain: Scope[] = [];
    for (let current = scope; current; current = current.parentScope) chain.unshift(current);
    return Object.assign({}, ...chain.map((s) => s.variables)) as Record<string, unknown>;
  }

  private rootVariables(): Record<string, unknown> {
    return { ...(this.scopes[0]?.variables ?? this.initialVariables) };
  }

  /**
   * Live view handed to handlers: reads resolve through the scope chain and
   * writes go where {@link writeVariable} decides, so `ctx.variables.x = 1`
   * keeps working as documented.
   */
  private variableProxy(scope: Scope): Record<string, unknown> {
    return new Proxy(
      {},
      {
        get: (_target, key) =>
          typeof key === 'string' ? this.readVariable(scope, key) : undefined,
        set: (_target, key, value) => {
          if (typeof key === 'string') this.writeVariable(scope, key, value);
          return true;
        },
        has: (_target, key) =>
          typeof key === 'string' && this.readVariable(scope, key) !== undefined,
        ownKeys: () => Object.keys(this.mergedVariables(scope)),
        getOwnPropertyDescriptor: (_target, key) => ({
          value: typeof key === 'string' ? this.readVariable(scope, key) : undefined,
          enumerable: true,
          configurable: true,
          writable: true,
        }),
        deleteProperty: (_target, key) => {
          if (typeof key !== 'string') return true;
          for (let current: Scope | undefined = scope; current; current = current.parentScope) {
            if (Object.hasOwn(current.variables, key)) {
              delete current.variables[key];
              return true;
            }
          }
          return true;
        },
      },
    ) as Record<string, unknown>;
  }

  // --- Run loop ----------------------------------------------------------

  private async drain(): Promise<void> {
    for (;;) {
      const token = this.ready.shift();
      if (token) {
        if (this.steps++ > this.maxSteps) {
          this.fail(
            new BpmnExecutionError('Execution exceeded maxSteps (possible infinite loop).'),
          );
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
    // A repeated activity expands into instances before anything else runs;
    // the instance tokens themselves carry `loopInstanceOf` and fall through.
    if (node.loop && !token.loopInstanceOf && isActivityKind(node.kind)) {
      this.startLoop(token, node, node.loop);
      return;
    }
    this.emitter.emit('node.enter', { nodeId: node.id, nodeKind: node.kind, tokenId: token.id });
    this.history.push({
      nodeId: node.id,
      nodeKind: node.kind,
      event: 'enter',
      at: this.history.length,
    });

    switch (true) {
      case node.kind === 'startEvent':
        this.completeNode(token);
        this.leaveViaOutgoing(token);
        return;
      case node.kind === 'endEvent':
        await this.handleEndEvent(token, node);
        return;
      case node.kind === 'intermediateThrowEvent':
        // A link throw jumps to its matching catch instead of flowing on.
        if (node.event?.kind === 'link' && this.followLink(token, node)) return;
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
      if (this.raiseErrorOnEventSubProcess(code)) return;
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
        variables: this.variableProxy(token.scope),
        get: (name) => this.readVariable(token.scope, name),
        set: (name, value) => this.writeVariable(token.scope, name, value),
        setLocal: (name, value) => {
          token.scope.variables[name] = value;
        },
      });
      if (result && typeof result === 'object') this.assignVariables(token.scope, result);
    } catch (error) {
      if (error instanceof BpmnError) {
        this.emitter.emit('activity.end', { nodeId: node.id, tokenId: token.id });
        this.discard(token);
        if (this.raiseErrorOnActivity(token.scope, node.id, error.code)) return;
        // No boundary event: an error event subprocess is the next chance.
        if (this.raiseErrorOnEventSubProcess(error.code)) return;
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
    this.armBoundaryTimers(token);
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

  // --- Multi-instance & loops -------------------------------------------

  /** Expands an activity marked as multi-instance (or standard loop). */
  private startLoop(token: RuntimeToken, node: FlowNode, loop: LoopCharacteristics): void {
    const scope = token.scope;
    const variables = this.mergedVariables(scope);
    let items: unknown[] | undefined;
    let total: number;

    if (loop.kind === 'multiInstance') {
      if (loop.collection) {
        const collection = this.readVariable(scope, loop.collection);
        if (!Array.isArray(collection)) {
          this.fail(
            new BpmnExecutionError(
              `Multi-instance collection "${loop.collection}" of ${node.id} is not an array.`,
            ),
          );
          return;
        }
        items = [...collection];
        total = items.length;
      } else if (loop.cardinality) {
        const value = Number(evaluateExpression(loop.cardinality, variables));
        if (!Number.isFinite(value) || value < 0) {
          this.fail(
            new BpmnExecutionError(`Multi-instance cardinality of ${node.id} is not a number.`),
          );
          return;
        }
        total = Math.floor(value);
      } else {
        this.fail(
          new BpmnExecutionError(
            `Multi-instance activity ${node.id} needs a cardinality or a collection.`,
          ),
        );
        return;
      }
    } else {
      total = loop.maximum ?? DEFAULT_LOOP_MAXIMUM;
      // `testBefore` means the condition guards the very first iteration too.
      if (
        loop.testBefore &&
        loop.loopCondition &&
        !evaluateCondition(loop.loopCondition, variables)
      )
        total = 0;
    }

    if (total === 0) {
      // Zero instances: the activity is simply skipped, per the specification.
      this.completeNode(token);
      this.leaveViaOutgoing(token);
      return;
    }

    scope.tokens.delete(token); // suspend until every instance is done
    this.armBoundaryTimers(token);
    const run: LoopRun = {
      id: `loop-${this.loopSeq++}`,
      nodeId: node.id,
      scope,
      parentToken: token,
      loop,
      ...(items ? { items } : {}),
      total,
      started: 0,
      completed: 0,
      instanceScopes: new Set(),
    };
    this.loops.set(run.id, run);
    if (loop.outputCollection) this.writeVariable(scope, loop.outputCollection, []);
    this.emitter.emit('activity.start', { nodeId: node.id, tokenId: token.id });

    if (loop.sequential) {
      this.startLoopInstance(run);
      return;
    }
    for (let index = 0; index < total; index++) this.startLoopInstance(run);
  }

  /** Creates one instance scope (with its own item/counter) and its token. */
  private startLoopInstance(run: LoopRun): void {
    const index = run.started++;
    const variables: Record<string, unknown> = { loopCounter: index };
    if (run.loop.elementVariable && run.items) {
      variables[run.loop.elementVariable] = run.items[index];
    }
    // Declaring the output variable locally keeps each instance's result inside
    // its own scope, so a handler can just `set` it and the loop collects it.
    if (run.loop.outputElement) variables[run.loop.outputElement] = undefined;
    const scope: Scope = {
      id: `scope-${this.scopeSeq++}`,
      graph: run.scope.graph,
      parentScope: run.scope,
      parentScopeId: run.scope.id,
      hostNodeId: run.nodeId,
      loopId: run.id,
      variables,
      tokens: new Set(),
    };
    this.scopes.push(scope);
    run.instanceScopes.add(scope);
    const token = this.spawn(scope, run.nodeId);
    token.loopInstanceOf = run.id;
  }

  /** One instance reached the end of the activity. */
  private finishLoopInstance(token: RuntimeToken): void {
    const run = token.loopInstanceOf ? this.loops.get(token.loopInstanceOf) : undefined;
    const scope = token.scope;
    this.discard(token);
    if (!run) return;

    this.collectLoopOutput(run, scope);
    run.instanceScopes.delete(scope);
    this.removeScope(scope);
    run.completed++;

    const variables = this.mergedVariables(run.scope);
    if (run.loop.kind === 'multiInstance') {
      if (
        run.loop.completionCondition &&
        evaluateCondition(run.loop.completionCondition, variables)
      )
        return this.finishLoop(run);
      if (run.loop.sequential) {
        if (run.started < run.total) return this.startLoopInstance(run);
        return this.finishLoop(run);
      }
      if (run.completed >= run.total) this.finishLoop(run);
      return;
    }

    const repeat =
      run.started < run.total &&
      (!run.loop.loopCondition || evaluateCondition(run.loop.loopCondition, variables));
    if (repeat) this.startLoopInstance(run);
    else this.finishLoop(run);
  }

  /** Appends the instance's output variable to the aggregated collection. */
  private collectLoopOutput(run: LoopRun, instanceScope: Scope): void {
    const { outputCollection, outputElement } = run.loop;
    if (!outputCollection || !outputElement) return;
    const collected = this.readVariable(run.scope, outputCollection);
    if (!Array.isArray(collected)) return;
    collected.push(this.readVariable(instanceScope, outputElement));
  }

  /** Every instance is done (or was cancelled): the activity itself completes. */
  private finishLoop(run: LoopRun): void {
    this.loops.delete(run.id);
    for (const scope of [...run.instanceScopes]) {
      for (const token of [...scope.tokens]) this.discard(token);
      this.removeScope(scope);
    }
    run.instanceScopes.clear();

    const parent = run.parentToken;
    parent.scope.tokens.add(parent);
    this.emitter.emit('activity.end', { nodeId: run.nodeId, tokenId: parent.id });
    this.completeNode(parent);
    this.leaveViaOutgoing(parent);
  }

  private removeScope(scope: Scope): void {
    const index = this.scopes.indexOf(scope);
    if (index >= 0) this.scopes.splice(index, 1);
  }

  // --- Gateways ----------------------------------------------------------

  private handleExclusive(token: RuntimeToken, node: FlowNode): void {
    this.completeNode(token);
    const flows = token.scope.graph.outgoing(node);
    const chosen = this.firstMatching(flows, node, token.scope) ?? this.defaultFlow(flows, node);
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

  private firstMatching(
    flows: SequenceFlow[],
    node: FlowNode,
    scope: Scope,
  ): SequenceFlow | undefined {
    const variables = this.mergedVariables(scope);
    for (const flow of flows) {
      if (flow.id === node.default) continue;
      if (!flow.conditionExpression) return flow;
      if (evaluateCondition(flow.conditionExpression, variables)) return flow;
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
    const variables = this.mergedVariables(token.scope);
    const taken = flows.filter(
      (f) =>
        f.id !== node.default &&
        (!f.conditionExpression || evaluateCondition(f.conditionExpression, variables)),
    );
    const chosen =
      taken.length > 0
        ? taken
        : this.defaultFlow(flows, node)
          ? [this.defaultFlow(flows, node)!]
          : [];
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
    // An instance of a repeated activity never continues on its own: it reports
    // back to the loop, which decides whether to start another one.
    if (token.loopInstanceOf) {
      this.finishLoopInstance(token);
      return;
    }
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
    const variables = this.mergedVariables(token.scope);
    const taken = flows.filter(
      (f) => !f.conditionExpression || evaluateCondition(f.conditionExpression, variables),
    );
    const chosen =
      taken.length > 0
        ? taken
        : this.defaultFlow(flows, node)
          ? [this.defaultFlow(flows, node)!]
          : flows.slice(0, 1);
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
    this.armTimers(token);
    this.emitter.emit('wait', { nodeId: token.nodeId, tokenId: token.id, reason });
  }

  /**
   * Delivers a trigger to **every** subscriber that matches, as the
   * specification requires of a signal: parked catch events, armed
   * event-based gateway alternatives, boundary events and event subprocesses.
   */
  private deliverSignal(nameOrId: string): boolean {
    let delivered = false;

    // 1. Parked catch events (match by node id or event reference).
    const parked = [...this.waiting.values()].filter((token) => {
      if (token.waiting !== 'catchEvent') return false;
      const node = token.scope.graph.node(token.nodeId);
      return node ? matchesTrigger(node, nameOrId) : false;
    });
    for (const token of parked) {
      this.waiting.delete(token.id);
      token.waiting = undefined;
      this.completeNode(token);
      this.leaveViaOutgoing(token);
      delivered = true;
    }

    // 2. Event-based gateway alternatives.
    for (const [eventNodeId, gatewayTokenId] of [...this.armedEvents]) {
      const choice = this.eventChoices.get(gatewayTokenId);
      if (!choice) continue;
      const eventNode = choice.token.scope.graph.node(eventNodeId);
      if (!eventNode || !matchesTrigger(eventNode, nameOrId)) continue;
      this.resolveEventChoice(choice, eventNodeId);
      delivered = true;
    }

    // 3. Boundary events on active/waiting/suspended activities.
    if (this.fireBoundaryBySignal(nameOrId)) delivered = true;

    // 4. Event subprocesses listening for this trigger.
    if (this.startEventSubProcesses((start) => matchesTrigger(start, nameOrId))) delivered = true;

    return delivered;
  }

  /**
   * Starts every event subprocess whose start event matches. An interrupting
   * one cancels the work of the scope that declares it; a non-interrupting one
   * runs alongside it.
   */
  private startEventSubProcesses(matches: (start: FlowNode) => boolean): boolean {
    let started = false;
    for (const scope of [...this.scopes]) {
      // Loop instance scopes share their parent's graph: only look once.
      if (scope.loopId) continue;
      for (const node of scope.graph.allNodes()) {
        if (!node.triggeredByEvent || !node.process) continue;
        // An event subprocess already running is not started again.
        const running = this.scopes.some(
          (s) => s.hostNodeId === node.id && s.parentScopeId === scope.id,
        );
        if (running) continue;
        const graph = new ProcessGraph(node.process);
        const start = graph
          .allNodes()
          .find((candidate) => candidate.kind === 'startEvent' && matches(candidate));
        if (!start) continue;
        this.launchEventSubProcess(scope, node, graph, start);
        started = true;
      }
    }
    return started;
  }

  private launchEventSubProcess(
    host: Scope,
    node: FlowNode,
    graph: ProcessGraph,
    start: FlowNode,
  ): void {
    if (start.interrupting !== false) {
      // Interrupting: the enclosing scope stops doing whatever it was doing.
      for (const token of [...host.tokens]) this.discard(token);
    }
    const child = this.createScope(graph, undefined, node.id);
    child.parentScope = host;
    child.parentScopeId = host.id;
    this.emitter.emit('activity.start', { nodeId: node.id, tokenId: '-' });
    const token = this.spawn(child, start.id);
    this.completeNode(token);
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

  /** True when an event subprocess with a matching error start event ran. */
  private raiseErrorOnEventSubProcess(code?: string): boolean {
    return this.startEventSubProcesses(
      (start) =>
        start.event?.kind === 'error' && (!code || !start.event.code || start.event.code === code),
    );
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
      return;
    }
    // Event subprocess scopes have no parent token: they just go away.
    if (scope.hostNodeId) {
      this.emitter.emit('activity.end', { nodeId: scope.hostNodeId, tokenId: '-' });
      this.removeScope(scope);
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
      this.history.push({
        nodeId: node.id,
        nodeKind: node.kind,
        event: 'complete',
        at: this.history.length,
      });
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

/** Applies a {@link TaskFilter} to one task. */
function matchesFilter(task: PendingTask, filter: TaskFilter): boolean {
  if (filter.nodeId && task.nodeId !== filter.nodeId) return false;
  if (filter.reason) {
    const reasons = Array.isArray(filter.reason) ? filter.reason : [filter.reason];
    if (!reasons.includes(task.reason)) return false;
  }
  if (filter.role && task.lane !== filter.role && !task.candidates.includes(filter.role)) {
    return false;
  }
  return true;
}

/** A trigger matches a node by its id or by the referenced event name. */
function matchesTrigger(node: FlowNode, nameOrId: string): boolean {
  return node.id === nameOrId || node.event?.reference === nameOrId;
}

/** Timers are unique per (token, timer node) pair. */
function timerKey(tokenId: string, nodeId: string): string {
  return `${tokenId}:${nodeId}`;
}
