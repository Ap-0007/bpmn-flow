import type { ActivityMetrics, ExecutionSnapshot, WorkflowEngine } from '@bpmn-flow/core';
import type { ReplayFrame } from './replay.js';
import { layoutProcess } from 'bpmn-auto-layout';
import { BpmnVisualization, FitType } from 'bpmn-visualization';

/** CSS class names applied to diagram elements to reflect execution state. */
export const EXECUTION_CLASSES = {
  active: 'bpmn-flow-active',
  completed: 'bpmn-flow-completed',
  waiting: 'bpmn-flow-waiting',
  taken: 'bpmn-flow-taken',
} as const;

export interface ViewerOptions {
  container: string | HTMLElement;
}

/**
 * Interactive BPMN viewer built on `bpmn-visualization`.
 *
 * Renders a diagram from its XML and overlays live execution state produced by
 * a {@link WorkflowEngine}: completed nodes, active tokens, waiting activities
 * and the sequence flows taken so far. State can be applied authoritatively
 * from an {@link ExecutionSnapshot} and/or animated incrementally by binding to
 * engine events.
 */
export class BpmnFlowViewer {
  readonly visualization: BpmnVisualization;
  private readonly takenFlows = new Set<string>();

  constructor(options: ViewerOptions) {
    this.visualization = new BpmnVisualization({
      container: options.container,
      // Bounded pan and zoom (mouse wheel / drag), like a constrained canvas.
      navigation: { enabled: true },
    });
  }

  /**
   * Loads and renders the BPMN diagram, clearing any prior overlay state.
   *
   * If the XML has no diagram interchange (no layout coordinates), a layout is
   * computed automatically so processes authored purely in terms of semantics
   * still render.
   */
  async load(xml: string): Promise<void> {
    let renderable: string;
    try {
      renderable = await ensureLayout(xml);
    } catch {
      // Fall back to the original XML; bpmn-visualization will report if it
      // truly cannot render.
      renderable = xml;
    }
    this.visualization.load(renderable, { fit: { type: FitType.Center } });
    this.takenFlows.clear();
  }

  /** Fits the diagram to the viewport. */
  fit(): void {
    this.visualization.navigation.fit({ type: FitType.Center });
  }

  /** Removes all execution overlays without reloading the diagram. */
  clear(): void {
    this.visualization.bpmnElementsRegistry.removeAllCssClasses();
    this.takenFlows.clear();
  }

  /**
   * Applies an execution snapshot as the single source of truth: completed
   * nodes, active tokens and waiting activities are re-derived from scratch,
   * while previously highlighted flows are preserved.
   */
  applySnapshot(snapshot: ExecutionSnapshot): void {
    const registry = this.visualization.bpmnElementsRegistry;
    registry.removeAllCssClasses(undefined);
    this.reapplyTakenFlows();

    if (snapshot.completedNodes.length > 0) {
      registry.addCssClasses(snapshot.completedNodes, EXECUTION_CLASSES.completed);
    }
    for (const token of snapshot.tokens) {
      registry.addCssClasses(
        token.nodeId,
        token.waiting ? EXECUTION_CLASSES.waiting : EXECUTION_CLASSES.active,
      );
    }
  }

  /**
   * Paints one step of a replay: everything completed so far plus the node the
   * token just entered. Use it with {@link ExecutionReplay} to step through a
   * finished execution.
   */
  applyReplayFrame(frame: ReplayFrame): void {
    const registry = this.visualization.bpmnElementsRegistry;
    registry.removeAllCssClasses(undefined);
    this.reapplyTakenFlows();
    if (frame.completed.length > 0) {
      registry.addCssClasses(frame.completed, EXECUTION_CLASSES.completed);
    }
    if (frame.active) registry.addCssClasses(frame.active, EXECUTION_CLASSES.active);
  }

  /**
   * Shows where the time went, as a badge on each activity. Pass the result of
   * `engine.metrics()`; `format` customizes the label (defaults to seconds).
   */
  showMetrics(metrics: ActivityMetrics[], format = formatDuration): void {
    const registry = this.visualization.bpmnElementsRegistry;
    for (const entry of metrics) {
      if (entry.completed === 0) continue;
      registry.addOverlays(entry.nodeId, {
        position: 'top-right',
        label: format(entry),
        style: {
          font: { color: '#1b4fa0', size: 11 },
          fill: { color: '#e4edff', opacity: 90 },
          stroke: { color: '#1b4fa0', width: 1 },
        },
      });
    }
  }

  /** Removes the metric badges from every element that has them. */
  clearMetrics(metrics: ActivityMetrics[]): void {
    for (const entry of metrics) {
      this.visualization.bpmnElementsRegistry.removeAllOverlays(entry.nodeId);
    }
  }

  /** Marks a sequence flow as taken (used for incremental animation). */
  markFlowTaken(flowId: string): void {
    if (!flowId || flowId === '-') return;
    this.takenFlows.add(flowId);
    this.visualization.bpmnElementsRegistry.addCssClasses(flowId, EXECUTION_CLASSES.taken);
  }

  /**
   * Subscribes to a running engine and reflects its progress live. Returns an
   * unbind function that removes every listener.
   */
  bindEngine(engine: WorkflowEngine): () => void {
    const registry = this.visualization.bpmnElementsRegistry;
    const unsubscribers = [
      engine.on('node.enter', ({ nodeId }) => {
        registry.removeCssClasses(nodeId, EXECUTION_CLASSES.waiting);
        registry.addCssClasses(nodeId, EXECUTION_CLASSES.active);
      }),
      engine.on('node.leave', ({ nodeId }) => {
        registry.removeCssClasses(nodeId, [EXECUTION_CLASSES.active, EXECUTION_CLASSES.waiting]);
        registry.addCssClasses(nodeId, EXECUTION_CLASSES.completed);
      }),
      engine.on('wait', ({ nodeId }) => {
        registry.removeCssClasses(nodeId, EXECUTION_CLASSES.active);
        registry.addCssClasses(nodeId, EXECUTION_CLASSES.waiting);
      }),
      engine.on('flow.take', ({ flowId }) => this.markFlowTaken(flowId)),
      engine.on('activity.end', ({ nodeId }) => {
        registry.removeCssClasses(nodeId, [EXECUTION_CLASSES.active, EXECUTION_CLASSES.waiting]);
        registry.addCssClasses(nodeId, EXECUTION_CLASSES.completed);
      }),
    ];
    return () => {
      for (const off of unsubscribers) off();
    };
  }

  /** Releases the underlying rendering resources. */
  dispose(): void {
    this.visualization.dispose();
  }

  private reapplyTakenFlows(): void {
    if (this.takenFlows.size === 0) return;
    this.visualization.bpmnElementsRegistry.addCssClasses(
      [...this.takenFlows],
      EXECUTION_CLASSES.taken,
    );
  }
}

/** True when the XML already carries diagram interchange (layout) data. */
export function hasDiagramInterchange(xml: string): boolean {
  return /BPMNDiagram|BPMNPlane|BPMNShape/.test(xml);
}

/**
 * Returns XML that is guaranteed to carry diagram interchange.
 *
 * A diagram authored purely in terms of semantics (no layout) is positioned
 * with `bpmn-auto-layout`; anything that already has DI is returned untouched.
 * Useful for consumers that require DI, such as a `bpmn-js` modeler.
 *
 * @throws when the layout engine cannot process the XML.
 */
export async function ensureLayout(xml: string): Promise<string> {
  return hasDiagramInterchange(xml) ? xml : await layoutProcess(xml);
}

/** `1.5 s`, `2 min`, `3 h` — short enough for a diagram badge. */
function formatDuration(entry: ActivityMetrics): string {
  const ms = entry.averageMs;
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} min`;
  return `${(ms / 3_600_000).toFixed(1)} h`;
}

export { ExecutionReplay } from './replay.js';
export type { ReplayFrame } from './replay.js';
export type { ActivityMetrics, ExecutionSnapshot, WorkflowEngine } from '@bpmn-flow/core';
