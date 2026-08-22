import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import mkcert from 'vite-plugin-mkcert';

// HTTPS is required for WebXR on real Quest devices; mkcert issues a
// local-trusted cert so Quest Browser accepts the dev URL without manual
// cert install. On desktop-only dev the cert is still served but harmless.
export default defineConfig({
  plugins: [react(), mkcert()],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
