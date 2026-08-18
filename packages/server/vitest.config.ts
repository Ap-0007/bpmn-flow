import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Test against the core sources so the suite never depends on a build.
      '@bpmn-flow/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
    },
  },
});
