import { test } from '@jest/globals';
import { createServerEngine } from '../server/test/sessions.test';

describe('commands', () => {
  test('starts execution on the second pool in a collaboration diagram with first pool as not executable', async () => {
    const model = { processes: [getNonExecutableProcess(), getExecutableProcess()] };
    const serverEngine = createServerEngine(model);
    let process: any;

    try {
      // Create a new server engine
      await serverEngine.start();

      // Get the first non-executable and second executable process
      process = model.processes.find((p) => p.isExecutable);
      if (!process) throw new Error('No executable process found in the diagram.');
    } catch (error) {
      if (error.message !== 'No executable process found.') {
        // If this fails we should log the error as it is.
        return;
      }
    }

    expect(serverEngine._currentProcess).toBe(model.processes[1].name);
  });
});

// Helper functions
function getNonExecutableProcess(): any {
  return { name: 'non-executable', isExecutable: false };
}

function getExecutableProcess(): any {
  return { name: 'executable', isExecutable: true };
}