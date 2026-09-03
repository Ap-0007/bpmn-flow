const newEngine = (): void => {
  // Find the first pool that's not executable
  const initialProcess = currentModel?.processes.find((p) => !p.isExecutable);

  if (!initialProcess) {
    throw new Error('No initial non-executable process found.');
  }

  // Find the next executable process
  const executableProcess = currentModel?.processes.find((p) => p.isExecutable);

  if (!executableProcess) {
    throw new Error('No executable process found.');
  }
};