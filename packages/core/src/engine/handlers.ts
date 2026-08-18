import type { FlowNode } from '../model/types.js';

/**
 * Context handed to a task handler. Handlers automate the work behind an
 * activity: read/write process variables, inspect the node, and optionally
 * signal a business error to trigger an attached error boundary event.
 */
export interface HandlerContext {
  /** The activity node being executed. */
  readonly node: FlowNode;
  /** Live process variables. Mutations are visible to the rest of the flow. */
  readonly variables: Record<string, unknown>;
  /** Convenience getter for a single variable. */
  get(name: string): unknown;
  /** Convenience setter for a single variable. */
  set(name: string, value: unknown): void;
}

/**
 * A task handler runs the automation for an activity. Returning normally
 * completes the activity; returning a record merges those values into the
 * process variables; throwing a {@link BpmnError} triggers a matching error
 * boundary event, and throwing anything else fails the execution.
 */
export type TaskHandler = (
  context: HandlerContext,
) => void | Record<string, unknown> | Promise<void | Record<string, unknown>>;

/** Thrown by a handler to raise a catchable BPMN business error. */
export class BpmnError extends Error {
  constructor(
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'BpmnError';
  }
}

/**
 * Selector for registering handlers, resolved most-specific first:
 * a node id beats an element kind, which beats the `*` wildcard.
 */
export type HandlerSelector = string;

export class HandlerRegistry {
  private readonly handlers = new Map<HandlerSelector, TaskHandler>();

  register(selector: HandlerSelector, handler: TaskHandler): void {
    this.handlers.set(selector, handler);
  }

  resolve(node: FlowNode): TaskHandler | undefined {
    return this.handlers.get(node.id) ?? this.handlers.get(node.kind) ?? this.handlers.get('*');
  }

  has(node: FlowNode): boolean {
    return this.resolve(node) !== undefined;
  }
}
