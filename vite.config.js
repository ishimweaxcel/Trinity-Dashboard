import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    hmr: {
      timeout: 5000,
      overlay: true,
    },
    watch: {
      ignored: ['**/node_modules/**', '**/.git/**'],
      usePolling: false,
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
})
