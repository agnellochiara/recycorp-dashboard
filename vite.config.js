import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

const single = process.env.SINGLE_FILE === '1';

export default defineConfig({
  base: './',
  plugins: [react(), ...(single ? [viteSingleFile()] : [])],
  build: {
    cssCodeSplit: !single,
    assetsInlineLimit: single ? 100000000 : 4096,
  },
});
