---
import { randomUUID } from 'node:crypto';
import {
  parseBpmn,
  WorkflowEngine,
  type EngineMode,
  type EngineOptions,
  type ExecutionSnapshot,
  type ExecutionStatus,
  type IncidentState,
  type PendingTask,
  type ProcessModel,
  type TaskFilter,
  type TaskHandler,
} from '@bpmn-flow/core';
import type { SessionStorage } from './storage.js';

export interface CreateSessionInput {
  xml: string;
  mode?: EngineMode;
  variables?: Record<string, unknown>;
  /** `incident` holds a failing activity instead of failing the execution. */
  onHandlerError?: EngineOptions['onHandlerError'];
  /** Automatic retries before an incident is opened. */
  retry?: EngineOptions['retry'];
}

export interface Session {
  id: string;
  xml: string;
  snapshot: ExecutionSnapshot;
}

/** A pending task plus the session it belongs to. */
export interface InboxTask extends PendingTask {
  sessionId: string;
}

/** Lightweight listing entry: no diagram XML, no full history. */
export interface SessionSummary {
  id: string;
  status: ExecutionStatus;
  /** Tokens currently parked on a wait state. */
  waiting: number;
  updatedAt?: string;
}

interface LiveSession extends Session {
  engine: WorkflowEngine;
}

export interface SessionStoreOptions {
  /** Where sessions are persisted. In-memory only when omitted. */
  storage?: SessionStorage;
  /**
   * Automation registered on every engine this store creates or restores,
   * keyed by node id, element kind or the `*` wildcard. Without it, automatic
   * activities simply pass through.
   */
  handlers?: Record<string, TaskHandler>;
}

/**
 * Registry of running executions. Each session owns a {@link WorkflowEngine}
 * that can be driven over HTTP (complete a user task or deliver a signal).
 *
 * Engines are cached in memory. When a {@link SessionStorage} is provided,
 * every change is written through it and a session missing from the cache is
 * rebuilt from its stored state — so a restarted server picks executions up
 * exactly where they stopped.
 */
export class SessionStore {
  private readonly cache = new Map<string, LiveSession>();
  private readonly storage: SessionStorage | undefined;
  private readonly handlers: Record<string, TaskHandler>;

  constructor(options: SessionStoreOptions = {}) {
    this.storage = options.storage;
    this.handlers = options.handlers ?? {};
  }

  /** Applies the store's automation to a freshly built engine. */
  private wire(engine: WorkflowEngine): WorkflowEngine {
    for (const [selector, handler] of Object.entries(this.handlers)) {
      engine.registerHandler(selector, handler);
    }
    return engine;
  }

  async create(input: CreateSessionInput): Promise<Session> {
    const { process, processes } = await readProcesses(input.xml);
    const engine = this.wire(
      new WorkflowEngine(process, {
        processes,
        ...(input.mode ? { mode: input.mode } : {}),
        ...(input.variables ? { variables: input.variables } : {}),
        ...(input.onHandlerError ? { onHandlerError: input.onHandlerError } : {}),
        ...(input.retry ? { retry: input.retry } : {}),
      }),
    );
    const snapshot = await engine.start();
    const session: LiveSession = { id: randomUUID(), xml: input.xml, snapshot, engine };
    this.cache.set(session.id, session);
    await this.persist(session);
    return view(session);
  }

  async get(id: string): Promise<Session | undefined> {
    const session = await this.load(id);
    return session ? view(session) : undefined;
  }

  async complete(id: string, tokenId: string, output?: Record<string, unknown>): Promise<Session> {
    const session = await this.require(id);
    session.snapshot = await session.engine.completeTask(tokenId, output);
    await this.persist(session);
    return view(session);
  }

  /** Work waiting on a person in one session. */
  async tasks(id: string, filter?: TaskFilter): Promise<PendingTask[]> {
    const session = await this.require(id);
    return session.engine.tasks(filter);
  }

  /**
   * Work waiting on a person across every session — the inbox. Sessions that
   * already finished are skipped without rebuilding their engine.
   */
  async inbox(filter?: TaskFilter): Promise<InboxTask[]> {
    const ids = new Set<string>();
    for (const record of (await this.storage?.list()) ?? []) {
      if (record.state.tokens.some((token) => token.waiting !== undefined)) ids.add(record.id);
    }
    for (const [id, session] of this.cache) {
      if (session.snapshot.tokens.some((token) => token.waiting)) ids.add(id);
    }

    const inbox: InboxTask[] = [];
    for (const id of ids) {
      const session = await this.load(id);
      if (!session) continue;
      for (const task of session.engine.tasks(filter)) inbox.push({ sessionId: id, ...task });
    }
    return inbox;
  }

  /** Activities of one session whose handler failed. */
  async incidents(id: string): Promise<IncidentState[]> {
    const session = await this.require(id);
    return session.engine.incidentList();
  }

  /** Runs a failed activity again. */
  async retry(id: string, tokenId: string): Promise<Session> {
    const session = await this.require(id);
    session.snapshot = await session.engine.retryTask(tokenId);
    await this.persist(session);
    return view(session);
  }

  /** Gives up on a failed activity and moves the process on. */
  async resolveIncident(
    id: string,
    tokenId: string,
    output?: Record<string, unknown>,
  ): Promise<Session> {
    const session = await this.require(id);
    session.snapshot = await session.engine.resolveIncident(tokenId, output);
    await this.persist(session);
    return view(session);
  }

  async readProcesses(
    xml: string,
  ): Promise<{ process: ProcessModel; processes: ProcessModel[] }> {
    const model = await parseBpmn(xml);
    if (!model.processes.length) throw new Error('No executable process found.');
    const process = model.processes.find((p) => p.isExecutable);
    if (!process) throw new Error('Process is not executable');
    return { process, processes: model.processes };
  }

  function view(session: LiveSession): Session {
    return { id: session.id, xml: session.xml, snapshot: session.snapshot };
  }
}

export class SessionNotFoundError extends Error {
  constructor(id: string) {
    super(`Session not found: ${id}`);
    this.name = 'SessionNotFoundError';
  }
}