if (!model.processes.find((p) => p.isExecutable)) {
  console.error('No executable process found in the diagram.');
  return;
};