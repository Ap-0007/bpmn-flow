import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

export interface SampleInfo {
  name: string;
  file: string;
}

/**
 * Serves `.bpmn` files from a directory as named samples. Used by the playground
 * to offer a picker of ready-made diagrams; optional for library consumers.
 */
export class SampleProvider {
  constructor(private readonly directory: string) {}

  async list(): Promise<SampleInfo[]> {
    let entries: string[];
    try {
      entries = await readdir(this.directory);
    } catch {
      return [];
    }
    return entries
      .filter((file) => file.endsWith('.bpmn'))
      .map((file) => ({ name: basename(file, '.bpmn'), file }));
  }

  async read(name: string): Promise<string | undefined> {
    const safe = basename(name).replace(/\.bpmn$/, '');
    try {
      return await readFile(join(this.directory, `${safe}.bpmn`), 'utf8');
    } catch {
      return undefined;
    }
  }
}
