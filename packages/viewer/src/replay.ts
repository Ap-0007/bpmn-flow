import type { HistoryEntry } from '@bpmn-flow/core';

/**
 * One step of a replay: the state of the diagram right after the history entry
 * at `index` happened.
 */
export interface ReplayFrame {
  index: number;
  entry: HistoryEntry;
  /** Nodes completed up to and including this step. */
  completed: string[];
  /** Node just entered, when this step is an `enter`. */
  active?: string;
  /** Milliseconds since the first history entry. */
  elapsedMs: number;
}

/**
 * Walks an execution history step by step, so a finished (or ongoing) run can
 * be played back on the diagram — forwards, backwards or by seeking.
 *
 * Deliberately free of any DOM or rendering: it produces frames and the viewer
 * decides how to paint them.
 */
export class ExecutionReplay {
  private readonly steps: ReplayFrame[];
  private cursor = -1;

  constructor(history: HistoryEntry[]) {
    const ordered = [...history].sort((a, b) => a.seq - b.seq);
    const startedAt = ordered[0]?.at ?? 0;
    const completed: string[] = [];

    this.steps = ordered.map((entry, index) => {
      if (entry.event === 'complete' && !completed.includes(entry.nodeId)) {
        completed.push(entry.nodeId);
      }
      return {
        index,
        entry,
        completed: [...completed],
        elapsedMs: entry.at - startedAt,
        ...(entry.event === 'enter' ? { active: entry.nodeId } : {}),
      };
    });
  }

  /** Number of steps in the replay. */
  get length(): number {
    return this.steps.length;
  }

  /** Current step, or `-1` before the first one. */
  get position(): number {
    return this.cursor;
  }

  /** Every frame, for a timeline UI. */
  frames(): ReplayFrame[] {
    return [...this.steps];
  }

  /** Frame the replay currently sits on. */
  current(): ReplayFrame | undefined {
    return this.steps[this.cursor];
  }

  next(): ReplayFrame | undefined {
    if (this.cursor >= this.steps.length - 1) return undefined;
    this.cursor += 1;
    return this.steps[this.cursor];
  }

  previous(): ReplayFrame | undefined {
    if (this.cursor <= 0) {
      this.cursor = -1;
      return undefined;
    }
    this.cursor -= 1;
    return this.steps[this.cursor];
  }

  /** Jumps to a step, clamped to the available range. */
  seek(index: number): ReplayFrame | undefined {
    this.cursor = Math.max(-1, Math.min(index, this.steps.length - 1));
    return this.current();
  }

  reset(): void {
    this.cursor = -1;
  }
}
