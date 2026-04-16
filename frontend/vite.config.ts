import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  // Top-level await in src/lib/supabase.ts requires a target that allows it
  // natively. All modern browsers we support do.
  build: { target: 'es2022' },
  esbuild: { target: 'es2022' },
});
