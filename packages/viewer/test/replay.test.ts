import { describe, expect, it } from 'vitest';
import type { HistoryEntry } from '@bpmn-flow/core';
// Imported directly: the replay controller has no rendering dependency.
import { ExecutionReplay } from '../src/replay.js';

const T0 = Date.parse('2026-08-18T12:00:00.000Z');

function history(): HistoryEntry[] {
  const steps: [string, HistoryEntry['event'], number][] = [
    ['Start', 'enter', 0],
    ['Start', 'complete', 0],
    ['Aprovar', 'enter', 1000],
    ['Aprovar', 'complete', 5000],
    ['End', 'enter', 5000],
    ['End', 'complete', 5000],
  ];
  return steps.map(([nodeId, event, offset], seq) => ({
    nodeId,
    nodeKind: 'task',
    event,
    at: T0 + offset,
    seq,
  }));
}

describe('ExecutionReplay', () => {
  it('starts before the first step', () => {
    const replay = new ExecutionReplay(history());
    expect(replay.length).toBe(6);
    expect(replay.position).toBe(-1);
    expect(replay.current()).toBeUndefined();
  });

  it('accumulates completed nodes as it moves forward', () => {
    const replay = new ExecutionReplay(history());
    expect(replay.next()?.completed).toEqual([]);
    expect(replay.next()?.completed).toEqual(['Start']);
    expect(replay.next()).toMatchObject({ active: 'Aprovar', completed: ['Start'] });
    expect(replay.next()?.completed).toEqual(['Start', 'Aprovar']);
  });

  it('reports the elapsed time of each step', () => {
    const replay = new ExecutionReplay(history());
    replay.seek(3);
    expect(replay.current()?.elapsedMs).toBe(5000);
  });

  it('walks backwards and stops before the beginning', () => {
    const replay = new ExecutionReplay(history());
    replay.seek(1);
    expect(replay.previous()?.index).toBe(0);
    expect(replay.previous()).toBeUndefined();
    expect(replay.position).toBe(-1);
  });

  it('stops at the last step going forward', () => {
    const replay = new ExecutionReplay(history());
    replay.seek(5);
    expect(replay.next()).toBeUndefined();
    expect(replay.position).toBe(5);
  });

  it('clamps a seek outside the range and can be reset', () => {
    const replay = new ExecutionReplay(history());
    expect(replay.seek(99)?.index).toBe(5);
    expect(replay.seek(-99)).toBeUndefined();
    replay.seek(2);
    replay.reset();
    expect(replay.position).toBe(-1);
  });

  it('orders entries by seq even when they arrive shuffled', () => {
    const shuffled = [...history()].reverse();
    const replay = new ExecutionReplay(shuffled);
    expect(replay.frames().map((frame) => frame.entry.seq)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});
