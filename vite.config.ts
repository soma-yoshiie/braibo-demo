/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `--mode single` produces dist-single/index.html with all JS/CSS inlined,
// so the game can be opened as one file (or published as a single page).
export default defineConfig(({ mode }) => ({
  plugins: mode === 'single' ? [react(), viteSingleFile()] : [react()],
  base: './',
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    target: 'es2019',
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}));
