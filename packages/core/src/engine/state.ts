import type { EngineMode, ExecutionStatus, HistoryEntry, WaitReason } from './types.js';

/**
 * Serializable form of a running execution.
 *
 * Unlike {@link ExecutionSnapshot}, which is a read model for UIs, this carries
 * everything the engine needs to continue exactly where it stopped: scope tree,
 * every token (including the ones suspended or buffered at a join), gateway
 * buffers, armed events and the id sequences. Handlers and event listeners are
 * *not* part of the state — re-register them after restoring.
 *
 * Bump {@link ENGINE_STATE_VERSION} whenever the shape changes.
 */
export const ENGINE_STATE_VERSION = 1;

/** Where a token currently sits, since not every token lives in a scope. */
export type TokenPlacement =
  /** Normal token inside its scope. */
  | 'active'
  /** Parent token of a subprocess, suspended until the child scope ends. */
  | 'suspended'
  /** Buffered at an inclusive join, waiting for the reachability check. */
  | 'inclusiveJoin';

export interface TokenState {
  id: string;
  nodeId: string;
  scopeId: string;
  viaFlowId?: string;
  waiting?: WaitReason;
  placement?: TokenPlacement;
}

export interface ScopeState {
  id: string;
  /** Scope that hosts this one; absent on the root scope. */
  parentScopeId?: string;
  /** Subprocess-like activity that owns this scope. */
  hostNodeId?: string;
  /** Token suspended while this scope runs. */
  parentTokenId?: string;
}

/** Arrival counts per incoming flow of a parallel join. */
export interface ParallelBufferState {
  key: string;
  counts: [string, number][];
}

export interface InclusiveBufferState {
  key: string;
  tokenIds: string[];
}

export interface EventChoiceState {
  tokenId: string;
  alternatives: { eventNodeId: string; flowId: string }[];
}

export interface EngineState {
  version: number;
  processId: string;
  status: ExecutionStatus;
  mode: EngineMode;
  maxSteps: number;
  steps: number;
  variables: Record<string, unknown>;
  tokenSeq: number;
  scopeSeq: number;
  scopes: ScopeState[];
  tokens: TokenState[];
  /** Token ids queued for processing, in order. */
  ready: string[];
  completedNodes: string[];
  history: HistoryEntry[];
  parallelBuffers: ParallelBufferState[];
  inclusiveBuffers: InclusiveBufferState[];
  eventChoices: EventChoiceState[];
  /** `eventNodeId -> tokenId` of the gateway waiting on that event. */
  armedEvents: [string, string][];
}
