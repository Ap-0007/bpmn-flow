import { randomUUID } from 'node:crypto';
import {
  parseBpmn,
  WorkflowEngine,
  type EngineMode,
  type ExecutionSnapshot,
  type ExecutionStatus,
  type ProcessModel,
} from '@bpmn-flow/core';
import type { SessionStorage } from './storage.js';

export interface CreateSessionInput {
  xml: string;
  mode?: EngineMode;
  variables?: Record<string, unknown>;
}

export interface Session {
  id: string;
  xml: string;
  snapshot: ExecutionSnapshot;
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

  constructor(private readonly storage?: SessionStorage) {}

  async create(input: CreateSessionInput): Promise<Session> {
    const engine = new WorkflowEngine(await firstProcess(input.xml), {
      ...(input.mode ? { mode: input.mode } : {}),
      ...(input.variables ? { variables: input.variables } : {}),
    });
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

  async signal(id: string, name: string, output?: Record<string, unknown>): Promise<Session> {
    const session = await this.require(id);
    session.snapshot = await session.engine.signal(name, output);
    await this.persist(session);
    return view(session);
  }

  async delete(id: string): Promise<boolean> {
    const removedFromCache = this.cache.delete(id);
    const removedFromStorage = (await this.storage?.remove(id)) ?? false;
    return removedFromCache || removedFromStorage;
  }

  /**
   * Summaries of every known session, stored and in-memory. Reads the persisted
   * state directly instead of rebuilding engines, so listing stays cheap.
   */
  async list(): Promise<SessionSummary[]> {
    const summaries = new Map<string, SessionSummary>();
    for (const record of (await this.storage?.list()) ?? []) {
      summaries.set(record.id, {
        id: record.id,
        status: record.state.status,
        waiting: record.state.tokens.filter((token) => token.waiting !== undefined).length,
        updatedAt: record.updatedAt,
      });
    }
    // The cache is authoritative: it holds the live engines.
    for (const session of this.cache.values()) {
      summaries.set(session.id, {
        id: session.id,
        status: session.snapshot.status,
        waiting: session.snapshot.tokens.filter((token) => token.waiting).length,
      });
    }
    return [...summaries.values()];
  }

  private async load(id: string): Promise<LiveSession | undefined> {
    const cached = this.cache.get(id);
    if (cached) return cached;
    const record = await this.storage?.read(id);
    if (!record) return undefined;
    const engine = WorkflowEngine.restore(await firstProcess(record.xml), record.state);
    const session: LiveSession = {
      id: record.id,
      xml: record.xml,
      snapshot: engine.snapshot(),
      engine,
    };
    this.cache.set(id, session);
    return session;
  }

  private async require(id: string): Promise<LiveSession> {
    const session = await this.load(id);
    if (!session) throw new SessionNotFoundError(id);
    return session;
  }

  private async persist(session: LiveSession): Promise<void> {
    await this.storage?.write({
      id: session.id,
      xml: session.xml,
      state: session.engine.getState(),
      updatedAt: new Date().toISOString(),
    });
  }
}

async function firstProcess(xml: string): Promise<ProcessModel> {
  const model = await parseBpmn(xml);
  const process = model.processes[0];
  if (!process) throw new Error('No executable process found.');
  return process;
}

function view(session: LiveSession): Session {
  return { id: session.id, xml: session.xml, snapshot: session.snapshot };
}

export class SessionNotFoundError extends Error {
  constructor(id: string) {
    super(`Session not found: ${id}`);
    this.name = 'SessionNotFoundError';
  }
}
