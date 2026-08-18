#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { inspect, run, validate } from './commands.js';
import type { EngineMode, EngineState } from '@bpmn-flow/core';

const USAGE = `bpmn-flow — BPMN 2.0 from the terminal

  bpmn-flow validate <file.bpmn>
  bpmn-flow inspect  <file.bpmn>
  bpmn-flow run      <file.bpmn> [options]

Options for run:
  --vars <json>      initial process variables, e.g. '{"valor":2500}'
  --mode <mode>      automation (default, pauses on user tasks) | auto
  --state <file>     continue a run stored with --save
  --save <file>      write the execution state when it pauses
`;

/** Reads `--name value` or `--name=value`. */
function arg(argv: string[], name: string): string | undefined {
  const index = argv.findIndex((item) => item === `--${name}` || item.startsWith(`--${name}=`));
  if (index === -1) return undefined;
  const current = argv[index]!;
  return current.includes('=') ? current.split('=').slice(1).join('=') : argv[index + 1];
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const [command, file] = argv;

  if (!command || command === '--help' || command === '-h') {
    console.log(USAGE);
    return 0;
  }
  if (!file || file.startsWith('--')) {
    console.error(`Missing file for "${command}".\n\n${USAGE}`);
    return 2;
  }

  const xml = await readFile(file, 'utf8');

  switch (command) {
    case 'validate': {
      const result = await validate(xml);
      console.log(result.output);
      return result.exitCode;
    }
    case 'inspect': {
      const result = await inspect(xml);
      console.log(result.output);
      return result.exitCode;
    }
    case 'run': {
      const varsText = arg(argv, 'vars');
      const stateFile = arg(argv, 'state');
      const saveFile = arg(argv, 'save');
      const mode = arg(argv, 'mode') as EngineMode | undefined;

      const result = await run(xml, {
        ...(varsText ? { variables: JSON.parse(varsText) as Record<string, unknown> } : {}),
        ...(mode ? { mode } : {}),
        ...(stateFile
          ? { state: JSON.parse(await readFile(stateFile, 'utf8')) as EngineState }
          : {}),
      });
      console.log(result.output);
      if (saveFile) {
        await writeFile(saveFile, JSON.stringify(result.state, null, 2), 'utf8');
        console.log(`state saved to ${saveFile}`);
      }
      return result.exitCode;
    }
    default:
      console.error(`Unknown command "${command}".\n\n${USAGE}`);
      return 2;
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
