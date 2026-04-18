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
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
    fs: { strict: false },
  },
})
