import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  build: {
    cssMinify: true,
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 5173,
    // ngrok uses a random subdomain each run unless reserved — allow any host in dev
    allowedHosts: true,
  },
});
