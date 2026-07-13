import { randomUUID } from 'node:crypto';
import {
  parseBpmn,
  WorkflowEngine,
  type EngineMode,
  type ExecutionSnapshot,
} from '@bpmn-flow/core';

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

interface StoredSession extends Session {
  engine: WorkflowEngine;
}

/**
 * In-memory registry of running executions. Each session owns a
 * {@link WorkflowEngine} that can be resumed via HTTP (complete a user task or
 * deliver a signal) so a client can drive a process step by step.
 */
export class SessionStore {
  private readonly sessions = new Map<string, StoredSession>();

  async create(input: CreateSessionInput): Promise<Session> {
    const model = await parseBpmn(input.xml);
    const process = model.processes[0];
    if (!process) throw new Error('No executable process found.');
    const engine = new WorkflowEngine(process, {
      ...(input.mode ? { mode: input.mode } : {}),
      ...(input.variables ? { variables: input.variables } : {}),
    });
    const snapshot = await engine.start();
    const session: StoredSession = { id: randomUUID(), xml: input.xml, snapshot, engine };
    this.sessions.set(session.id, session);
    return this.view(session);
  }

  get(id: string): Session | undefined {
    const session = this.sessions.get(id);
    return session ? this.view(session) : undefined;
  }

  async complete(id: string, tokenId: string, output?: Record<string, unknown>): Promise<Session> {
    const session = this.require(id);
    session.snapshot = await session.engine.completeTask(tokenId, output);
    return this.view(session);
  }

  async signal(id: string, name: string, output?: Record<string, unknown>): Promise<Session> {
    const session = this.require(id);
    session.snapshot = await session.engine.signal(name, output);
    return this.view(session);
  }

  delete(id: string): boolean {
    return this.sessions.delete(id);
  }

  list(): Session[] {
    return [...this.sessions.values()].map((s) => this.view(s));
  }

  private require(id: string): StoredSession {
    const session = this.sessions.get(id);
    if (!session) throw new SessionNotFoundError(id);
    return session;
  }

  private view(session: StoredSession): Session {
    return { id: session.id, xml: session.xml, snapshot: session.snapshot };
  }
}

export class SessionNotFoundError extends Error {
  constructor(id: string) {
    super(`Session not found: ${id}`);
    this.name = 'SessionNotFoundError';
  }
}
