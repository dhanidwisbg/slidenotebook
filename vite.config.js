import { defineConfig } from 'vite';
import { resolve } from 'path';

const rewriteRoutesPlugin = () => ({
  name: 'rewrite-routes',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url === '/admin' || req.url?.startsWith('/admin?')) {
        req.url = req.url.replace('/admin', '/admin.html');
      } else if (req.url === '/read' || req.url?.startsWith('/read?')) {
        req.url = req.url.replace('/read', '/read.html');
      }
      next();
    });
  }
});

export default defineConfig({
  plugins: [rewriteRoutesPlugin()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), 'index.html'),
        admin: resolve(process.cwd(), 'admin.html'),
        read: resolve(process.cwd(), 'read.html')
      }
    }
  }
});
