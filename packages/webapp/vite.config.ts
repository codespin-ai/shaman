import { defineConfig } from 'vite';

export default defineConfig({
  root: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      // Proxy all authentication requests to the backend
      '/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        // Need to pass cookies through the proxy for authentication to work
        cookieDomainRewrite: {
          '*': ''
        },
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            // Log proxy requests for debugging
            console.log(`Proxying request to: ${proxyReq.path}`);
          });
        }
      }
    }
  }
});