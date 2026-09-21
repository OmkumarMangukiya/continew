/*
  Sets up the dev proxy for the client
  so that all /api request from client goes to the api server running on port 3000
  and all /ws request from client goes to the ws server running on port 3000
  due to this there is no need of cors setup or worrying about cookie.
*/
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy REST API endpoints to Express
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // Proxy WebSockets for live webhook delivery logs
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
});
