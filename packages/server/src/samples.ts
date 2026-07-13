import { readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

export interface SampleInfo {
  name: string;
  file: string;
}

export class InvalidSampleNameError extends Error {
  constructor() {
    super('Invalid sample name: use only letters, numbers, dashes and underscores.');
    this.name = 'InvalidSampleNameError';
  }
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

  /** Writes a `.bpmn` file, returning the stored name. */
  async write(name: string, xml: string): Promise<string> {
    const safe = SampleProvider.safeName(name);
    await writeFile(join(this.directory, `${safe}.bpmn`), xml, 'utf8');
    return safe;
  }

  /** Rejects names that could escape the directory or use unsafe characters. */
  static safeName(name: string): string {
    const stripped = name.trim().replace(/\.bpmn$/i, '');
    if (!/^[A-Za-z0-9_-]+$/.test(stripped)) {
      throw new InvalidSampleNameError();
    }
    return stripped;
  }
}
