import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Development only: the characterization suite runs against Fastify serving `dist` on port 3000,
// because page routes need real 400/404 statuses (SPEC §1). The dev server proxies data routes.
const api = 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
  server: {
    proxy: { '/api': api, '/vets.json': api, '/vets.xml': api },
  },
});
