import type { ElementKind } from '../model/kinds.js';

export type ExecutionStatus =
  | 'idle'
  | 'running'
  | 'waiting'
  | 'completed'
  | 'terminated'
  | 'failed';

/** Why a token is parked, so callers know how to resume it. */
export type WaitReason =
  | 'userTask'
  | 'receiveTask'
  | 'catchEvent'
  | 'eventBasedGateway'
  | 'boundary';

export interface TokenSnapshot {
  id: string;
  nodeId: string;
  nodeKind: ElementKind;
  scopeId: string;
  waiting: boolean;
  waitReason?: WaitReason;
}

export interface HistoryEntry {
  nodeId: string;
  nodeKind: ElementKind;
  event: 'enter' | 'complete';
  at: number;
}

export interface ExecutionSnapshot {
  status: ExecutionStatus;
  variables: Record<string, unknown>;
  tokens: TokenSnapshot[];
  /** Distinct node ids that have completed at least once. */
  completedNodes: string[];
  history: HistoryEntry[];
}

/**
 * `automation`: wait states (user/receive tasks, catch events) pause until the
 * caller resumes them; unhandled service-like tasks pass through.
 * `auto`: every wait state resolves immediately, useful to simulate/animate a
 * run without providing handlers or external triggers.
 */
export type EngineMode = 'automation' | 'auto';

export interface EngineOptions {
  mode?: EngineMode;
  /** Guards against infinite loops; caps node transitions per drain. */
  maxSteps?: number;
  /** Initial process variables. */
  variables?: Record<string, unknown>;
}

export interface EngineEvents extends Record<string, unknown> {
  'process.start': { processId: string };
  'process.end': { processId: string; status: ExecutionStatus };
  'node.enter': { nodeId: string; nodeKind: ElementKind; tokenId: string };
  'node.leave': { nodeId: string; nodeKind: ElementKind; tokenId: string };
  'activity.start': { nodeId: string; tokenId: string };
  'activity.end': { nodeId: string; tokenId: string };
  'flow.take': { flowId: string; sourceId: string; targetId: string; tokenId: string };
  wait: { nodeId: string; tokenId: string; reason: WaitReason };
  error: { nodeId?: string; error: Error };
}
