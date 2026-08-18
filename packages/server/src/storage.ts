import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { EngineState } from '@bpmn-flow/core';

/** Everything needed to rebuild a session after a restart. */
export interface SessionRecord {
  id: string;
  xml: string;
  state: EngineState;
  updatedAt: string;
}

/**
 * Where sessions live between requests. The default server keeps them in
 * memory only; pass an implementation to survive a restart, or to share
 * sessions between instances (Redis, Postgres, S3...).
 */
export interface SessionStorage {
  read(id: string): Promise<SessionRecord | undefined>;
  write(record: SessionRecord): Promise<void>;
  remove(id: string): Promise<boolean>;
  list(): Promise<SessionRecord[]>;
}

/** Session ids are generated as UUIDs; anything else is refused as a path. */
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

export class InvalidSessionIdError extends Error {
  constructor(id: string) {
    super(`Invalid session id: ${id}`);
    this.name = 'InvalidSessionIdError';
  }
}

/**
 * Stores one JSON file per session in a directory. Simple on purpose: it makes
 * a restarted server pick executions up where they stopped, and the files are
 * readable while debugging.
 */
export class FileSessionStorage implements SessionStorage {
  constructor(private readonly dir: string) {}

  async read(id: string): Promise<SessionRecord | undefined> {
    try {
      const raw = await readFile(this.pathFor(id), 'utf8');
      return JSON.parse(raw) as SessionRecord;
    } catch (error) {
      if (isMissing(error)) return undefined;
      throw error;
    }
  }

  async write(record: SessionRecord): Promise<void> {
    const target = this.pathFor(record.id);
    await mkdir(this.dir, { recursive: true });
    // Write-then-rename: a reader never sees a half-written session file.
    const temp = `${target}.tmp`;
    await writeFile(temp, JSON.stringify(record), 'utf8');
    await rename(temp, target);
  }

  async remove(id: string): Promise<boolean> {
    try {
      await rm(this.pathFor(id));
      return true;
    } catch (error) {
      if (isMissing(error)) return false;
      throw error;
    }
  }

  async list(): Promise<SessionRecord[]> {
    let names: string[];
    try {
      names = await readdir(this.dir);
    } catch (error) {
      if (isMissing(error)) return [];
      throw error;
    }
    const records: SessionRecord[] = [];
    for (const name of names) {
      if (!name.endsWith('.json')) continue;
      const record = await this.read(name.slice(0, -'.json'.length));
      if (record) records.push(record);
    }
    return records;
  }

  private pathFor(id: string): string {
    if (!SAFE_ID.test(id)) throw new InvalidSessionIdError(id);
    return join(this.dir, `${id}.json`);
  }
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT';
}
