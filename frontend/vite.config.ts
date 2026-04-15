import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  preview: {
    // Allow Railway-assigned hostnames (including per-PR preview subdomains).
    // Leading dot = match any subdomain.
    allowedHosts: ['.up.railway.app', '.railway.app'],
  },
});
