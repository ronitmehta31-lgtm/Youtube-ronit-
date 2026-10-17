// One self-contained HTML file: open it from disk, no server, works offline.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  publicDir: false,
  build: { outDir: 'release', emptyOutDir: true },
});
