import { defineConfig } from 'vite';

/**
 * `BASE_PATH` lets the same build serve from the root (embedded by
 * `@bpmn-flow/server`) or from a subpath (GitHub Pages project site).
 */
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
});
