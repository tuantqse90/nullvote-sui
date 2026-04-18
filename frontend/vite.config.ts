import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// snarkjs is a node-style CJS module; Vite needs help pre-bundling it for the
// browser. Web Worker entrypoints bundle separately so snarkjs can use WASM
// without main-thread deps.
export default defineConfig({
  plugins: [react()],
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    include: ['snarkjs', 'poseidon-lite'],
  },
  build: {
    target: 'esnext',
    sourcemap: true,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Vendor splitting — keeps the initial bundle under ~400 KB gzip by
        // pushing @mysten/* and friends into lazy chunks the router pulls in
        // only when a route that needs them is entered.
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return
          if (id.includes('@mysten')) return 'mysten'
          if (id.includes('@tanstack')) return 'tanstack'
          if (id.includes('react-router')) return 'router'
          if (id.includes('poseidon-lite')) return 'poseidon'
          if (id.includes('snarkjs')) return 'snarkjs'
          if (id.includes('react-dom')) return 'react'
          if (id.includes('/react/')) return 'react'
        },
      },
    },
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
    fs: { strict: false },
  },
})
