import { defineConfig, searchForWorkspaceRoot } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    fs: {
      // Allow importing the shared sample .bpmn files from the repo root.
      allow: [searchForWorkspaceRoot(process.cwd())],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
